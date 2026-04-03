"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface SettingsStatus {
  ai_available: boolean;
  configured: boolean;
  source: "runtime" | "env" | "none";
  maskedKey: string | null;
}

export default function SettingsPage() {
  const [status, setStatus] = useState<SettingsStatus | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  async function fetchStatus() {
    try {
      const res = await fetch("/api/settings");
      setStatus(await res.json());
    } catch {
      setStatus(null);
    }
  }

  useEffect(() => { fetchStatus(); }, []);

  async function handleSaveKey(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ text: data.message, type: "success" });
        setApiKey("");
        fetchStatus();
      } else {
        setMessage({ text: data.error, type: "error" });
      }
    } catch (err) {
      setMessage({ text: String(err), type: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function handleClearKey() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear" }),
      });
      const data = await res.json();
      setMessage({ text: data.message, type: "success" });
      fetchStatus();
    } catch (err) {
      setMessage({ text: String(err), type: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#141413]">Settings</h1>
        <p className="text-[#5e5d59] text-sm mt-1">Configure AI features for claim adjudication</p>
      </div>

      {/* Status Card */}
      <Card className="border-[#4d4c48]/20 bg-[#faf9f5]">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-[#141413]">
            <span>AI Status</span>
            {status && (
              <Badge className={status.ai_available
                ? "bg-[#27a644]/15 text-[#27a644] border-[#27a644]/30"
                : "bg-[#b53333]/10 text-[#b53333] border-[#b53333]/20"
              }>
                {status.ai_available ? "✅ Active" : "❌ Inactive"}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {status ? (
            <>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-[#5e5d59]">API Key</span>
                  <p className="font-mono mt-0.5 text-[#141413]">{status.maskedKey || "Not configured"}</p>
                </div>
                <div><span className="text-[#5e5d59]">Source</span>
                  <p className="mt-0.5 text-[#141413]">
                    {status.source === "runtime" && "🔧 Set via Settings"}
                    {status.source === "env" && "📁 Environment variable (.env.local)"}
                    {status.source === "none" && "—"}
                  </p>
                </div>
              </div>
              <div className="bg-[#f0eee6] rounded-lg p-3 text-sm space-y-1">
                <p className="font-medium text-[#141413]">What AI features are enabled:</p>
                <ul className="text-[#5e5d59] space-y-0.5 ml-4 list-disc">
                  <li className={status.ai_available ? "" : "opacity-50"}>📄 Document extraction from uploaded images (Gemini Vision)</li>
                  <li className={status.ai_available ? "" : "opacity-50"}>🧠 Medical necessity review with RAG context</li>
                  <li className={status.ai_available ? "" : "opacity-50"}>📚 Semantic policy search (embeddings)</li>
                  <li className={status.ai_available ? "" : "opacity-50"}>💬 Natural language policy Q&A</li>
                </ul>
                {!status.ai_available && (
                  <p className="text-amber-600 mt-2 font-medium">⚠️ Without an API key, the rule engine still works — AI features are just disabled.</p>
                )}
              </div>
            </>
          ) : (
            <div className="animate-pulse bg-[#f0eee6] rounded h-20" />
          )}
        </CardContent>
      </Card>

      {/* API Key Form */}
      <Card className="border-[#4d4c48]/20 bg-[#faf9f5]">
        <CardHeader>
          <CardTitle className="text-[#141413]">Gemini API Key</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-[#c96442]/8 border border-[#c96442]/20 rounded-lg p-3 text-sm text-[#87867f]">
            <p className="font-medium text-[#141413]">🔑 How to get an API key:</p>
            <ol className="list-decimal ml-5 mt-1 space-y-0.5">
              <li>Go to <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="underline font-medium text-[#c96442]">Google AI Studio</a></li>
              <li>Sign in with your Google account</li>
              <li>Click &quot;Create API Key&quot;</li>
              <li>Copy the key and paste it below</li>
            </ol>
          </div>

          <form onSubmit={handleSaveKey} className="space-y-3">
            <div>
              <Label htmlFor="api-key" className="text-[#141413]">API Key</Label>
              <Input
                id="api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="font-mono mt-1 border-[#4d4c48]/20 bg-[#faf9f5]"
                autoComplete="off"
              />
              <p className="text-xs text-[#5e5d59] mt-1">
                Your key is validated with a test API call and stored in server memory only (not persisted to disk).
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={loading || !apiKey.trim()} className="flex-1 bg-[#c96442] hover:bg-[#d97757] text-white">
                {loading ? "Validating..." : "Save & Verify Key"}
              </Button>
              {status?.source === "runtime" && (
                <Button type="button" variant="outline" onClick={handleClearKey} disabled={loading} className="border-[#4d4c48]/20 text-[#141413]">
                  Clear
                </Button>
              )}
            </div>
          </form>

          {message && (
            <div className={`rounded-lg p-3 text-sm ${
              message.type === "success" ? "bg-[#27a644]/15 text-[#27a644] border border-[#27a644]/30" : "bg-[#b53333]/10 text-[#b53333] border border-[#b53333]/20"
            }`}>
              {message.type === "success" ? "✅" : "❌"} {message.text}
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Info */}
      <Card className="border-[#4d4c48]/20 bg-[#faf9f5]">
        <CardHeader>
          <CardTitle className="text-sm text-[#141413]">System Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-[#5e5d59]">Generation Model</span><p className="font-mono mt-0.5 text-[#141413]">gemini-2.5-flash</p></div>
            <div><span className="text-[#5e5d59]">Embedding Model</span><p className="font-mono mt-0.5 text-[#141413]">gemini-embedding-001</p></div>
            <div><span className="text-[#5e5d59]">Database</span><p className="font-mono mt-0.5 text-[#141413]">SQLite (local)</p></div>
            <div><span className="text-[#5e5d59]">RAG Knowledge Base</span><p className="font-mono mt-0.5 text-[#141413]">38 chunks (policy + medical)</p></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
