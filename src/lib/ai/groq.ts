// ============================================================
// Groq Client — shared text generation for extraction + RAG Q&A
// Uses Llama 3.3 70B via Groq's fast inference API
// ============================================================

import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';

function getGroqProvider() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not configured');
  return createGroq({ apiKey });
}

export function isGroqAvailable(): boolean {
  return !!process.env.GROQ_API_KEY;
}

/**
 * Generate text using Groq/Llama. Returns the raw text response.
 */
export async function groqGenerate(prompt: string, options?: { temperature?: number; maxOutputTokens?: number }): Promise<string> {
  const groq = getGroqProvider();
  const result = await generateText({
    model: groq('llama-3.3-70b-versatile'),
    prompt,
    temperature: options?.temperature ?? 0.2,
    maxOutputTokens: options?.maxOutputTokens ?? 2048,
  });
  return result.text;
}

/**
 * Generate structured JSON using Groq/Llama.
 * Wraps the prompt with JSON-output instructions and parses the response.
 */
export async function groqGenerateJSON<T = Record<string, unknown>>(prompt: string, options?: { temperature?: number }): Promise<T> {
  const wrappedPrompt = `${prompt}\n\nIMPORTANT: Respond with ONLY valid JSON. No markdown, no code blocks, no explanation — just the JSON object.`;
  const text = await groqGenerate(wrappedPrompt, { temperature: options?.temperature ?? 0.1, maxOutputTokens: 4096 });

  // Try direct parse first, then try extracting from code blocks
  try {
    return JSON.parse(text);
  } catch {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }
    // Try to find the first { ... } block
    const braceMatch = text.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      return JSON.parse(braceMatch[0]);
    }
    throw new Error(`Failed to parse JSON from Groq response: ${text.slice(0, 200)}`);
  }
}
