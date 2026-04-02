import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';

// GROQ_MODEL env var to switch between models:
//   llama-3.3-70b-versatile  — best quality (100K TPD free limit)
//   llama-3.1-8b-instant     — faster, higher limits (500K TPD), good for testing
export const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

// Fetch all available Groq API keys from environment
const getApiKeys = () => {
  const keys = [
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3,
  ].filter(Boolean) as string[];
  return keys;
};

let currentKeyIndex = 0;

/**
 * Returns a Groq provider instance for the currently active API key.
 */
export function getGroqProvider() {
  const keys = getApiKeys();
  if (keys.length === 0) throw new Error('No GROQ_API_KEY configured');
  
  // Wrap index to stay within bounds
  const index = currentKeyIndex % keys.length;
  return createGroq({ apiKey: keys[index] });
}

export function isGroqAvailable(): boolean {
  return getApiKeys().length > 0;
}

/**
 * Helper to rotate to the next API key.
 */
export function rotateGroqKey() {
  const keys = getApiKeys();
  if (keys.length > 1) {
    currentKeyIndex = (currentKeyIndex + 1) % keys.length;
    console.log(`🔄 Rotated Groq API key to index ${currentKeyIndex}`);
  }
}

/**
 * Wrapper for Groq calls that handles automatic rotation on rate limits (429).
 */
export async function withGroqRotation<T>(
  operation: (provider: ReturnType<typeof createGroq>) => Promise<T>
): Promise<T> {
  const keys = getApiKeys();
  const maxAttempts = keys.length; // Try every available key

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const provider = getGroqProvider();
      return await operation(provider);
    } catch (error: any) {
      const msg = (error?.message || '').toLowerCase();
      const status = error?.status || error?.statusCode;
      // Catch rate limits (429), quota exceeded, and resource exhausted errors
      const isRetryable =
        status === 429 ||
        status === 413 ||
        msg.includes('429') ||
        msg.includes('rate limit') ||
        msg.includes('rate_limit') ||
        msg.includes('quota') ||
        msg.includes('exceeded') ||
        msg.includes('resource_exhausted') ||
        msg.includes('tokens per') ||
        msg.includes('requests per');

      if (isRetryable && attempt < maxAttempts - 1) {
        console.warn(`⚠️ Groq limit hit (attempt ${attempt + 1}/${maxAttempts}): ${msg.slice(0, 100)}. Rotating key...`);
        rotateGroqKey();
        continue;
      }
      throw error;
    }
  }
  throw new Error('Groq rotation failed — all API keys exhausted');
}

/**
 * Generate text using Groq/Llama. Returns the raw text response.
 * Automatically handles key rotation on rate limits.
 */
export async function groqGenerate(prompt: string, options?: { temperature?: number; maxOutputTokens?: number }): Promise<string> {
  return withGroqRotation(async (groq) => {
    const result = await generateText({
      model: groq(GROQ_MODEL),
      prompt,
      temperature: options?.temperature ?? 0.2,
      maxOutputTokens: options?.maxOutputTokens ?? 2048,
      maxRetries: 0, // Disable SDK retry — our rotation handles retries across keys
    });
    return result.text;
  });
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
