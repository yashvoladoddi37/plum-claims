// POST /api/claims — Submit a new claim
// GET /api/claims — List all claims

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import '@/lib/db/seed';
import { claims, members } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { adjudicate } from '@/lib/engine/pipeline';
import { ClaimInput, Member } from '@/lib/types';
import { extractFromDocuments } from '@/lib/ai/extract';
import { isAIAvailable } from '@/lib/ai/gemini';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

function generateClaimId(): string {
  const count = db.select().from(claims).all().length;
  return `CLM_${String(count + 1).padStart(5, '0')}`;
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let claimInput: ClaimInput;
    let documentFiles: { base64: string; mimeType: string }[] = [];
    let aiExtraction = null;

    if (contentType.includes('multipart/form-data')) {
      // File upload path
      const formData = await request.formData();
      const memberId = formData.get('member_id') as string;
      const memberName = formData.get('member_name') as string;
      const treatmentDate = formData.get('treatment_date') as string;
      const claimAmount = parseFloat(formData.get('claim_amount') as string);
      const hospital = formData.get('hospital') as string | null;
      const cashless = formData.get('cashless_request') === 'true';

      // Process uploaded files
      const files = formData.getAll('documents') as File[];
      for (const file of files) {
        const buffer = Buffer.from(await file.arrayBuffer());
        documentFiles.push({
          base64: buffer.toString('base64'),
          mimeType: file.type,
        });
      }

      // If AI is available and we have files, extract data
      if (isAIAvailable() && documentFiles.length > 0) {
        aiExtraction = await extractFromDocuments(documentFiles);
        // Build claim input from AI extraction
        const ext = aiExtraction.extraction;
        claimInput = {
          member_id: memberId,
          member_name: memberName,
          treatment_date: ext.treatment_date || treatmentDate,
          claim_amount: ext.total_amount || claimAmount,
          hospital: hospital || ext.doctor?.clinic_hospital || undefined,
          cashless_request: cashless,
          documents: {
            prescription: ext.doctor ? {
              doctor_name: ext.doctor.name || '',
              doctor_reg: ext.doctor.registration_number || '',
              diagnosis: ext.diagnosis || '',
              medicines_prescribed: ext.medicines_prescribed,
              tests_prescribed: ext.tests_prescribed,
              qualification: ext.doctor.qualification || undefined,
              clinic_hospital: ext.doctor.clinic_hospital || undefined,
            } : undefined,
            bill: ext.line_items.length > 0 ? Object.fromEntries(
              ext.line_items.map(li => [li.description.toLowerCase().replace(/\s+/g, '_'), li.amount])
            ) : undefined,
          },
        };
      } else {
        // No AI — use form data directly
        claimInput = {
          member_id: memberId,
          member_name: memberName,
          treatment_date: treatmentDate,
          claim_amount: claimAmount,
          hospital: hospital || undefined,
          cashless_request: cashless,
          documents: {},
        };
      }
    } else {
      // JSON path (for test cases / direct API calls)
      claimInput = await request.json();
    }

    // Look up member
    const member = db.select().from(members).where(eq(members.id, claimInput.member_id)).get() as Member | undefined;

    // Run adjudication
    const claimId = generateClaimId();
    const decision = adjudicate(claimInput, { member: member || null }, claimId);

    // Store claim
    const now = new Date().toISOString();
    db.insert(claims).values({
      id: claimId,
      member_id: claimInput.member_id,
      member_name: claimInput.member_name,
      status: decision.decision,
      claim_amount: claimInput.claim_amount,
      approved_amount: decision.approved_amount,
      treatment_date: claimInput.treatment_date,
      submission_date: now.split('T')[0],
      hospital: claimInput.hospital || null,
      cashless_request: claimInput.cashless_request || false,
      input_data_json: JSON.stringify(claimInput),
      documents_json: documentFiles.length > 0 ? JSON.stringify(documentFiles.map(f => ({ mimeType: f.mimeType, size: f.base64.length }))) : null,
      extraction_json: aiExtraction ? JSON.stringify(aiExtraction) : null,
      decision: decision.decision,
      decision_reasons_json: JSON.stringify(decision.rejection_reasons),
      decision_notes: decision.notes,
      confidence_score: decision.confidence_score,
      processing_time_ms: decision.processing_time_ms,
      pipeline_result_json: JSON.stringify(decision.steps),
      created_at: now,
      updated_at: now,
    }).run();

    return Response.json({
      claim_id: claimId,
      status: decision.decision,
      decision,
      processing_time_ms: decision.processing_time_ms,
    });
  } catch (error) {
    console.error('Claim submission error:', error);
    return Response.json(
      { error: 'Failed to process claim', details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const memberId = url.searchParams.get('member_id');

    let query = db.select().from(claims).orderBy(desc(claims.created_at));

    const allClaims = query.all().filter(c => {
      if (status && c.status !== status) return false;
      if (memberId && c.member_id !== memberId) return false;
      return true;
    });

    return Response.json({ claims: allClaims, total: allClaims.length });
  } catch (error) {
    console.error('Claims list error:', error);
    return Response.json({ error: 'Failed to fetch claims' }, { status: 500 });
  }
}
