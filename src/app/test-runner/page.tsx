"use client";
import { useState, useEffect, Fragment } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface TestCase { case_id: string; case_name: string; description: string; input_data: any; expected_output: any; }

interface TestResult {
  case_id: string;
  case_name: string;
  passed: boolean;
  expected_decision: string;
  actual_decision: string;
  expected_amount?: number;
  actual_amount: number;
  expected_reasons?: string[];
  actual_reasons: string[];
  details: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  decision: Record<string, any>;
}

const DECISION_COLORS: Record<string, string> = {
  APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-red-100 text-red-800",
  PARTIAL: "bg-amber-100 text-amber-800",
  MANUAL_REVIEW: "bg-orange-100 text-orange-800",
};

export default function TestRunner() {
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [loading, setLoading] = useState(false);
  const [runningCase, setRunningCase] = useState<string | null>(null);
  const [summary, setSummary] = useState({ total: 0, passed: 0, failed: 0 });
  const [expandedCase, setExpandedCase] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  // Load test cases from the JSON file on mount
  useEffect(() => {
    fetch("/test_cases.json")
      .then(r => r.json())
      .then(data => setTestCases(data.test_cases || []))
      .catch(() => {
        // Fallback: try to get from the data directory or inline
        fetch("/api/test-cases?list=true")
          .then(r => r.json())
          .then(data => setTestCases(data.test_cases || []))
          .catch(() => {});
      });
  }, []);

  async function runAllTests() {
    setLoading(true);
    setResults({});
    try {
      const res = await fetch("/api/test-cases");
      const data = await res.json();
      const resultMap: Record<string, TestResult> = {};
      for (const r of (data.results || [])) {
        resultMap[r.case_id] = r;
      }
      setResults(resultMap);
      setSummary({ total: data.total, passed: data.passed, failed: data.failed });
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  }

  async function runSingleTest(tc: TestCase) {
    setRunningCase(tc.case_id);
    try {
      const res = await fetch("/api/test-cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tc.input_data),
      });
      const data = await res.json();
      const decision = data.decision;
      const expected = tc.expected_output;
      const passed = decision.decision === expected.decision &&
        (expected.approved_amount === undefined || decision.approved_amount === expected.approved_amount);
      const result: TestResult = {
        case_id: tc.case_id,
        case_name: tc.case_name,
        passed,
        expected_decision: expected.decision,
        actual_decision: decision.decision,
        expected_amount: expected.approved_amount,
        actual_amount: decision.approved_amount,
        expected_reasons: expected.rejection_reasons,
        actual_reasons: decision.rejection_reasons || [],
        details: passed ? "Test passed" : `Expected ${expected.decision}${expected.approved_amount ? ` (₹${expected.approved_amount})` : ""}, got ${decision.decision} (₹${decision.approved_amount})`,
        decision,
      };
      setResults(prev => ({ ...prev, [tc.case_id]: result }));
      // Update summary
      const allResults = { ...results, [tc.case_id]: result };
      const resultValues = Object.values(allResults);
      setSummary({
        total: resultValues.length,
        passed: resultValues.filter(r => r.passed).length,
        failed: resultValues.filter(r => !r.passed).length,
      });
    } catch (err) {
      console.error(err);
    } finally { setRunningCase(null); }
  }

  const hasResults = Object.keys(results).length > 0;

  function formatAmount(amount: number) {
    return `₹${amount?.toLocaleString()}`;
  }

  function renderInputSummary(tc: TestCase) {
    const d = tc.input_data;
    const docs = d.documents || {};
    return (
      <div className="text-xs space-y-1.5 text-muted-foreground">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <span><span className="font-medium text-foreground">Patient:</span> {d.member_name}</span>
          <span><span className="font-medium text-foreground">Amount:</span> {formatAmount(d.claim_amount)}</span>
          <span><span className="font-medium text-foreground">Date:</span> {d.treatment_date}</span>
          {d.hospital && <span><span className="font-medium text-foreground">Hospital:</span> {d.hospital}</span>}
        </div>
        {docs.prescription && (
          <div className="border-t pt-1.5 mt-1.5">
            <span className="font-medium text-foreground">Prescription:</span>{" "}
            Dr. {docs.prescription.doctor_name} ({docs.prescription.doctor_reg}) — {docs.prescription.diagnosis || "No diagnosis"}
            {docs.prescription.medicines_prescribed && (
              <span className="block ml-2">💊 {docs.prescription.medicines_prescribed.join(", ")}</span>
            )}
            {docs.prescription.procedures && (
              <span className="block ml-2">🔧 {docs.prescription.procedures.join(", ")}</span>
            )}
            {docs.prescription.tests_prescribed && (
              <span className="block ml-2">🔬 {docs.prescription.tests_prescribed.join(", ")}</span>
            )}
          </div>
        )}
        {docs.bill && (
          <div className="border-t pt-1.5 mt-1.5">
            <span className="font-medium text-foreground">Bill items:</span>{" "}
            {Object.entries(docs.bill).map(([k, v]) => `${k.replace(/_/g, " ")}: ₹${v}`).join(", ")}
          </div>
        )}
        {!docs.prescription && !docs.bill && (
          <div className="border-t pt-1.5 mt-1.5 text-amber-600">⚠️ No documents attached</div>
        )}
        {d.previous_claims_same_day && (
          <div className="text-amber-600">⚠️ {d.previous_claims_same_day} previous claims on same day</div>
        )}
        {d.cashless_request && <div>💳 Cashless request</div>}
      </div>
    );
  }

  function renderExpected(tc: TestCase) {
    const exp = tc.expected_output;
    return (
      <div className="text-xs space-y-1">
        <div className="flex items-center gap-2">
          <Badge className={`${DECISION_COLORS[exp.decision] || ""} text-xs`}>{exp.decision}</Badge>
          {exp.approved_amount !== undefined && <span className="font-mono font-medium">{formatAmount(exp.approved_amount)}</span>}
        </div>
        {exp.rejection_reasons && (
          <div className="text-red-600">Reasons: {exp.rejection_reasons.join(", ")}</div>
        )}
        {exp.rejected_items && (
          <div className="text-amber-600">Excluded: {exp.rejected_items.join(", ")}</div>
        )}
        {exp.deductions && Object.keys(exp.deductions).length > 0 && (
          <div>Deductions: {Object.entries(exp.deductions).map(([k, v]) => `${k}: ₹${v}`).join(", ")}</div>
        )}
        {exp.notes && <div className="italic">{exp.notes}</div>}
        {exp.flags && <div className="text-orange-600">🚩 {exp.flags.join(", ")}</div>}
        <div className="text-muted-foreground">Confidence: {((exp.confidence_score || 0) * 100).toFixed(0)}%</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Test Runner</h1>
          <p className="text-muted-foreground text-sm">
            {testCases.length} test cases loaded — review inputs &amp; expected outputs, then run individually or all at once
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border rounded-md overflow-hidden text-sm">
            <button onClick={() => setViewMode("cards")} className={`px-3 py-1.5 ${viewMode === "cards" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}>Cards</button>
            <button onClick={() => setViewMode("table")} className={`px-3 py-1.5 ${viewMode === "table" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}>Table</button>
          </div>
          <Button onClick={runAllTests} disabled={loading} size="lg">
            {loading ? "Running..." : "▶ Run All Tests"}
          </Button>
        </div>
      </div>

      {/* Summary (shown when tests have been run) */}
      {hasResults && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total Run</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold">{summary.total}</div></CardContent></Card>
            <Card className="border-green-200"><CardHeader className="pb-2"><CardTitle className="text-sm text-green-600">Passed</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold text-green-600">{summary.passed}</div></CardContent></Card>
            <Card className={summary.failed > 0 ? "border-red-200" : "border-green-200"}>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-red-600">Failed</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold text-red-600">{summary.failed}</div></CardContent></Card>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div className="bg-green-500 h-3 rounded-full transition-all" style={{ width: `${summary.total > 0 ? (summary.passed / summary.total) * 100 : 0}%` }} />
          </div>
        </>
      )}

      {/* Card View */}
      {viewMode === "cards" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {testCases.map(tc => {
            const result = results[tc.case_id];
            const isRunning = runningCase === tc.case_id;
            const isExpanded = expandedCase === tc.case_id;
            return (
              <Card key={tc.case_id} className={`transition-all ${result ? (result.passed ? "border-green-300 bg-green-50/30" : "border-red-300 bg-red-50/30") : "hover:border-primary/30"}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{tc.case_id}</span>
                      {result && <span>{result.passed ? "✅" : "❌"}</span>}
                    </div>
                    <Button size="sm" variant={result ? "ghost" : "outline"} disabled={isRunning || loading}
                      onClick={() => runSingleTest(tc)} className="h-7 text-xs">
                      {isRunning ? "Running..." : result ? "Re-run" : "▶ Run"}
                    </Button>
                  </div>
                  <CardTitle className="text-sm leading-tight">{tc.case_name}</CardTitle>
                  <p className="text-xs text-muted-foreground">{tc.description}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Input Summary */}
                  <div>
                    <button onClick={() => setExpandedCase(isExpanded ? null : tc.case_id)}
                      className="text-xs font-medium text-primary hover:underline flex items-center gap-1 mb-1">
                      {isExpanded ? "▼" : "▶"} Input Details
                    </button>
                    {isExpanded && (
                      <div className="bg-muted/50 rounded-lg p-2.5 border">
                        {renderInputSummary(tc)}
                      </div>
                    )}
                  </div>

                  {/* Expected Output */}
                  <div>
                    <p className="text-xs font-medium mb-1">Expected Output:</p>
                    <div className="bg-muted/50 rounded-lg p-2.5 border">
                      {renderExpected(tc)}
                    </div>
                  </div>

                  {/* Actual Result (after running) */}
                  {result && (
                    <div>
                      <p className="text-xs font-medium mb-1">Actual Result:</p>
                      <div className={`rounded-lg p-2.5 border text-xs space-y-1 ${result.passed ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                        <div className="flex items-center gap-2">
                          <Badge className={`${DECISION_COLORS[result.actual_decision] || ""} text-xs`}>{result.actual_decision}</Badge>
                          <span className="font-mono font-medium">{formatAmount(result.actual_amount)}</span>
                        </div>
                        {result.actual_reasons.length > 0 && (
                          <div className="text-red-600">Reasons: {result.actual_reasons.join(", ")}</div>
                        )}
                        <p className="text-muted-foreground">{result.details}</p>
                        <button onClick={() => setExpandedCase(expandedCase === tc.case_id + "_detail" ? null : tc.case_id + "_detail")}
                          className="text-primary hover:underline text-xs">
                          {expandedCase === tc.case_id + "_detail" ? "Hide" : "Show"} full pipeline output
                        </button>
                        {expandedCase === tc.case_id + "_detail" && (
                          <pre className="bg-white p-2 rounded text-xs overflow-auto max-h-48 border">
                            {JSON.stringify(result.decision, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Table View */}
      {viewMode === "table" && (
        <Card>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead className="w-20">ID</TableHead>
                  <TableHead>Scenario</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Expected</TableHead>
                  <TableHead>Actual</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {testCases.map(tc => {
                  const result = results[tc.case_id];
                  const isRunning = runningCase === tc.case_id;
                  const isExpanded = expandedCase === tc.case_id;
                  return (
                    <Fragment key={tc.case_id}>
                      <TableRow key={tc.case_id} className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setExpandedCase(isExpanded ? null : tc.case_id)}>
                        <TableCell>{result ? (result.passed ? "✅" : "❌") : "⬜"}</TableCell>
                        <TableCell className="font-mono text-xs">{tc.case_id}</TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">{tc.case_name}</div>
                          <div className="text-xs text-muted-foreground">{tc.description}</div>
                        </TableCell>
                        <TableCell className="text-sm">{tc.input_data.member_name}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{formatAmount(tc.input_data.claim_amount)}</TableCell>
                        <TableCell>
                          <Badge className={`${DECISION_COLORS[tc.expected_output.decision] || ""} text-xs`}>
                            {tc.expected_output.decision}
                          </Badge>
                          {tc.expected_output.approved_amount !== undefined && (
                            <span className="block text-xs font-mono mt-0.5">{formatAmount(tc.expected_output.approved_amount)}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {result ? (
                            <>
                              <Badge className={`${result.passed ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"} text-xs`}>
                                {result.actual_decision}
                              </Badge>
                              <span className="block text-xs font-mono mt-0.5">{formatAmount(result.actual_amount)}</span>
                            </>
                          ) : <span className="text-xs text-muted-foreground">Not run</span>}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" disabled={isRunning || loading}
                            onClick={(e) => { e.stopPropagation(); runSingleTest(tc); }} className="h-7 text-xs">
                            {isRunning ? "..." : "▶"}
                          </Button>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${tc.case_id}-expand`}>
                          <TableCell colSpan={8} className="bg-muted/30">
                            <div className="grid grid-cols-2 gap-4 p-2">
                              <div>
                                <p className="text-xs font-medium mb-1.5">Input Details:</p>
                                <div className="bg-white rounded-lg p-2.5 border">
                                  {renderInputSummary(tc)}
                                </div>
                              </div>
                              <div>
                                <p className="text-xs font-medium mb-1.5">Expected Output:</p>
                                <div className="bg-white rounded-lg p-2.5 border">
                                  {renderExpected(tc)}
                                </div>
                                {result && (
                                  <>
                                    <p className="text-xs font-medium mt-2 mb-1.5">Pipeline Output:</p>
                                    <pre className="bg-white p-2.5 rounded-lg text-xs overflow-auto max-h-48 border">
                                      {JSON.stringify(result.decision, null, 2)}
                                    </pre>
                                  </>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {testCases.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="text-lg mb-2">Loading test cases...</p>
            <p className="text-sm">Make sure test_cases.json is available in the public directory.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
