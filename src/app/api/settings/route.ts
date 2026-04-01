// GET /api/settings — Get current AI configuration status
// POST /api/settings — Update API key at runtime

import { NextRequest } from 'next/server';
import { setApiKey, getApiKeyInfo, isAIAvailable, getGenerativeModel } from '@/lib/ai/gemini';

export const dynamic = 'force-dynamic';

export async function GET() {
  const keyInfo = getApiKeyInfo();
  return Response.json({
    ai_available: isAIAvailable(),
    ...keyInfo,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { api_key, action } = body;

    // Clear key
    if (action === 'clear') {
      setApiKey(null);
      const keyInfo = getApiKeyInfo();
      return Response.json({
        success: true,
        message: 'Runtime API key cleared. Falling back to environment variable.',
        ai_available: isAIAvailable(),
        ...keyInfo,
      });
    }

    // Validate key
    if (!api_key || typeof api_key !== 'string' || api_key.trim().length < 10) {
      return Response.json(
        { success: false, error: 'Invalid API key format.' },
        { status: 400 }
      );
    }

    const trimmedKey = api_key.trim();

    // Test the key by making a lightweight API call
    setApiKey(trimmedKey);
    try {
      const model = getGenerativeModel();
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: 'Respond with exactly: OK' }] }],
        generationConfig: { maxOutputTokens: 10 },
      });
      const text = result.response.text().trim();
      if (!text) throw new Error('Empty response from API');
    } catch (err) {
      // Revert key on failure
      setApiKey(null);
      return Response.json(
        {
          success: false,
          error: `API key validation failed: ${String(err).slice(0, 200)}`,
        },
        { status: 400 }
      );
    }

    const keyInfo = getApiKeyInfo();
    return Response.json({
      success: true,
      message: 'API key configured and verified successfully!',
      ai_available: true,
      ...keyInfo,
    });
  } catch (error) {
    return Response.json(
      { success: false, error: `Failed to update settings: ${String(error)}` },
      { status: 500 }
    );
  }
}
