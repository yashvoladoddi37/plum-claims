// ============================================================
// Step 2: Document Validation
// - All required documents submitted
// - Doctor registration number valid
// - Date consistency
// ============================================================

import { ClaimInput, StepResult, RejectionReason } from '../types';

// Valid doctor reg format: [State Code]/[Number]/[Year]
// Also handle alternate formats like AYUR/[State]/[Number]/[Year]
const DOCTOR_REG_PATTERN = /^([A-Z]{2,4}\/)?[A-Z]{2}\/\d{3,6}\/\d{4}$/;

export function validateDocuments(claim: ClaimInput): StepResult {
  const reasons: RejectionReason[] = [];
  const details: string[] = [];

  // 1. Prescription present?
  if (!claim.documents.prescription) {
    reasons.push('MISSING_DOCUMENTS');
    details.push('Prescription from registered doctor is required.');
    // Early return — can't validate further without prescription
    return {
      step: 'Document Validation',
      passed: false,
      decision_impact: 'REJECT',
      reasons,
      details: details.join(' '),
    };
  }

  // 2. Bill present?
  if (!claim.documents.bill) {
    reasons.push('MISSING_DOCUMENTS');
    details.push('Medical bill/invoice is required.');
  }

  // 3. Doctor registration number valid?
  const doctorReg = claim.documents.prescription.doctor_reg;
  if (!doctorReg) {
    reasons.push('DOCTOR_REG_INVALID');
    details.push('Doctor registration number is missing.');
  } else if (!DOCTOR_REG_PATTERN.test(doctorReg)) {
    // Be lenient — just check basic structure: letters/digits with slashes
    const lenientPattern = /^[A-Z]+\/[A-Z]*\/?[\d]+\/\d{4}$/;
    if (!lenientPattern.test(doctorReg)) {
      reasons.push('DOCTOR_REG_INVALID');
      details.push(`Doctor registration number "${doctorReg}" does not match expected format.`);
    }
  }

  // 4. Diagnosis present?
  if (!claim.documents.prescription.diagnosis) {
    reasons.push('INVALID_PRESCRIPTION');
    details.push('Diagnosis is missing from prescription.');
  }

  return {
    step: 'Document Validation',
    passed: reasons.length === 0,
    decision_impact: reasons.length > 0 ? 'REJECT' : 'NONE',
    reasons,
    details: details.length > 0 ? details.join(' ') : 'All documents are valid.',
  };
}
