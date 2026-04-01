// POST /api/rag/ask — Natural language Q&A about policy using RAG + Gemini

import { NextRequest } from 'next/server';
import { retrieveContext, formatRetrievedContext } from '@/lib/ai/rag';
import { getGenerativeModel, isAIAvailable } from '@/lib/ai/gemini';

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

    // If AI is available, generate a natural language answer
    let answer = '';
    if (isAIAvailable()) {
      const model = getGenerativeModel();
      const prompt = `You are a helpful insurance policy assistant for Plum OPD Advantage insurance.
Answer the user's question based ONLY on the policy context provided below.
Be concise, specific, and cite the relevant policy section.
If the answer is not in the context, say so clearly.

POLICY CONTEXT:
${ragContext}

USER QUESTION: ${question}

Answer in 2-3 sentences maximum. Format amounts in ₹.`;

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 300 },
      });
      answer = result.response.text();
    } else {
      answer = `Based on the policy documents, here's what I found:\n\n${results.slice(0, 3).map(r => `• ${r.chunk.text}`).join('\n\n')}`;
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
