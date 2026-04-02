"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface KnowledgeChunk {
  id: string;
  source: string;
  category: string;
  textPreview: string;
  text: string;
}

interface SearchResult {
  source: string;
  category: string;
  text: string;
  similarity: number;
}

interface QAResult {
  question: string;
  answer: string;
  sources: SearchResult[];
}

const SOURCE_COLORS: Record<string, string> = {
  policy_terms: "bg-blue-100 text-blue-800 border-blue-200",
  adjudication_rules: "bg-violet-100 text-violet-800 border-violet-200",
  medical_knowledge: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

const SOURCE_ICONS: Record<string, string> = {
  policy_terms: "📋",
  adjudication_rules: "⚖️",
  medical_knowledge: "🏥",
};

/** Render simple markdown (bold, code, backticks) as inline HTML */
function renderMarkdown(text: string) {
  const parts: React.ReactNode[] = [];
  let key = 0;

  const regex = /\*\*(.+?)\*\*|`{3}([\s\S]*?)`{3}|`(.+?)`/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[1]) {
      parts.push(<strong key={key++}>{match[1]}</strong>);
    } else if (match[2]) {
      parts.push(<code key={key++} className="block bg-muted px-3 py-2 rounded text-xs font-mono my-1 whitespace-pre-wrap">{match[2].trim()}</code>);
    } else if (match[3]) {
      parts.push(<code key={key++} className="bg-muted px-1 py-0.5 rounded text-xs font-mono">{match[3]}</code>);
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

const SAMPLE_QUESTIONS = [
  "Am I covered for Ayurvedic treatment?",
  "What is the per-claim limit?",
  "Is teeth whitening covered?",
  "What is the waiting period for diabetes?",
  "Do I need pre-authorization for an MRI?",
  "What documents do I need to submit a claim?",
];

export default function PolicyExplorer() {
  const [chunks, setChunks] = useState<KnowledgeChunk[]>([]);
  const [stats, setStats] = useState<{ totalChunks: number; bySource: Record<string, number>; embeddingsLoaded: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchSourceFilter, setSearchSourceFilter] = useState<string>("all");

  // Q&A
  const [question, setQuestion] = useState("");
  const [qaResult, setQaResult] = useState<QAResult | null>(null);
  const [asking, setAsking] = useState(false);
  const [qaHistory, setQaHistory] = useState<QAResult[]>([]);

  // Knowledge Base filter + expanded cards
  const [kbFilter, setKbFilter] = useState<string>("all");
  const [expandedChunks, setExpandedChunks] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/rag")
      .then(r => r.json())
      .then(data => {
        setChunks(data.chunks || []);
        setStats({ totalChunks: data.totalChunks, bySource: data.bySource, embeddingsLoaded: data.embeddingsLoaded });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch("/api/rag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, topK: 8, source: searchSourceFilter === "all" ? undefined : searchSourceFilter }),
      });
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch { /* */ }
    setSearching(false);
  }

  async function handleAsk(q?: string) {
    const finalQ = q || question;
    if (!finalQ.trim()) return;
    setAsking(true);
    setQuestion(finalQ);
    try {
      const res = await fetch("/api/rag/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: finalQ }),
      });
      const data = await res.json();
      if (data.error || !data.answer) {
        setQaResult({ question: finalQ, answer: data.error || 'Something went wrong — please try again.', sources: [] });
      } else {
        const safe = { ...data, sources: data.sources || [] };
        setQaResult(safe);
        setQaHistory(prev => [safe, ...prev]);
      }
    } catch {
      setQaResult({ question: finalQ, answer: 'Network error — the server may be busy. Please try again in a moment.', sources: [] });
    }
    setAsking(false);
  }

  function toggleChunk(id: string) {
    setExpandedChunks(prev => ({ ...prev, [id]: !prev[id] }));
  }

  const filteredChunks = kbFilter === "all" ? chunks : chunks.filter(c => c.source === kbFilter);

  return (
    <div className="space-y-8">
      {/* Header — centered */}
      <div className="text-center pt-4">
        <h1 className="text-3xl font-bold tracking-tight">Policy Explorer</h1>
        <p className="text-muted-foreground text-sm mt-2 max-w-lg mx-auto">
          Browse the RAG knowledge base, search policy terms, or ask natural language questions
        </p>
      </div>

      {/* Stats — centered row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 max-w-4xl mx-auto">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="pt-4 pb-4 text-center">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Chunks</div>
              <div className="text-3xl font-bold">{stats.totalChunks}</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-400">
            <CardContent className="pt-4 pb-4 text-center">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">📋 Policy Terms</div>
              <div className="text-3xl font-bold">{stats.bySource.policy_terms || 0}</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-violet-400">
            <CardContent className="pt-4 pb-4 text-center">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">⚖️ Rules</div>
              <div className="text-3xl font-bold">{stats.bySource.adjudication_rules || 0}</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-emerald-400">
            <CardContent className="pt-4 pb-4 text-center">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">🏥 Medical</div>
              <div className="text-3xl font-bold">{stats.bySource.medical_knowledge || 0}</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-400">
            <CardContent className="pt-4 pb-4 text-center">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Embeddings</div>
              <div className="text-2xl font-bold">{stats.embeddingsLoaded ? "✅ Active" : "⚠️ Keywords"}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ====== ASK ABOUT YOUR POLICY — Hero Section ====== */}
      <div className="max-w-3xl mx-auto">
        <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50/80 to-blue-50/80 shadow-lg">
          <CardContent className="pt-8 pb-8 px-8">
            <div className="text-center space-y-4">
              <div className="text-4xl">🤖</div>
              <h2 className="text-2xl font-bold tracking-tight">Ask About Your Policy</h2>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                Ask questions in natural language — the AI will answer using the RAG knowledge base
              </p>

              {/* Sample questions — centered */}
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                {SAMPLE_QUESTIONS.map((q, i) => (
                  <button key={i} onClick={() => handleAsk(q)}
                    className="text-xs px-3 py-1.5 rounded-full border bg-white/80 hover:bg-purple-50 hover:border-purple-300 transition-all shadow-sm">
                    {q}
                  </button>
                ))}
              </div>

              {/* Input — centered */}
              <form onSubmit={(e) => { e.preventDefault(); handleAsk(); }} className="flex gap-2 max-w-xl mx-auto pt-2">
                <input className="flex-1 border rounded-lg px-4 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-300" type="text"
                  value={question} onChange={e => setQuestion(e.target.value)}
                  placeholder="Ask anything about your insurance policy..." />
                <Button type="submit" disabled={asking || !question.trim()} className="px-6">
                  {asking ? "Thinking..." : "Ask"}
                </Button>
              </form>
            </div>

            {/* Answer */}
            {qaResult && (
              <div className="space-y-3 mt-6">
                <div className="p-5 rounded-xl bg-white border shadow-sm">
                  <div className="text-xs text-muted-foreground mb-2 font-medium text-center">💬 {qaResult.question}</div>
                  <div className="text-sm leading-relaxed whitespace-pre-line">{renderMarkdown(qaResult.answer)}</div>
                </div>
                {qaResult.sources?.length > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-2 text-center">Sources used</div>
                    <div className="space-y-1">
                      {qaResult.sources.slice(0, 3).map((s, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs p-2 rounded bg-white/60 border">
                          <Badge className={`text-xs ${SOURCE_COLORS[s.source] || ""}`}>{s.source}</Badge>
                          <span className="text-muted-foreground truncate flex-1">{s.text.slice(0, 100)}...</span>
                          <span className="font-mono text-muted-foreground">{(s.similarity * 100).toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Semantic Search */}
      <Card className="max-w-4xl mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">🔍 Semantic Search</CardTitle>
          <p className="text-xs text-muted-foreground">Find relevant policy sections using semantic similarity</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <select className="border rounded px-3 py-2 text-sm" value={searchSourceFilter} onChange={e => setSearchSourceFilter(e.target.value)}>
              <option value="all">All Sources</option>
              <option value="policy_terms">📋 Policy Terms</option>
              <option value="adjudication_rules">⚖️ Adjudication Rules</option>
              <option value="medical_knowledge">🏥 Medical Knowledge</option>
            </select>
            <input className="flex-1 border rounded px-4 py-2 text-sm" type="text" value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)} placeholder="Search: dental coverage, MRI pre-auth, waiting period..." />
            <Button type="submit" variant="outline" disabled={searching}>
              {searching ? "Searching..." : "Search"}
            </Button>
          </form>

          {searchResults.length > 0 && (
            <div className="space-y-2">
              {searchResults.map((r, i) => (
                <div key={i} className="p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <span>{SOURCE_ICONS[r.source] || "📄"}</span>
                    <Badge className={`text-xs ${SOURCE_COLORS[r.source] || ""}`}>{r.source}</Badge>
                    <Badge variant="secondary" className="text-xs">{r.category}</Badge>
                    <span className="text-xs text-muted-foreground ml-auto font-mono font-bold">
                      {(r.similarity * 100).toFixed(0)}% match
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed">{renderMarkdown(r.text)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Knowledge Base Browser */}
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>📚 Knowledge Base</CardTitle>
            <div className="flex gap-1">
              {["all", "policy_terms", "adjudication_rules", "medical_knowledge"].map(s => (
                <Button key={s} variant={kbFilter === s ? "default" : "outline"} className="text-xs h-7 px-2"
                  onClick={() => setKbFilter(s)}>
                  {s === "all" ? "All" : s === "policy_terms" ? "📋 Policy" : s === "adjudication_rules" ? "⚖️ Rules" : "🏥 Medical"}
                </Button>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Click on any chunk to expand its full content. {filteredChunks.length} chunks shown.</p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="animate-pulse bg-muted rounded h-12" />)}</div>
          ) : filteredChunks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-lg mb-1">No chunks found</p>
              <p className="text-sm">No knowledge chunks available for this source filter.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredChunks.map((chunk) => {
                const isExpanded = expandedChunks[chunk.id] ?? false;
                return (
                  <button
                    key={chunk.id}
                    onClick={() => toggleChunk(chunk.id)}
                    className="w-full text-left p-3 rounded-lg border hover:bg-muted/30 hover:shadow-sm transition-all text-sm"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-muted-foreground">{chunk.id}</span>
                      <Badge className={`text-xs ${SOURCE_COLORS[chunk.source] || ""}`}>{chunk.source}</Badge>
                      <Badge variant="secondary" className="text-xs">{chunk.category}</Badge>
                      <span className="text-xs text-muted-foreground ml-auto">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                    {isExpanded ? (
                      <p className="text-sm leading-relaxed mt-2 whitespace-pre-wrap">{renderMarkdown(chunk.text)}</p>
                    ) : (
                      <p className="text-muted-foreground text-xs truncate">{chunk.textPreview}</p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Q&A History */}
      {qaHistory.length > 1 && (
        <Card className="max-w-4xl mx-auto">
          <CardHeader><CardTitle className="text-sm text-center">💬 Previous Questions</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {qaHistory.slice(1).map((qa, i) => (
              <div key={i} className="p-3 rounded-lg bg-muted/30 border text-sm">
                <p className="font-medium text-xs text-muted-foreground">Q: {qa.question}</p>
                <p className="mt-1">{qa.answer}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
