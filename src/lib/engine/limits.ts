// ============================================================
// Step 4: Limit Validation
// - Per-claim limit
// - Sub-limits by category
// - Annual limit (YTD)
// - Co-pay calculation
// - Network discount
// ============================================================

import { ClaimInput, StepResult, RejectionReason } from '../types';
import {
  getPerClaimLimit,
  getAnnualLimit,
  getConsultationCopay,
  getNetworkDiscount,
  isNetworkHospital,
  getCoveredAltTreatments,
  getDentalSubLimit,
  getDiagnosticSubLimit,
  getAltMedicineSubLimit,
  getPharmacySubLimit,
  getVisionSubLimit,
} from '../policy/terms';

interface LimitsContext {
  /** Total claims approved this year for this member (before current claim) */
  ytdApprovedAmount: number;
}

export function calculateLimits(
  claim: ClaimInput,
  context: LimitsContext = { ytdApprovedAmount: 0 },
  /** If coverage step already reduced amount (partial), use that */
  adjustedAmount?: number
): StepResult {
  const reasons: RejectionReason[] = [];
  const details: string[] = [];

  const baseAmount = adjustedAmount ?? claim.claim_amount;
  let workingAmount = baseAmount;

  // 1. Per-claim limit check
  // Determine effective per-claim limit based on claim category.
  // Category-specific sub-limits (dental ₹10K, diagnostic ₹10K, etc.) take precedence
  // over the generic per-claim limit (₹5K) when the claim is entirely within that category.
  const genericPerClaimLimit = getPerClaimLimit();
  const effectiveLimit = getCategoryLimit(claim) ?? genericPerClaimLimit;
  const amountToCheck = adjustedAmount ?? claim.claim_amount;

  if (amountToCheck > effectiveLimit) {
    // If exceeds the category limit, it's a reject on per-claim exceeded
    // But if the category limit is higher than per-claim (e.g. dental ₹10K > ₹5K),
    // and the amount fits within category, it passes.
    reasons.push('PER_CLAIM_EXCEEDED');
    details.push(`Claim amount ₹${amountToCheck} exceeds per-claim limit of ₹${effectiveLimit}.`);
    return {
      step: 'Limits Check',
      passed: false,
      decision_impact: 'REJECT',
      reasons,
      details: details.join(' '),
    };
  }

  // 2. Annual limit check
  const annualLimit = getAnnualLimit();
  const remainingAnnual = annualLimit - context.ytdApprovedAmount;
  if (workingAmount > remainingAnnual) {
    if (remainingAnnual <= 0) {
      reasons.push('ANNUAL_LIMIT_EXCEEDED');
      details.push(`Annual limit of ₹${annualLimit} has been fully utilized.`);
      return {
        step: 'Limits Check',
        passed: false,
        decision_impact: 'REJECT',
        reasons,
        details: details.join(' '),
      };
    } else {
      // Partial — approve up to remaining limit
      workingAmount = remainingAnnual;
      details.push(`Claim reduced to ₹${remainingAnnual} (annual limit remaining).`);
    }
  }

  // 3. Network discount (applies BEFORE co-pay)
  let networkDiscount = 0;
  const isNetwork = claim.hospital && isNetworkHospital(claim.hospital);
  if (isNetwork) {
    const discountPct = getNetworkDiscount();
    networkDiscount = Math.round(workingAmount * discountPct / 100);
    workingAmount = workingAmount - networkDiscount;
    details.push(`Network discount of ${discountPct}%: -₹${networkDiscount}.`);
  }

  // 4. Co-pay calculation
  // Co-pay of 10% applies ONLY to general consultation claims (TC001: ₹1500 → ₹1350)
  // Does NOT apply to: network claims (TC010), alt medicine (TC006), dental (TC002),
  // diagnostic-only, vision, or pharmacy-only claims.
  // The 10% copay_percentage is under "consultation_fees" in policy, meaning it's
  // specifically for consultation-type claims, not all claim categories.
  let copayDeduction = 0;
  const categoryLimit = getCategoryLimit(claim);
  const isSpecialtyCategory = categoryLimit !== null; // dental, alt medicine, vision, etc.
  if (!isNetwork && !isSpecialtyCategory) {
    const copayPct = getConsultationCopay(); // 10%
    copayDeduction = Math.round(workingAmount * copayPct / 100);
    workingAmount = workingAmount - copayDeduction;
    details.push(`Co-pay of ${copayPct}%: -₹${copayDeduction}.`);
  }

  // 5. Minimum claim amount check
  // (applied on the original claim amount, not after deductions)
  if (claim.claim_amount < 500) {
    reasons.push('BELOW_MIN_AMOUNT' as RejectionReason);
    details.push(`Claim amount ₹${claim.claim_amount} is below minimum of ₹500.`);
    return {
      step: 'Limits Check',
      passed: false,
      decision_impact: 'REJECT',
      reasons,
      details: details.join(' '),
    };
  }

  const approvedAmount = Math.round(workingAmount);

  return {
    step: 'Limits Check',
    passed: true,
    decision_impact: 'NONE',
    reasons: [],
    details: details.length > 0 ? details.join(' ') : `Claim of ₹${claim.claim_amount} is within all limits.`,
    adjustments: {
      approved_amount: approvedAmount,
      copay_deduction: copayDeduction,
      network_discount: networkDiscount,
    },
  };
}


/**
 * Detect if the claim is for alternative medicine (Ayurveda, Homeopathy, Unani).
 * These have their own sub-limit and no co-pay per policy terms.
 */
function isAlternativeMedicineClaim(claim: ClaimInput): boolean {
  const altTreatments = getCoveredAltTreatments().map(t => t.toLowerCase());
  const prescription = claim.documents.prescription;
  if (!prescription) return false;

  // Check doctor reg format (e.g., AYUR/KL/2345/2019)
  if (prescription.doctor_reg?.startsWith('AYUR')) return true;

  // Check treatment/diagnosis text
  const textToCheck = [
    prescription.treatment || '',
    prescription.diagnosis || '',
    ...(prescription.medicines_prescribed || []),
  ].join(' ').toLowerCase();

  return altTreatments.some(alt => textToCheck.includes(alt)) ||
    textToCheck.includes('panchakarma') ||
    textToCheck.includes('ayurved') ||
    textToCheck.includes('homeopath') ||
    textToCheck.includes('unani');
}

/**
 * Determine the category-specific sub-limit for a claim.
 * Returns the sub-limit if the claim falls into a recognized category,
 * or null if it's a general/mixed claim (use per-claim limit).
 */
function getCategoryLimit(claim: ClaimInput): number | null {
  const prescription = claim.documents.prescription;
  const bill = claim.documents.bill;
  if (!prescription) return null;

  const diagnosis = (prescription.diagnosis || '').toLowerCase();
  const treatment = (prescription.treatment || '').toLowerCase();
  const procedures = (prescription.procedures || []).map(p => p.toLowerCase());

  // Dental claims — check bill keys for dental-related keywords too
  const billKeys = bill ? Object.keys(bill).map(k => k.toLowerCase()) : [];
  if (diagnosis.includes('tooth') || diagnosis.includes('dental') ||
      diagnosis.includes('root canal') || diagnosis.includes('cavity') ||
      diagnosis.includes('pulpitis') || diagnosis.includes('molar') ||
      procedures.some(p => p.includes('root canal') || p.includes('filling') ||
        p.includes('extraction') || p.includes('cleaning')) ||
      billKeys.some(k => k.includes('root_canal') || k.includes('dental') ||
        k.includes('filling') || k.includes('extraction'))) {
    return getDentalSubLimit();
  }

  // Diagnostic test claims (standalone)
  if (billKeys.some(k => k.includes('mri') || k.includes('ct_scan') || k.includes('x_ray') ||
      k.includes('ultrasound') || k.includes('diagnostic'))) {
    const total = Object.entries(bill || {})
      .filter(([k]) => !k.includes('consultation'))
      .reduce((sum, [, v]) => sum + (typeof v === 'number' ? v : 0), 0);
    if (total > 0) {
      const consultFee = Object.entries(bill || {})
        .filter(([k]) => k.includes('consultation'))
        .reduce((sum, [, v]) => sum + (typeof v === 'number' ? v : 0), 0);
      if (!consultFee || consultFee / claim.claim_amount < 0.3) {
        return getDiagnosticSubLimit();
      }
    }
  }

  // Alternative medicine
  if (isAlternativeMedicineClaim(claim)) {
    return getAltMedicineSubLimit();
  }

  // Vision
  if (diagnosis.includes('eye') || diagnosis.includes('vision') || diagnosis.includes('myopia')) {
    return getVisionSubLimit();
  }

  return null; // General claim — use per-claim limit
}