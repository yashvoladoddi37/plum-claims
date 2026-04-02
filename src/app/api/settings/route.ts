// GET /api/settings — Get current AI configuration status
// POST /api/settings — Update API key at runtime

import { NextRequest } from 'next/server';
import { isGroqAvailable, groqGenerate } from '@/lib/ai/groq';

export const dynamic = 'force-dynamic';

function getKeyInfo(): { configured: boolean; source: 'env' | 'none'; maskedKey: string | null } {
  const key = process.env.GROQ_API_KEY;
  if (key) {
    return {
      configured: true,
      source: 'env',
      maskedKey: key.slice(0, 4) + '••••' + key.slice(-4),
    };
  }
  return { configured: false, source: 'none', maskedKey: null };
}

export async function GET() {
  const keyInfo = getKeyInfo();
  return Response.json({
    ai_available: isGroqAvailable(),
    ...keyInfo,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { api_key, action } = body;

    if (action === 'clear') {
      delete process.env.GROQ_API_KEY;
      return Response.json({
        success: true,
        message: 'Groq API key cleared.',
        ai_available: isGroqAvailable(),
        ...getKeyInfo(),
      });
    }

    if (!api_key || typeof api_key !== 'string' || api_key.trim().length < 10) {
      return Response.json(
        { success: false, error: 'Invalid API key format.' },
        { status: 400 }
      );
    }

    const trimmedKey = api_key.trim();

    // Test the key by making a lightweight call
    const prevKey = process.env.GROQ_API_KEY;
    process.env.GROQ_API_KEY = trimmedKey;
    try {
      const text = await groqGenerate('Respond with exactly: OK', { maxOutputTokens: 10 });
      if (!text) throw new Error('Empty response from Groq');
    } catch (err) {
      // Revert key on failure
      if (prevKey) process.env.GROQ_API_KEY = prevKey;
      else delete process.env.GROQ_API_KEY;
      return Response.json(
        { success: false, error: `API key validation failed: ${String(err).slice(0, 200)}` },
        { status: 400 }
      );
    }

    return Response.json({
      success: true,
      message: 'Groq API key configured and verified!',
      ai_available: true,
      ...getKeyInfo(),
    });
  } catch (error) {
    return Response.json(
      { success: false, error: `Failed to update settings: ${String(error)}` },
      { status: 500 }
    );
  }
}
