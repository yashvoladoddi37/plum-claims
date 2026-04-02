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
  // Split by markdown patterns and render inline
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  // Process **bold**, `code`, and ```code blocks```
  const regex = /\*\*(.+?)\*\*|`{3}([\s\S]*?)`{3}|`(.+?)`/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(remaining)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push(remaining.slice(lastIndex, match.index));
    }

    if (match[1]) {
      // **bold**
      parts.push(<strong key={key++}>{match[1]}</strong>);
    } else if (match[2]) {
      // ```code block```
      parts.push(<code key={key++} className="block bg-muted px-3 py-2 rounded text-xs font-mono my-1 whitespace-pre-wrap">{match[2].trim()}</code>);
    } else if (match[3]) {
      // `inline code`
      parts.push(<code key={key++} className="bg-muted px-1 py-0.5 rounded text-xs font-mono">{match[3]}</code>);
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < remaining.length) {
    parts.push(remaining.slice(lastIndex));
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
      setQaResult(data);
      setQaHistory(prev => [data, ...prev]);
    } catch { /* */ }
    setAsking(false);
  }

  function toggleChunk(id: string) {
    setExpandedChunks(prev => ({ ...prev, [id]: !prev[id] }));
  }

  const filteredChunks = kbFilter === "all" ? chunks : chunks.filter(c => c.source === kbFilter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Policy Explorer</h1>
        <p className="text-muted-foreground text-sm mt-1">Browse the RAG knowledge base, search policy terms, or ask natural language questions</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">Total Chunks</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold">{stats.totalChunks}</div></CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-400">
            <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">📋 Policy Terms</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold">{stats.bySource.policy_terms || 0}</div></CardContent>
          </Card>
          <Card className="border-l-4 border-l-violet-400">
            <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">⚖️ Rules</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold">{stats.bySource.adjudication_rules || 0}</div></CardContent>
          </Card>
          <Card className="border-l-4 border-l-emerald-400">
            <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">🏥 Medical</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold">{stats.bySource.medical_knowledge || 0}</div></CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-400">
            <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">Embeddings</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{stats.embeddingsLoaded ? "✅ Active" : "⚠️ Keywords"}</div></CardContent>
          </Card>
        </div>
      )}

      {/* Q&A Section */}
      <Card className="border-purple-200 bg-gradient-to-br from-purple-50/50 to-blue-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">🤖 Ask About Your Policy</CardTitle>
          <p className="text-xs text-muted-foreground">Ask questions in natural language — the AI will answer using the RAG knowledge base</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Sample questions */}
          <div className="flex flex-wrap gap-2">
            {SAMPLE_QUESTIONS.map((q, i) => (
              <button key={i} onClick={() => handleAsk(q)}
                className="text-xs px-3 py-1.5 rounded-full border bg-white hover:bg-purple-50 hover:border-purple-300 transition-all">
                {q}
              </button>
            ))}
          </div>

          {/* Input */}
          <form onSubmit={(e) => { e.preventDefault(); handleAsk(); }} className="flex gap-2">
            <input className="flex-1 border rounded-lg px-4 py-2 text-sm" type="text"
              value={question} onChange={e => setQuestion(e.target.value)}
              placeholder="Ask anything about your insurance policy..." />
            <Button type="submit" disabled={asking || !question.trim()}>
              {asking ? "Thinking..." : "Ask"}
            </Button>
          </form>

          {/* Answer */}
          {qaResult && (
            <div className="space-y-3">
              <div className="p-4 rounded-lg bg-white border">
                <div className="text-xs text-muted-foreground mb-2 font-medium">💬 Q: {qaResult.question}</div>
                <div className="text-sm leading-relaxed whitespace-pre-line">{renderMarkdown(qaResult.answer)}</div>
              </div>
              {qaResult.sources.length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground mb-2">Sources used:</div>
                  <div className="space-y-1">
                    {qaResult.sources.slice(0, 3).map((s, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs p-2 rounded bg-muted/50">
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

      {/* Semantic Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">🔍 Semantic Search</CardTitle>
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
      <Card>
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
        <Card>
          <CardHeader><CardTitle className="text-sm">💬 Previous Questions</CardTitle></CardHeader>
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
