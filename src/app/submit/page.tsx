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

export default function SubmitClaim() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result, setResult] = useState<Record<string, any> | null>(null);
  const [files, setFiles] = useState<File[]>([]);

  // Form fields
  const [memberId, setMemberId] = useState("EMP001");
  const [memberName, setMemberName] = useState("Rajesh Kumar");
  const [treatmentDate, setTreatmentDate] = useState("2024-11-15");
  const [claimAmount, setClaimAmount] = useState("1500");
  const [hospital, setHospital] = useState("");
  const [cashless, setCashless] = useState(false);
  const [jsonInput, setJsonInput] = useState("");

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
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

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
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

      {/* Result */}
      {result && (
        <Card className={result.error ? "border-red-300" : "border-green-300"}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Result
              {result.status && <Badge className={result.status === "APPROVED" ? "bg-green-100 text-green-800" : result.status === "REJECTED" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}>{String(result.status)}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {result.claim_id && (
              <p className="mb-2">Claim ID: <Button variant="link" className="p-0 h-auto" onClick={() => router.push(`/claims/${result.claim_id}`)}>{String(result.claim_id)}</Button></p>
            )}
            <pre className="bg-muted p-4 rounded-lg text-xs overflow-auto max-h-96">{JSON.stringify(result, null, 2)}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
