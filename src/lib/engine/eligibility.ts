// ============================================================
// Step 1: Basic Eligibility Check
// - Policy active on treatment date
// - Waiting period satisfied
// - Member is covered
// ============================================================

import { ClaimInput, StepResult } from '../types';
import { Member } from '../types';
import {
  getInitialWaitingDays,
  getSpecificAilmentWaiting,
} from '../policy/terms';

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA);
  const b = new Date(dateB);
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export function checkEligibility(
  claim: ClaimInput,
  member: Member | null
): StepResult {
  const reasons: StepResult['reasons'] = [];
  const details: string[] = [];

  // 1. Member exists?
  if (!member) {
    return {
      step: 'Eligibility Check',
      passed: false,
      decision_impact: 'REJECT',
      reasons: ['MEMBER_NOT_COVERED'],
      details: `Member ${claim.member_id} not found in policy records.`,
    };
  }

  // 2. Policy active on treatment date?
  // Policy is active if treatment date is on or after policy start date
  const policyStart = member.policy_start_date;
  if (claim.treatment_date < policyStart) {
    reasons.push('POLICY_INACTIVE');
    details.push(
      `Policy started on ${policyStart}, but treatment was on ${claim.treatment_date}.`
    );
  }

  // 3. Waiting period check
  // Use member_join_date from claim if provided, otherwise use member record
  const joinDate = claim.member_join_date || member.join_date;
  const daysSinceJoin = daysBetween(joinDate, claim.treatment_date);

  // Initial waiting period (30 days)
  const initialWaiting = getInitialWaitingDays();
  if (daysSinceJoin < initialWaiting) {
    reasons.push('WAITING_PERIOD');
    details.push(
      `Initial waiting period of ${initialWaiting} days not met. Member joined ${joinDate}, only ${daysSinceJoin} days before treatment.`
    );
  }

  // Specific ailment waiting periods
  const diagnosis = claim.documents.prescription?.diagnosis?.toLowerCase() || '';
  const specificWaiting = getSpecificAilmentWaiting();

  for (const [ailment, requiredDays] of Object.entries(specificWaiting)) {
    const ailmentLower = ailment.toLowerCase().replace('_', ' ');
    if (diagnosis.includes(ailmentLower)) {
      if (daysSinceJoin < requiredDays) {
        // Only add WAITING_PERIOD if not already added
        if (!reasons.includes('WAITING_PERIOD')) {
          reasons.push('WAITING_PERIOD');
        }
        const eligibleDate = new Date(joinDate);
        eligibleDate.setDate(eligibleDate.getDate() + requiredDays);
        details.push(
          `${ailment} has ${requiredDays}-day waiting period. Eligible from ${eligibleDate.toISOString().split('T')[0]}.`
        );
      }
    }
  }

  return {
    step: 'Eligibility Check',
    passed: reasons.length === 0,
    decision_impact: reasons.length > 0 ? 'REJECT' : 'NONE',
    reasons,
    details: details.length > 0 ? details.join(' ') : 'All eligibility checks passed.',
  };
}
