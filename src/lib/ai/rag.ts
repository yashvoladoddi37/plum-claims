// ============================================================
// RAG Knowledge Base
// In-memory vector store for policy terms, adjudication rules,
// and medical knowledge. Uses Gemini embeddings + cosine similarity.
// ============================================================

import { getEmbeddingModel } from './gemini';

export interface KnowledgeChunk {
  id: string;
  text: string;
  source: 'policy_terms' | 'adjudication_rules' | 'medical_knowledge';
  category: string;
  embedding?: number[];
}

export interface RetrievalResult {
  chunk: KnowledgeChunk;
  similarity: number;
}

// In-memory vector store
let knowledgeBase: KnowledgeChunk[] = [];
let isInitialized = false;

// ---- Cosine Similarity ----
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ---- Knowledge Chunks ----
function buildKnowledgeChunks(): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = [];

  // Policy Terms chunks
  chunks.push(
    { id: 'pt-1', source: 'policy_terms', category: 'coverage_limits',
      text: 'Annual OPD limit is Rs 50,000 per member. Per claim limit is Rs 5,000 for general consultations. Family floater limit is Rs 150,000.' },
    { id: 'pt-2', source: 'policy_terms', category: 'consultation',
      text: 'Consultation fees are covered with a sub-limit of Rs 2,000. Co-pay of 10% applies to consultation claims. Network hospital discount of 20% applies.' },
    { id: 'pt-3', source: 'policy_terms', category: 'diagnostics',
      text: 'Diagnostic tests covered with sub-limit of Rs 10,000. Covered tests include blood tests, urine tests, X-rays, ECG, ultrasound. MRI and CT scan require pre-authorization.' },
    { id: 'pt-4', source: 'policy_terms', category: 'pharmacy',
      text: 'Pharmacy coverage with sub-limit of Rs 15,000. Generic drugs are mandatory. Branded drugs have 30% co-pay.' },
    { id: 'pt-5', source: 'policy_terms', category: 'dental',
      text: 'Dental coverage with sub-limit of Rs 10,000. Covered procedures: filling, extraction, root canal, cleaning. Cosmetic dental procedures are not covered.' },
    { id: 'pt-6', source: 'policy_terms', category: 'vision',
      text: 'Vision coverage with sub-limit of Rs 5,000. Eye tests covered. Glasses and contact lenses covered. LASIK surgery is not covered.' },
    { id: 'pt-7', source: 'policy_terms', category: 'alternative_medicine',
      text: 'Alternative medicine covered with sub-limit of Rs 8,000. Covered treatments: Ayurveda, Homeopathy, Unani. Maximum 20 therapy sessions per year.' },
    { id: 'pt-8', source: 'policy_terms', category: 'exclusions',
      text: 'Excluded treatments: cosmetic procedures, weight loss treatments, infertility treatments, experimental treatments, self-inflicted injuries, adventure sports injuries, HIV/AIDS treatment, alcoholism/drug abuse treatment, vitamins and supplements unless prescribed for deficiency.' },
    { id: 'pt-9', source: 'policy_terms', category: 'waiting_periods',
      text: 'Initial waiting period is 30 days from policy start. Pre-existing diseases have 365-day waiting period. Diabetes and hypertension have 90-day waiting period. Joint replacement has 730-day waiting period.' },
  );

  // Adjudication Rules chunks
  chunks.push(
    { id: 'ar-1', source: 'adjudication_rules', category: 'eligibility',
      text: 'Eligibility check: Policy must be active on date of treatment. Waiting periods must be satisfied. Claimant must be a covered member (employee or dependent).' },
    { id: 'ar-2', source: 'adjudication_rules', category: 'documents',
      text: 'Document validation: Documents must be legible and complete. Doctor registration number must be valid in format State/Number/Year. Bills must have proper headers and stamps. All document dates must match treatment date. Patient name must match policy records.' },
    { id: 'ar-3', source: 'adjudication_rules', category: 'fraud',
      text: 'Fraud indicators: multiple claims from same provider on same day, unusually high frequency of claims, bills with suspicious alterations, diagnosis not matching age/gender, duplicate bills, provider not registered or blacklisted. Claims above Rs 25,000 require manual review.' },
    { id: 'ar-4', source: 'adjudication_rules', category: 'partial_approval',
      text: 'Partial approval: Claims can be partially approved when part of treatment is covered and part is not, or when claim exceeds sub-limits. Co-payment percentages apply where applicable.' },
    { id: 'ar-5', source: 'adjudication_rules', category: 'submission',
      text: 'Claims must be submitted within 30 days of treatment. Minimum claim amount is Rs 500. Late submissions are rejected.' },
  );

  // Medical Knowledge chunks
  chunks.push(
    { id: 'mk-1', source: 'medical_knowledge', category: 'fever',
      text: 'Viral fever treatment: typically requires paracetamol (650mg), rest, and hydration. CBC and dengue test are appropriate diagnostic tests for persistent fever. Antibiotics not needed unless bacterial infection confirmed.' },
    { id: 'mk-2', source: 'medical_knowledge', category: 'dental',
      text: 'Root canal treatment is medically necessary for severe tooth decay, dental abscess, or trauma. Average cost in India: Rs 5,000-15,000. Teeth whitening is a cosmetic procedure and not medically necessary.' },
    { id: 'mk-3', source: 'medical_knowledge', category: 'diabetes',
      text: 'Type 2 diabetes treatment: Metformin is first-line therapy. Glimepiride is a common add-on. Regular blood sugar monitoring (fasting and post-prandial) and HbA1c tests are standard. Diabetes is a pre-existing chronic condition.' },
    { id: 'mk-4', source: 'medical_knowledge', category: 'gastro',
      text: 'Gastroenteritis treatment: Antibiotics may be prescribed for bacterial gastroenteritis. Probiotics support recovery. Oral rehydration is primary treatment. Typical consultation and medicine costs: Rs 1,000-3,000.' },
    { id: 'mk-5', source: 'medical_knowledge', category: 'respiratory',
      text: 'Acute bronchitis treatment: Antibiotics prescribed when bacterial cause suspected. Bronchodilators for wheezing. Usually resolves in 1-3 weeks. Standard OPD treatment, does not require hospitalization.' },
    { id: 'mk-6', source: 'medical_knowledge', category: 'musculoskeletal',
      text: 'Chronic joint pain and back pain: Panchakarma therapy in Ayurveda is a recognized treatment. MRI for lumbar disc herniation requires clinical justification. Physiotherapy is standard non-surgical treatment.' },
    { id: 'mk-7', source: 'medical_knowledge', category: 'migraine',
      text: 'Migraine treatment: Sumatriptan is a standard acute treatment. Propranolol is used for prophylaxis. Diagnosis based on clinical symptoms. CT/MRI only needed to rule out secondary causes.' },
    { id: 'mk-8', source: 'medical_knowledge', category: 'obesity',
      text: 'Obesity and weight management: Bariatric consultation and diet plans are classified as weight loss treatments. BMI above 30 is clinical obesity. Weight loss treatments are typically excluded from OPD insurance coverage in India.' },
    { id: 'mk-9', source: 'medical_knowledge', category: 'allergy',
      text: 'Allergic rhinitis treatment: Cetirizine and other antihistamines are standard treatment. Nasal corticosteroid sprays may be prescribed. Allergy testing can be done as OPD diagnostic test.' },
  );

  return chunks;
}

// ---- Embed Chunks ----
async function embedText(text: string): Promise<number[]> {
  const model = getEmbeddingModel();
  const result = await model.embedContent(text);
  return result.embedding.values;
}

export async function initializeKnowledgeBase(): Promise<void> {
  if (isInitialized) return;

  knowledgeBase = buildKnowledgeChunks();

  try {
    // Batch embed all chunks
    const model = getEmbeddingModel();
    for (const chunk of knowledgeBase) {
      const result = await model.embedContent(chunk.text);
      chunk.embedding = result.embedding.values;
    }
    isInitialized = true;
    console.log(`✅ RAG knowledge base initialized with ${knowledgeBase.length} chunks`);
  } catch (error) {
    console.warn('⚠️  Failed to initialize RAG embeddings, falling back to keyword search:', error);
    isInitialized = true; // Mark as initialized even on failure — we'll use keyword fallback
  }
}

// ---- Retrieve ----
export async function retrieveContext(
  query: string,
  topK: number = 5,
  sourceFilter?: KnowledgeChunk['source']
): Promise<RetrievalResult[]> {
  if (!isInitialized) {
    await initializeKnowledgeBase();
  }

  let filteredChunks = knowledgeBase;
  if (sourceFilter) {
    filteredChunks = knowledgeBase.filter(c => c.source === sourceFilter);
  }

  // If embeddings are available, use vector search
  const hasEmbeddings = filteredChunks.some(c => c.embedding);
  if (hasEmbeddings) {
    try {
      const queryEmbedding = await embedText(query);
      const scored = filteredChunks
        .filter(c => c.embedding)
        .map(chunk => ({
          chunk,
          similarity: cosineSimilarity(queryEmbedding, chunk.embedding!),
        }))
        .sort((a, b) => b.similarity - a.similarity);
      return scored.slice(0, topK);
    } catch {
      // Fall through to keyword search
    }
  }

  // Keyword fallback
  const queryWords = query.toLowerCase().split(/\s+/);
  const scored = filteredChunks.map(chunk => {
    const chunkWords = chunk.text.toLowerCase();
    const matchCount = queryWords.filter(w => chunkWords.includes(w)).length;
    return { chunk, similarity: matchCount / queryWords.length };
  }).sort((a, b) => b.similarity - a.similarity);

  return scored.slice(0, topK);
}

/** Format retrieval results as context string for LLM prompt */
export function formatRetrievedContext(results: RetrievalResult[]): string {
  if (results.length === 0) return 'No relevant context found.';
  return results
    .map((r, i) => `[${i + 1}] (${r.chunk.source}/${r.chunk.category}, relevance: ${(r.similarity * 100).toFixed(0)}%)\n${r.chunk.text}`)
    .join('\n\n');
}
