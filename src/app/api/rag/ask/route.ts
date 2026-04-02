// POST /api/rag/ask — Natural language Q&A about policy using RAG + Groq/Llama

import { NextRequest } from 'next/server';
import { retrieveContext, formatRetrievedContext } from '@/lib/ai/rag';
import { isGroqAvailable, groqGenerate } from '@/lib/ai/groq';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { question } = await request.json();

    if (!question || typeof question !== 'string') {
      return Response.json({ error: 'Question string required' }, { status: 400 });
    }

    // Retrieve relevant context
    const results = await retrieveContext(question, 5);
    const ragContext = formatRetrievedContext(results);

    // If Groq is available, generate a natural language answer
    let answer = '';
    if (isGroqAvailable()) {
      const prompt = `You are a warm, friendly, and knowledgeable insurance policy assistant for Plum OPD Advantage insurance. Think of yourself as a helpful colleague who genuinely cares about helping the member understand their coverage.

TONE & STYLE:
- Be warm and reassuring — use phrases like "Great question!", "Happy to help with that!", "Good news!", "I understand your concern"
- Be conversational, not robotic — write like a friendly expert explaining things over coffee
- Use simple language that anyone can understand, not insurance jargon
- Show empathy — if something isn't covered, acknowledge that it's disappointing before explaining why

STRUCTURE YOUR ANSWER LIKE THIS:
1. Start with a warm, direct answer (Yes/No + friendly context)
2. Explain WHY — what's the reasoning behind this policy decision?
3. Give specific details — amounts (use ₹), limits, conditions, waiting periods etc.
4. End with a "📋 Policy Reference" section that cites the exact source. Format each citation as:
   📋 **Policy Reference:** [source_type] → [category] — "[exact quote or paraphrase from the context]"

RULES:
- Base your answer ONLY on the policy context provided below. Do not make up information.
- When the context includes specific values or amounts, always use those exact values.
- If something is excluded, explain the reasoning behind the exclusion kindly.
- If the answer is not in the context, say so honestly and suggest what the member could do (e.g., contact HR, check with Plum support).
- Use **bold** for key terms and amounts to make scanning easy.
- Aim for 4-6 sentences in the main answer, plus the citation section.

POLICY CONTEXT:
${ragContext}

USER QUESTION: ${question}

Remember: be warm, thorough, and always cite your sources!`;

      answer = await groqGenerate(prompt, { temperature: 0.4, maxOutputTokens: 800 });
    } else {
      // Fallback when Groq is unavailable — show relevant excerpts without misleading preamble
      const excerpts = results.slice(0, 3).map(r => `• ${r.chunk.text}`).join('\n\n');
      answer = `${excerpts}\n\n(Note: AI summary unavailable — showing relevant policy excerpts. Configure GROQ_API_KEY for natural language answers.)`;
    }

    return Response.json({
      question,
      answer,
      sources: results.map(r => ({
        source: r.chunk.source,
        category: r.chunk.category,
        text: r.chunk.text,
        similarity: r.similarity,
      })),
    });
  } catch (error) {
    console.error('RAG Q&A error:', error);
    return Response.json({ error: 'Failed to answer question' }, { status: 500 });
  }
}
