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
      const prompt = `You are a helpful insurance policy assistant for Plum OPD Advantage insurance.

RULES:
1. Answer the user's question DIRECTLY with a clear Yes/No/specific value upfront, then explain why.
2. Base your answer ONLY on the policy context provided below.
3. When the context includes specific values or amounts, always use those exact values (format as ₹).
4. NEVER say "here's what I found" or "based on the documents" — just answer the question directly as if you are the policy expert.
5. If something is excluded or not covered, say so clearly and explain the reason.
6. If the answer is not in the context, say "This is not covered in the policy documents I have access to."

POLICY CONTEXT:
${ragContext}

USER QUESTION: ${question}

Answer in 2-3 sentences maximum. Start with the direct answer.`;

      answer = await groqGenerate(prompt, { temperature: 0.2, maxOutputTokens: 300 });
    } else {
      answer = `From the policy:\n\n${results.slice(0, 3).map(r => `• ${r.chunk.text}`).join('\n\n')}\n\n(AI-generated summary unavailable — showing raw policy excerpts.)`;
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
