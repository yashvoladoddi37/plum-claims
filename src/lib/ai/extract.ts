// ============================================================
// AI Document Extraction + Medical Review
// Uses Gemini for document understanding and RAG for context
// ============================================================

import { getGenerativeModel, isAIAvailable } from './gemini';
import { retrieveContext, formatRetrievedContext, RetrievalResult } from './rag';
import { EXTRACTION_SYSTEM_PROMPT, EXTRACTION_USER_PROMPT, buildMedicalReviewPrompt } from './prompts';
import { ExtractionResult } from '../types';

export interface AIExtractionResponse {
  extraction: ExtractionResult;
  ragContext: RetrievalResult[];
  medicalReview: {
    medical_necessity_score: number;
    reasoning: string;
    flags: string[];
    coverage_assessment: string;
    retrieved_context_used: string[];
  } | null;
}

/**
 * Extract structured data from document images/PDFs using Gemini vision.
 * Also runs medical necessity review with RAG context in a single flow.
 */
export async function extractFromDocuments(
  files: { base64: string; mimeType: string }[]
): Promise<AIExtractionResponse> {
  if (!isAIAvailable()) {
    throw new Error('AI service unavailable — GEMINI_API_KEY not configured');
  }

  const model = getGenerativeModel();

  // Build multimodal parts: system prompt + images + extraction prompt
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

  parts.push({ text: EXTRACTION_SYSTEM_PROMPT });

  for (const file of files) {
    parts.push({
      inlineData: {
        mimeType: file.mimeType,
        data: file.base64,
      },
    });
  }

  parts.push({ text: EXTRACTION_USER_PROMPT });

  // Call Gemini for extraction
  const result = await model.generateContent({
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1, // Low temperature for factual extraction
    },
  });

  const responseText = result.response.text();
  let extraction: ExtractionResult;

  try {
    extraction = JSON.parse(responseText);
  } catch {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      extraction = JSON.parse(jsonMatch[1]);
    } else {
      throw new Error(`Failed to parse Gemini extraction response: ${responseText.slice(0, 200)}`);
    }
  }

  // RAG: Retrieve relevant context for medical review
  const diagnosis = extraction.diagnosis || '';
  const treatments = [
    ...(extraction.medicines_prescribed || []),
    ...(extraction.tests_prescribed || []),
    ...extraction.line_items.map(li => li.description),
  ].join(', ');

  const ragQuery = `${diagnosis} ${treatments}`;
  const ragResults = await retrieveContext(ragQuery, 5);

  // Medical necessity review with RAG context
  let medicalReview = null;
  if (diagnosis) {
    const ragContextStr = formatRetrievedContext(ragResults);
    const reviewPrompt = buildMedicalReviewPrompt(
      diagnosis,
      extraction.line_items.map(li => li.description),
      extraction.medicines_prescribed || [],
      extraction.tests_prescribed || [],
      ragContextStr
    );

    try {
      const reviewResult = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: reviewPrompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const reviewText = reviewResult.response.text();
      medicalReview = JSON.parse(reviewText);
    } catch (err) {
      console.warn('Medical review failed, continuing without it:', err);
    }
  }

  return {
    extraction,
    ragContext: ragResults,
    medicalReview,
  };
}

/**
 * Run medical review only (for JSON-path claims that skip document extraction).
 * Uses RAG to retrieve relevant context.
 */
export async function runMedicalReview(
  diagnosis: string,
  treatments: string[],
  medicines: string[],
  tests: string[]
): Promise<{ ragResults: RetrievalResult[]; medicalReview: Record<string, unknown> | null }> {
  const ragQuery = `${diagnosis} ${treatments.join(', ')} ${medicines.join(', ')} ${tests.join(', ')}`;
  const ragResults = await retrieveContext(ragQuery, 5);

  if (!isAIAvailable()) {
    return { ragResults, medicalReview: null };
  }

  const model = getGenerativeModel();
  const ragContextStr = formatRetrievedContext(ragResults);
  const reviewPrompt = buildMedicalReviewPrompt(diagnosis, treatments, medicines, tests, ragContextStr);

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: reviewPrompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
    });
    const medicalReview = JSON.parse(result.response.text());
    return { ragResults, medicalReview };
  } catch {
    return { ragResults, medicalReview: null };
  }
}
