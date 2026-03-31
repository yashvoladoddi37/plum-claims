// ============================================================
// Gemini Client Setup
// ============================================================

import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn('⚠️  GEMINI_API_KEY not set. AI features will be unavailable.');
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

/** Chat/generation model — Gemini 2.5 Flash for speed + vision */
export function getGenerativeModel() {
  if (!genAI) throw new Error('GEMINI_API_KEY not configured');
  return genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-04-17' });
}

/** Embedding model — text-embedding-004 for RAG */
export function getEmbeddingModel() {
  if (!genAI) throw new Error('GEMINI_API_KEY not configured');
  return genAI.getGenerativeModel({ model: 'text-embedding-004' });
}

export function isAIAvailable(): boolean {
  return !!genAI;
}
