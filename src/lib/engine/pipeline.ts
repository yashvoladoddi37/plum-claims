// ============================================================
// Adjudication Pipeline Orchestrator
// Runs all steps in order, synthesizes final decision
// ============================================================

import { ClaimInput, Decision, StepResult, Member, ClaimDecision, RejectionReason } from '../types';
import { checkEligibility } from './eligibility';
import { validateDocuments } from './documents';
import { checkCoverage } from './coverage';
import { calculateLimits } from './limits';
import { detectFraud } from './fraud';

interface PipelineContext {
  member: Member | null;
  ytdApprovedAmount?: number;
}

export function adjudicate(
  claim: ClaimInput,
  context: PipelineContext,
  claimId: string = 'CLM_00000'
): Decision {
  const startTime = Date.now();
  const steps: StepResult[] = [];

  // Step 1: Eligibility
  const eligibility = checkEligibility(claim, context.member);
  steps.push(eligibility);
  if (eligibility.decision_impact === 'REJECT') {
    return synthesize(claimId, claim, steps, startTime);
  }

  // Step 2: Document Validation
  const documents = validateDocuments(claim);
  steps.push(documents);
  if (documents.decision_impact === 'REJECT') {
    return synthesize(claimId, claim, steps, startTime);
  }

  // Step 3: Coverage
  const coverage = checkCoverage(claim);
  steps.push(coverage);
  // Coverage can be PARTIAL — don't exit early, but note the adjustment
  if (coverage.decision_impact === 'REJECT') {
    return synthesize(claimId, claim, steps, startTime);
  }

  // Step 4: Limits (pass adjusted amount from coverage if partial)
  const adjustedAmount = coverage.adjustments?.approved_amount;
  const limits = calculateLimits(
    claim,
    { ytdApprovedAmount: context.ytdApprovedAmount || 0 },
    adjustedAmount
  );
  steps.push(limits);
  if (limits.decision_impact === 'REJECT') {
    return synthesize(claimId, claim, steps, startTime);
  }

  // Step 5: Fraud Detection
  const fraud = detectFraud(claim);
  steps.push(fraud);
  if (fraud.decision_impact === 'MANUAL_REVIEW') {
    return synthesize(claimId, claim, steps, startTime);
  }

  return synthesize(claimId, claim, steps, startTime);
}

function synthesize(
  claimId: string,
  claim: ClaimInput,
  steps: StepResult[],
  startTime: number
): Decision {
  const processingTime = Date.now() - startTime;

  // Collect all rejection reasons
  const allReasons: RejectionReason[] = [];
  for (const step of steps) {
    allReasons.push(...step.reasons);
  }

  // Determine decision based on priority rules
  let decision: ClaimDecision = 'APPROVED';
  let approvedAmount = claim.claim_amount;
  let cashlessApproved: boolean | undefined;
  let networkDiscount: number | undefined;
  const notes: string[] = [];
  const nextSteps: string[] = [];

  // Check for MANUAL_REVIEW first (fraud)
  if (steps.some(s => s.decision_impact === 'MANUAL_REVIEW')) {
    decision = 'MANUAL_REVIEW';
    approvedAmount = 0;
    notes.push('Claim flagged for manual review due to fraud indicators.');
    nextSteps.push('Claim will be reviewed by a human adjudicator within 48 hours.');
  }
  // Check for hard REJECT
  else if (steps.some(s => s.decision_impact === 'REJECT')) {
    decision = 'REJECTED';
    approvedAmount = 0;
    const rejectStep = steps.find(s => s.decision_impact === 'REJECT');
    notes.push(rejectStep?.details || 'Claim rejected.');
    nextSteps.push('Please review the rejection reasons and submit a new claim if applicable.');
  }
  // Check for PARTIAL
  else if (steps.some(s => s.decision_impact === 'PARTIAL')) {
    decision = 'PARTIAL';
    // Use the coverage-adjusted amount, then apply limits adjustments
    const coverageStep = steps.find(s => s.step === 'Coverage Check');
    const limitsStep = steps.find(s => s.step === 'Limits Check');
    approvedAmount = limitsStep?.adjustments?.approved_amount
      ?? coverageStep?.adjustments?.approved_amount
      ?? claim.claim_amount;
    const rejectedItems = coverageStep?.adjustments?.rejected_items || [];
    notes.push(`Partial approval. Rejected items: ${rejectedItems.join(', ')}.`);
    nextSteps.push('The approved portion will be reimbursed. Excluded items cannot be claimed.');
  }
  // APPROVED
  else {
    const limitsStep = steps.find(s => s.step === 'Limits Check');
    approvedAmount = limitsStep?.adjustments?.approved_amount ?? claim.claim_amount;
    networkDiscount = limitsStep?.adjustments?.network_discount;
    if (networkDiscount && networkDiscount > 0) {
      notes.push(`Network discount applied: ₹${networkDiscount}.`);
    }
    const copay = limitsStep?.adjustments?.copay_deduction;
    if (copay && copay > 0) {
      notes.push(`Co-pay deducted: ₹${copay}.`);
    }
    if (claim.cashless_request && claim.hospital) {
      cashlessApproved = true;
      notes.push('Cashless claim approved at network hospital.');
    }
    nextSteps.push('Approved amount will be processed for reimbursement within 5-7 business days.');
  }

  // Confidence score calculation
  const confidence = calculateConfidence(steps, decision);

  // Force MANUAL_REVIEW if confidence < 0.70
  if (confidence < 0.70 && decision !== 'REJECTED' && decision !== 'MANUAL_REVIEW') {
    decision = 'MANUAL_REVIEW';
    notes.push(`Low confidence (${(confidence * 100).toFixed(0)}%) — flagged for manual review.`);
  }

  return {
    claim_id: claimId,
    decision,
    approved_amount: approvedAmount,
    rejection_reasons: allReasons,
    confidence_score: confidence,
    notes: notes.join(' '),
    next_steps: nextSteps.join(' '),
    steps,
    cashless_approved: cashlessApproved,
    network_discount: networkDiscount,
    processing_time_ms: processingTime,
  };
}

function calculateConfidence(steps: StepResult[], decision: ClaimDecision): number {
  // Deterministic rules have high confidence
  // Base confidence from rule clarity
  let confidence = 0.95;

  if (decision === 'MANUAL_REVIEW') {
    confidence = 0.65; // Low confidence by definition
  } else if (decision === 'REJECTED') {
    // Rejections on clear rule violations are high confidence
    confidence = 0.97;
    // Slightly lower for certain reasons
    const reasons = steps.flatMap(s => s.reasons);
    if (reasons.includes('WAITING_PERIOD')) confidence = 0.96;
    if (reasons.includes('SERVICE_NOT_COVERED')) confidence = 0.97;
    if (reasons.includes('PER_CLAIM_EXCEEDED')) confidence = 0.98;
    if (reasons.includes('MISSING_DOCUMENTS')) confidence = 1.0;
  } else if (decision === 'PARTIAL') {
    confidence = 0.92;
  } else {
    // APPROVED
    confidence = 0.95;
  }

  return confidence;
}
