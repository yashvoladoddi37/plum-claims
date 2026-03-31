// ============================================================
// Step 3: Coverage Verification
// - Check if treatment/service is covered
// - Check exclusions
// - Check pre-authorization requirements
// ============================================================

import { ClaimInput, StepResult, RejectionReason } from '../types';
import {
  getExclusions,
  EXCLUSION_KEYWORDS,
  getPreAuthTests,
  getCoveredDentalProcedures,
  getCoveredAltTreatments,
} from '../policy/terms';

function matchesExclusion(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [exclusion, keywords] of Object.entries(EXCLUSION_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        return exclusion;
      }
    }
  }
  return null;
}

export function checkCoverage(claim: ClaimInput): StepResult {
  const reasons: RejectionReason[] = [];
  const details: string[] = [];
  const rejectedItems: string[] = [];
  let partialAmount = 0;

  const prescription = claim.documents.prescription;
  const bill = claim.documents.bill;

  if (!prescription || !bill) {
    return {
      step: 'Coverage Check',
      passed: true, // Documents step already catches this
      decision_impact: 'NONE',
      reasons: [],
      details: 'Skipped — insufficient documents for coverage check.',
    };
  }

  // 1. Check diagnosis against exclusions
  const diagnosisExclusion = matchesExclusion(prescription.diagnosis || '');
  if (diagnosisExclusion) {
    reasons.push('SERVICE_NOT_COVERED');
    details.push(`Treatment for "${prescription.diagnosis}" falls under excluded category: ${diagnosisExclusion}.`);
    return {
      step: 'Coverage Check',
      passed: false,
      decision_impact: 'REJECT',
      reasons,
      details: details.join(' '),
    };
  }

  // 2. Check treatment/procedures against exclusions
  const treatment = prescription.treatment || '';
  const treatmentExclusion = matchesExclusion(treatment);
  if (treatmentExclusion) {
    reasons.push('SERVICE_NOT_COVERED');
    details.push(`Treatment "${treatment}" falls under excluded category: ${treatmentExclusion}.`);
    return {
      step: 'Coverage Check',
      passed: false,
      decision_impact: 'REJECT',
      reasons,
      details: details.join(' '),
    };
  }

  // 3. Check individual procedures for partial coverage
  if (prescription.procedures) {
    for (const proc of prescription.procedures) {
      const procExclusion = matchesExclusion(proc);
      if (procExclusion) {
        rejectedItems.push(`${proc} - ${procExclusion.toLowerCase()}`);
        // Find and subtract the amount for this procedure from the bill
        const procKey = proc.toLowerCase().replace(/\s+/g, '_');
        const amount = bill[procKey] as number | undefined;
        if (amount) {
          partialAmount += amount;
        }
      }
    }
  }

  // 4. Check bill items for cosmetic/excluded procedures
  if (bill.teeth_whitening && bill.teeth_whitening > 0) {
    if (!rejectedItems.some(r => r.includes('whitening'))) {
      rejectedItems.push('Teeth whitening - cosmetic procedure');
      partialAmount += bill.teeth_whitening;
    }
  }
  if (bill.diet_plan && bill.diet_plan > 0) {
    const dietExclusion = matchesExclusion('diet plan weight loss');
    if (dietExclusion) {
      rejectedItems.push(`Diet plan - ${dietExclusion.toLowerCase()}`);
      partialAmount += bill.diet_plan;
    }
  }

  // 5. Check pre-authorization for tests
  const preAuthTests = getPreAuthTests();
  const claimedTests = prescription.tests_prescribed || bill.test_names || [];

  for (const test of claimedTests) {
    const testLower = test.toLowerCase();
    for (const preAuthTest of preAuthTests) {
      if (testLower.includes(preAuthTest.toLowerCase())) {
        // MRI/CT scan needs pre-auth — check if the claim amount suggests a major test
        reasons.push('PRE_AUTH_MISSING');
        details.push(`${preAuthTest} requires pre-authorization.`);
      }
    }
  }

  // Also check bill keys for MRI/CT
  if (bill.mri_scan && bill.mri_scan > 0) {
    if (!reasons.includes('PRE_AUTH_MISSING')) {
      reasons.push('PRE_AUTH_MISSING');
      details.push('MRI requires pre-authorization for claims above ₹10000.');
    }
  }

  // Determine outcome
  if (reasons.length > 0 && reasons.includes('PRE_AUTH_MISSING')) {
    return {
      step: 'Coverage Check',
      passed: false,
      decision_impact: 'REJECT',
      reasons,
      details: details.join(' '),
    };
  }

  if (rejectedItems.length > 0) {
    const approvedAmount = claim.claim_amount - partialAmount;
    return {
      step: 'Coverage Check',
      passed: false,
      decision_impact: 'PARTIAL',
      reasons: ['EXCLUDED_CONDITION'],
      details: `Partial coverage: ${rejectedItems.join('; ')}. Approved portion: ₹${approvedAmount}.`,
      adjustments: {
        approved_amount: approvedAmount,
        rejected_items: rejectedItems,
      },
    };
  }

  return {
    step: 'Coverage Check',
    passed: true,
    decision_impact: 'NONE',
    reasons: [],
    details: 'All treatments and services are covered under the policy.',
  };
}
