"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  DecisionSummary,
  ConfidenceBreakdownViz,
  LineItemBreakdown,
  AmountWaterfall,
  CounterfactualsList,
  PolicyReferences,
} from "@/components/ClaimBreakdown";

// --- Types ---
interface StepResult { step: string; passed: boolean; decision_impact: string; reasons: string[]; details: string; adjustments?: Record<string, unknown>; }

const AGENT_META: Record<string, { icon: string; name: string; description: string }> = {
  'Eligibility Check': { icon: '🛡️', name: 'Eligibility Agent', description: 'Verifies policy status, waiting periods, and member coverage' },
  'Document Validation': { icon: '📄', name: 'Document Agent', description: 'Validates prescriptions, bills, and supporting documents' },
  'Coverage Check': { icon: '📋', name: 'Coverage Agent', description: 'Checks service coverage, exclusions, and pre-authorization' },
  'Limits Check': { icon: '💰', name: 'Limits Agent', description: 'Applies annual limits, sub-limits, co-pay, and deductions' },
  'Fraud Detection': { icon: '🔍', name: 'Fraud Detection Agent', description: 'Screens for duplicate claims, unusual patterns, and anomalies' },
  'AI Medical Review': { icon: '🧠', name: 'Medical Review Agent', description: 'AI-powered assessment of medical necessity using RAG context' },
};

const STATUS_BG: Record<string, string> = {
  APPROVED: "bg-emerald-50 border-emerald-300", REJECTED: "bg-red-50 border-red-300",
  PARTIAL: "bg-amber-50 border-amber-300", MANUAL_REVIEW: "bg-orange-50 border-orange-300",
};
const STATUS_BADGE: Record<string, string> = {
  APPROVED: "bg-emerald-100 text-emerald-800", REJECTED: "bg-red-100 text-red-800",
  PARTIAL: "bg-amber-100 text-amber-800", MANUAL_REVIEW: "bg-orange-100 text-orange-800",
};
const STATUS_ICON: Record<string, string> = {
  APPROVED: "✅", REJECTED: "❌", PARTIAL: "⚠️", MANUAL_REVIEW: "🔍",
};

function getAgentRecommendation(step: StepResult): { label: string; color: string } {
  if (step.passed) return { label: 'PASS', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
  if (step.decision_impact === 'REJECT') return { label: 'DENY', color: 'bg-red-100 text-red-800 border-red-300' };
  if (step.decision_impact === 'PARTIAL') return { label: 'PARTIAL', color: 'bg-amber-100 text-amber-800 border-amber-300' };
  return { label: 'REVIEW', color: 'bg-orange-100 text-orange-800 border-orange-300' };
}

export default function SubmitClaim() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result, setResult] = useState<Record<string, any> | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [expandedAgents, setExpandedAgents] = useState<Record<string, boolean>>({});

  // Form fields
  const [memberId, setMemberId] = useState("EMP001");
  const [memberName, setMemberName] = useState("Rajesh Kumar");
  const [treatmentDate, setTreatmentDate] = useState("2024-11-15");
  const [claimAmount, setClaimAmount] = useState("1500");
  const [hospital, setHospital] = useState("");
  const [cashless, setCashless] = useState(false);
  const [jsonInput, setJsonInput] = useState("");

  function toggleAgent(step: string) {
    setExpandedAgents(prev => ({ ...prev, [step]: !prev[step] }));
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setExpandedAgents({});
    try {
      const formData = new FormData();
      formData.append("member_id", memberId);
      formData.append("member_name", memberName);
      formData.append("treatment_date", treatmentDate);
      formData.append("claim_amount", claimAmount);
      if (hospital) formData.append("hospital", hospital);
      formData.append("cashless_request", String(cashless));
      for (const file of files) formData.append("documents", file);

      const res = await fetch("/api/claims", { method: "POST", body: formData });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ error: String(err) });
    } finally { setLoading(false); }
  }

  async function handleJsonSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setExpandedAgents({});
    try {
      const parsed = JSON.parse(jsonInput);
      const res = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      setResult(await res.json());
    } catch (err) {
      setResult({ error: String(err) });
    } finally { setLoading(false); }
  }

  // Extract data from result
  const status = result?.status as string | undefined;
  const decision = result?.decision;
  const explanation = result?.explanation;
  const pipeline: StepResult[] = decision?.steps || [];
  const aiContext = decision?.ai_context;
  const ragChunks = aiContext?.rag_chunks_used || [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold">Submit New Claim</h1>

      <Tabs defaultValue="form">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="form">📋 Form + Documents</TabsTrigger>
          <TabsTrigger value="json">🔧 JSON Input</TabsTrigger>
        </TabsList>

        <TabsContent value="form">
          <Card>
            <CardHeader><CardTitle>Claim Details</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Member ID</Label><Input value={memberId} onChange={(e) => setMemberId(e.target.value)} /></div>
                  <div><Label>Member Name</Label><Input value={memberName} onChange={(e) => setMemberName(e.target.value)} /></div>
                  <div><Label>Treatment Date</Label><Input type="date" value={treatmentDate} onChange={(e) => setTreatmentDate(e.target.value)} /></div>
                  <div><Label>Claim Amount (₹)</Label><Input type="number" value={claimAmount} onChange={(e) => setClaimAmount(e.target.value)} /></div>
                  <div><Label>Hospital</Label><Input value={hospital} onChange={(e) => setHospital(e.target.value)} placeholder="Optional" /></div>
                  <div className="flex items-end gap-2">
                    <input type="checkbox" id="cashless" checked={cashless} onChange={(e) => setCashless(e.target.checked)} />
                    <Label htmlFor="cashless">Cashless Request</Label>
                  </div>
                </div>
                <div>
                  <Label>Upload Documents (Images/PDFs)</Label>
                  <Input type="file" multiple accept="image/*,.pdf" onChange={(e) => setFiles(Array.from(e.target.files || []))} className="mt-1" />
                  {files.length > 0 && <p className="text-sm text-muted-foreground mt-1">{files.length} file(s) selected</p>}
                </div>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? "Processing..." : "Submit Claim"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="json">
          <Card>
            <CardHeader><CardTitle>JSON Claim Input</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleJsonSubmit} className="space-y-4">
                <Textarea rows={12} value={jsonInput} onChange={(e) => setJsonInput(e.target.value)}
                  placeholder='Paste claim JSON here (same format as test_cases.json input_data)...' className="font-mono text-sm" />
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? "Processing..." : "Submit JSON Claim"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ======== RESULT ======== */}
      {result && result.error && (
        <Card className="border-red-300">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <span className="text-2xl">❌</span>
              <div>
                <p className="font-semibold text-red-800">Error Processing Claim</p>
                <p className="text-sm text-red-600 mt-1">{String(result.error)}</p>
                {result.details && <p className="text-xs text-muted-foreground mt-2 font-mono">{String(result.details)}</p>}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {result && status && !result.error && (
        <div className="space-y-5">
          {/* --- Decision Header --- */}
          <div className={`rounded-xl border-2 p-6 ${STATUS_BG[status] || "bg-muted"}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl">{STATUS_ICON[status] || "📋"}</span>
                  <Badge className={`text-lg px-4 py-1.5 ${STATUS_BADGE[status] || ""}`}>{status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Claim <button className="font-mono font-semibold text-foreground hover:underline" onClick={() => router.push(`/claims/${result.claim_id}`)}>{String(result.claim_id)}</button>
                  {decision?.processing_time_ms != null && <span> · Processed in {String(decision.processing_time_ms)}ms</span>}
                </p>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Claimed</div>
                <div className="text-2xl font-bold font-mono">₹{Number(claimAmount).toLocaleString()}</div>
                {decision?.approved_amount != null && Number(decision.approved_amount) > 0 && (
                  <div className="text-lg font-semibold text-emerald-700 mt-1">Approved: ₹{Number(decision.approved_amount).toLocaleString()}</div>
                )}
                {status === 'REJECTED' && (
                  <div className="text-lg font-semibold text-red-700 mt-1">Approved: ₹0</div>
                )}
              </div>
            </div>
          </div>

          {/* --- "Why This Decision" Explainability --- */}
          {explanation && (
            <DecisionSummary explanation={explanation} status={status} />
          )}

          {/* --- Quick Stats --- */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardContent className="pt-4 text-center">
              <div className="text-xs text-muted-foreground uppercase mb-1">Confidence</div>
              <div className={`text-2xl font-bold ${Number(decision?.confidence_score) >= 0.9 ? "text-emerald-600" : Number(decision?.confidence_score) >= 0.7 ? "text-amber-600" : "text-red-600"}`}>
                {decision?.confidence_score ? `${(Number(decision.confidence_score) * 100).toFixed(0)}%` : "—"}
              </div>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <div className="text-xs text-muted-foreground uppercase mb-1">Processing</div>
              <div className="text-2xl font-bold">{decision?.processing_time_ms ?? "—"}ms</div>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <div className="text-xs text-muted-foreground uppercase mb-1">Agents Run</div>
              <div className="text-2xl font-bold">{pipeline.length}</div>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <div className="text-xs text-muted-foreground uppercase mb-1">Agents Passed</div>
              <div className="text-2xl font-bold text-emerald-600">{pipeline.filter(s => s.passed).length}/{pipeline.length}</div>
            </CardContent></Card>
          </div>

          {/* --- Confidence Breakdown + Amount Waterfall --- */}
          {explanation && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {explanation.confidence_breakdown && (
                <Card><CardContent className="pt-6">
                  <ConfidenceBreakdownViz breakdown={explanation.confidence_breakdown} />
                </CardContent></Card>
              )}
              {explanation.amount_waterfall?.length > 1 && (
                <Card><CardContent className="pt-6">
                  <AmountWaterfall steps={explanation.amount_waterfall} />
                </CardContent></Card>
              )}
            </div>
          )}

          {/* --- Line Item Breakdown --- */}
          {explanation?.line_items?.length > 0 && (
            <Card><CardContent className="pt-6">
              <LineItemBreakdown items={explanation.line_items} />
            </CardContent></Card>
          )}

          {/* --- Agent Pipeline Reasoning --- */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🤖 Agent Reasoning Pipeline
                <span className="text-sm font-normal text-muted-foreground">({pipeline.length} agents)</span>
              </CardTitle>
              <p className="text-xs text-muted-foreground">Each agent independently analyzed the claim. Click to expand reasoning.</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {pipeline.map((step, i) => {
                const meta = AGENT_META[step.step] || { icon: '⚙️', name: step.step, description: '' };
                const rec = getAgentRecommendation(step);
                const isExpanded = expandedAgents[step.step] ?? false;

                return (
                  <div key={i} className="rounded-lg border bg-card overflow-hidden transition-all hover:shadow-sm">
                    <button
                      className="w-full flex items-center gap-3 p-3.5 text-left hover:bg-muted/30 transition-colors"
                      onClick={() => toggleAgent(step.step)}
                    >
                      <span className="text-xl">{meta.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{meta.name}</span>
                          <span className="text-xs text-muted-foreground hidden sm:inline">— {meta.description}</span>
                        </div>
                      </div>
                      <Badge className={`border text-xs font-bold ${rec.color}`}>{rec.label}</Badge>
                      <span className="text-muted-foreground text-xs">{isExpanded ? '▲' : '▼'}</span>
                    </button>

                    {isExpanded && (
                      <div className="border-t px-4 pb-4 pt-3 space-y-3 bg-muted/10">
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Agent Reasoning</div>
                          <p className="text-sm leading-relaxed">{step.details}</p>
                        </div>

                        {step.reasons.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Rejection Codes</div>
                            <div className="flex gap-1 flex-wrap">
                              {step.reasons.map((r, j) => <Badge key={j} variant="outline" className="text-xs font-mono">{r}</Badge>)}
                            </div>
                          </div>
                        )}

                        {step.adjustments && Object.keys(step.adjustments).length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Adjustments</div>
                            <div className="flex gap-2 flex-wrap">
                              {Object.entries(step.adjustments).map(([k, v]) => (
                                <Badge key={k} variant="secondary" className="text-xs font-mono">
                                  {k}: {typeof v === 'number' ? `₹${v.toLocaleString()}` : JSON.stringify(v)}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* --- Decision Notes --- */}
          {decision?.notes && (
            <Card className="border-blue-200 bg-blue-50"><CardContent className="pt-4">
              <p className="text-sm">💡 <strong>Decision Notes:</strong> {String(decision.notes)}</p>
              {decision.next_steps && <p className="text-sm text-muted-foreground mt-1">➡️ {String(decision.next_steps)}</p>}
            </CardContent></Card>
          )}

          {/* --- Counterfactuals --- */}
          {explanation?.counterfactuals?.length > 0 && (
            <Card><CardContent className="pt-6">
              <CounterfactualsList items={explanation.counterfactuals} />
            </CardContent></Card>
          )}

          {/* --- RAG Context --- */}
          {ragChunks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">📚 RAG Knowledge Context <Badge variant="secondary">{ragChunks.length} chunks</Badge></CardTitle>
                <p className="text-xs text-muted-foreground">Policy knowledge and medical references used for AI decision-making</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {ragChunks.map((chunk: { source: string; category: string; text: string; similarity: number }, i: number) => (
                  <div key={i} className="p-3 rounded-lg bg-muted/40 border text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">{chunk.source}</Badge>
                      <Badge variant="secondary" className="text-xs">{chunk.category}</Badge>
                      <span className="text-xs text-muted-foreground ml-auto font-mono">
                        {typeof chunk.similarity === 'number' ? `${(chunk.similarity * 100).toFixed(0)}% match` : ''}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">{chunk.text}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* --- Policy References --- */}
          {explanation?.policy_references?.length > 0 && (
            <Card><CardContent className="pt-6">
              <PolicyReferences refs={explanation.policy_references} />
            </CardContent></Card>
          )}

          {/* --- View Full Details + Raw JSON (collapsible) --- */}
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => router.push(`/claims/${result.claim_id}`)}>
              View Full Claim Details →
            </Button>
          </div>

          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors py-2">
              🔧 Raw JSON Response (technical)
            </summary>
            <pre className="bg-muted p-4 rounded-lg text-xs overflow-auto max-h-60 mt-2">{JSON.stringify(result, null, 2)}</pre>
          </details>
        </div>
      )}
    </div>
  );
}
