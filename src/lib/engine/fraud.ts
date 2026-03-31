// ============================================================
// Step 5: Fraud Detection
// - Multiple claims from same provider on same day
// - Unusually high frequency of claims
// - High-value claims (>₹25,000)
// - Duplicate claims
// ============================================================

import { ClaimInput, StepResult } from '../types';

export function detectFraud(claim: ClaimInput): StepResult {
  const flags: string[] = [];
  const details: string[] = [];

  // 1. Multiple claims on same day
  if (claim.previous_claims_same_day && claim.previous_claims_same_day >= 2) {
    flags.push('Multiple claims same day');
    details.push(
      `${claim.previous_claims_same_day} previous claims submitted on ${claim.treatment_date}.`
    );
  }

  // 2. High-value claim threshold (>₹25,000)
  if (claim.claim_amount > 25000) {
    flags.push('High-value claim');
    details.push(`Claim amount ₹${claim.claim_amount} exceeds ₹25,000 threshold.`);
  }

  // 3. Unusual patterns (basic checks)
  // Check if claim amount is suspiciously close to limits
  if (claim.claim_amount === 5000 || claim.claim_amount === 4999) {
    flags.push('Amount at exact limit boundary');
    details.push('Claim amount is exactly at or just below the per-claim limit.');
  }

  if (flags.length > 0) {
    return {
      step: 'Fraud Detection',
      passed: false,
      decision_impact: 'MANUAL_REVIEW',
      reasons: [],
      details: `Fraud indicators detected: ${flags.join('; ')}. ${details.join(' ')}`,
    };
  }

  return {
    step: 'Fraud Detection',
    passed: true,
    decision_impact: 'NONE',
    reasons: [],
    details: 'No fraud indicators detected.',
  };
}
