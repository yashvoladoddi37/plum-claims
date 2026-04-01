# Plum OPD Claim Adjudication System

An AI-powered system that automates the adjudication (approval/rejection) of Outpatient Department (OPD) insurance claims. Built for Plum's AI Automation Engineer Assignment.

## Architecture

```
                                    CLAIM SUBMISSION
                                          |
                          +---------------+---------------+
                          |                               |
                    Form + File Upload              JSON Input
                          |                               |
                          v                               |
               +--------------------+                     |
               | Gemini Vision API  |                     |
               | (Multimodal LLM)   |                     |
               |                    |                     |
               | - Document parsing |                     |
               | - Data extraction  |                     |
               | - Structured JSON  |                     |
               +--------+-----------+                     |
                        |                                 |
                        +-----------> ClaimInput <--------+
                                          |
                                          v
                            +---------------------------+
                            |   RAG Knowledge Base      |
                            |   (Gemini Embeddings)     |
                            |                           |
                            | - policy_terms.json       |
                            | - adjudication_rules.md   |
                            | - Medical knowledge       |
                            | - Cosine similarity       |
                            +-------------+-------------+
                                          |
                        Retrieved context |
                                          v
              +---------------------------------------------------+
              |            ADJUDICATION PIPELINE                  |
              |                                                   |
              |  Step 1: Eligibility Check                        |
              |    - Policy active? Member covered?               |
              |    - Waiting period satisfied?                    |
              |    - Specific ailment waiting (diabetes, etc.)    |
              |                        |                          |
              |  Step 2: Document Validation                      |
              |    - Prescription present?                        |
              |    - Doctor registration format valid?            |
              |    - Diagnosis present?                           |
              |                        |                          |
              |  Step 3: Coverage Verification                    |
              |    - Exclusion matching (cosmetic, weight loss)   |
              |    - Partial coverage (per-procedure)             |
              |    - Pre-authorization check (MRI, CT)            |
              |                        |                          |
              |  Step 4: Limits Calculation                       |
              |    - Per-claim limit (category-aware)             |
              |    - Annual limit (YTD tracking)                  |
              |    - Network discount (20%)                       |
              |    - Co-pay deduction (10%)                       |
              |                        |                          |
              |  Step 5: Fraud Detection                          |
              |    - Same-day claim frequency                     |
              |    - High-value threshold (>25K)                  |
              |    - Limit boundary patterns                      |
              |                        |                          |
              |  Step 6: AI Medical Necessity Review              |
              |    - Gemini LLM with RAG context                  |
              |    - Diagnosis-treatment alignment                |
              |    - Medical necessity scoring (0-1)              |
              |                                                   |
              +-------------------------+-------------------------+
                                        |
                                        v
              +---------------------------------------------------+
              |              DECISION SYNTHESIS                   |
              |                                                   |
              |  Priority: Fraud > Reject > Partial > Approve     |
              |  Confidence: 60% rule engine + 40% AI score       |
              |  Low confidence (<70%) -> MANUAL_REVIEW            |
              +-------------------------+-------------------------+
                                        |
                                        v
              +---------------------------------------------------+
              |            EXPLAINABILITY ENGINE                  |
              |                                                   |
              |  - Natural language summary                       |
              |  - Amount waterfall (claim -> deductions -> net)  |
              |  - Line item visual diff                          |
              |  - Counterfactual scenarios ("What if...")         |
              |  - Confidence breakdown (rule vs. AI)             |
              |  - Policy section references                      |
              +-------------------------+-------------------------+
                                        |
                          +-------------+-------------+
                          |                           |
                          v                           v
                    SQLite Storage              User Interface
                    (Full audit trail)      (Dashboard, Detail, Appeal)
                                                      |
                                                      v
                                          +---------------------+
                                          | Human-in-the-Loop   |
                                          | Review Interface    |
                                          | (MANUAL_REVIEW)     |
                                          +---------------------+
```

### Decision Flow (Simplified)

```
Claim -> [Eligible?] --no--> REJECTED (POLICY_INACTIVE / WAITING_PERIOD)
              |
             yes
              v
         [Documents valid?] --no--> REJECTED (MISSING_DOCUMENTS / DOCTOR_REG_INVALID)
              |
             yes
              v
         [Treatment covered?] --excluded--> REJECTED (SERVICE_NOT_COVERED)
              |                --partial---> PARTIAL (some items excluded)
             yes
              v
         [Within limits?] --over--> REJECTED (PER_CLAIM_EXCEEDED)
              |
             yes (apply copay + network discount)
              v
         [Fraud indicators?] --yes--> MANUAL_REVIEW
              |
              no
              v
         [AI medical score?] --low--> MANUAL_REVIEW (NOT_MEDICALLY_NECESSARY)
              |
             high
              v
          APPROVED (with deductions applied)
```

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js 16, React 19, TypeScript | App Router, server/client components |
| Styling | Tailwind CSS v4, shadcn/ui | Component library, responsive design |
| AI / LLM | Google Gemini 2.5 Flash | Multimodal document extraction, medical review |
| Embeddings | Gemini text-embedding-004 | RAG vector search |
| Database | SQLite + Drizzle ORM | Claims storage, member records, audit trail |
| Document Processing | Gemini Vision (multimodal) | Direct image/PDF understanding (no OCR) |

### Why Gemini Vision instead of traditional OCR?

Traditional OCR (Tesseract, Google Vision OCR) extracts raw text and requires post-processing pipelines to structure it. Gemini's multimodal API understands document layout, handwriting, stamps, and noisy images natively — extracting structured JSON directly from the visual input. This handles the real-world messiness of medical documents (faded prints, handwritten prescriptions, overlapping stamps) better than an OCR-then-parse pipeline.

## Project Structure

```
src/
  app/
    page.tsx                    # Dashboard — claims list, metrics, charts
    submit/page.tsx             # Claim submission (form + file upload, or JSON)
    claims/[id]/page.tsx        # Claim detail — explainability, review, appeal
    policy/page.tsx             # RAG policy explorer with natural language Q&A
    test-runner/page.tsx        # Test suite runner (all 10 test cases)
    api/
      claims/route.ts           # POST (submit) / GET (list) claims
      claims/[id]/route.ts      # GET single claim
      claims/[id]/appeal/       # POST appeal for rejected/partial claims
      claims/[id]/review/       # POST human review for MANUAL_REVIEW claims
      rag/route.ts              # GET (stats) / POST (semantic search)
      rag/ask/route.ts          # POST natural language Q&A
      test-cases/route.ts       # GET (run all) / POST (run single)
  components/
    ClaimBreakdown.tsx          # Explainability visualizations
    ui/                         # shadcn/ui components
  lib/
    ai/
      gemini.ts                 # Gemini client setup
      extract.ts                # Document extraction + medical review
      prompts.ts                # Prompt templates with few-shot examples
      rag.ts                    # In-memory vector store, chunking, retrieval
    engine/
      pipeline.ts               # Adjudication orchestrator (6 steps)
      eligibility.ts            # Step 1: policy status, waiting periods
      documents.ts              # Step 2: prescription, doctor reg validation
      coverage.ts               # Step 3: exclusions, partial coverage, pre-auth
      limits.ts                 # Step 4: per-claim, annual, copay, network
      fraud.ts                  # Step 5: same-day frequency, high-value
      medical-review.ts         # Step 6: AI medical necessity scoring
      explainability.ts         # Decision explanations, counterfactuals
      test-runner.ts            # Test harness for test_cases.json
    policy/
      terms.ts                  # Typed accessors for policy_terms.json
    db/
      index.ts                  # SQLite initialization
      schema.ts                 # Drizzle schema (members + claims)
      seed.ts                   # Seed 10 test members
    types.ts                    # All TypeScript types
```

## Setup

### Prerequisites

- Node.js 18+
- A Google Gemini API key ([Get one here](https://aistudio.google.com/apikey))

### Installation

```bash
cd plum-claims
npm install
```

### Environment Variables

Create a `.env.local` file:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
```

The system works without an API key — the rule engine runs fully, but AI document extraction and medical review are disabled.

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Run Test Cases

Visit [http://localhost:3000/test-runner](http://localhost:3000/test-runner) and click "Run All Tests" to validate the engine against all 10 provided test cases. Or run from CLI:

```bash
npx tsx scripts/run-tests.ts
```

## How It Works

### 1. Claim Submission

Two input modes:
- **Form + File Upload**: Upload medical document images/PDFs. Gemini Vision extracts structured data (patient info, diagnosis, line items, doctor details) directly from the visual content.
- **JSON Input**: Paste structured claim data for testing or API integration.

### 2. AI Document Processing

When files are uploaded, they are sent to Gemini 2.5 Flash as multimodal input (base64 inline images). The model extracts:
- Patient name, treatment date
- Doctor name, registration number, qualification
- Diagnosis and procedures
- Itemized bill with per-item categorization
- Medical necessity score (0-1) with reasoning
- Flags for excluded items (cosmetic, weight loss, etc.)

The extraction prompt uses few-shot examples and instructs the model to return `null` for unreadable fields (no hallucination).

### 3. RAG-Enhanced Medical Review

Before the medical review LLM call:
1. `policy_terms.json` is chunked into 11 semantic sections
2. `adjudication_rules.md` is chunked by `##`/`###` headers
3. 8 medical knowledge chunks provide domain context
4. All chunks are embedded with `text-embedding-004`
5. The diagnosis + treatment query retrieves top-5 most relevant chunks via cosine similarity
6. Retrieved context is injected into the medical review prompt

This ensures the AI's medical assessment is grounded in the actual policy terms rather than general knowledge.

### 4. Rule Engine Pipeline

Six sequential steps, each producing a structured `StepResult`:

| Step | Checks | Possible Impact |
|------|--------|----------------|
| Eligibility | Policy active, waiting periods, member exists | REJECT |
| Documents | Prescription present, doctor reg format, diagnosis | REJECT |
| Coverage | Exclusions, partial items, pre-authorization | REJECT / PARTIAL |
| Limits | Per-claim, annual, copay, network discount | REJECT / adjust amount |
| Fraud | Same-day frequency, high-value, boundary amounts | MANUAL_REVIEW |
| Medical Review | AI necessity score + RAG context | MANUAL_REVIEW |

The pipeline early-exits on hard REJECT. After all steps, the synthesizer applies priority rules (Fraud > Reject > Partial > Approve) and blends the confidence score (60% rule engine + 40% AI).

### 5. Explainability

Every decision includes:
- **Natural language summary**: "Rajesh's claim of Rs 1,500 for Viral fever has been approved for Rs 1,350 after applicable deductions."
- **Key factors**: Which steps passed/failed and why
- **Amount waterfall**: Visual breakdown of claim -> deductions -> approved
- **Line item diff**: Per-item claimed vs. approved with rejection reasons
- **Counterfactuals**: "If pre-authorization had been obtained, this claim would likely have been approved"
- **Policy references**: Which sections of the policy were evaluated
- **Confidence breakdown**: Rule engine vs. AI component scores

### 6. Human-in-the-Loop

Claims flagged as `MANUAL_REVIEW` present a review interface where a human reviewer can:
- Expand each pipeline step to see its reasoning
- Accept or override individual step recommendations
- Set a final decision (Approve/Reject/Partial) with override amount
- Submit review notes for audit trail

### 7. Appeals

`REJECTED` and `PARTIAL` claims can be appealed by the claimant with:
- Category selection (Documentation, Coverage, Amount, Other)
- Free-text reason (min 10 characters)
- Status transitions to `APPEALED` for human processing

## Test Cases

All 10 provided test cases are implemented and validated:

| ID | Scenario | Expected | Validates |
|----|----------|----------|-----------|
| TC001 | Simple consultation (fever) | APPROVED, Rs 1,350 | Co-pay deduction (10%) |
| TC002 | Root canal + teeth whitening | PARTIAL, Rs 8,000 | Cosmetic exclusion |
| TC003 | Gastroenteritis, Rs 7,500 | REJECTED | Per-claim limit (Rs 5,000) |
| TC004 | Missing prescription | REJECTED | Document validation |
| TC005 | Diabetes within 90 days | REJECTED | Specific ailment waiting period |
| TC006 | Ayurvedic treatment | APPROVED, Rs 4,000 | Alternative medicine coverage |
| TC007 | MRI without pre-auth | REJECTED | Pre-authorization required |
| TC008 | 3 claims same day | MANUAL_REVIEW | Fraud detection |
| TC009 | Weight loss treatment | REJECTED | Policy exclusion |
| TC010 | Apollo Hospital cashless | APPROVED, Rs 3,600 | Network discount (20%) |

## Key Design Decisions

### Category-Aware Per-Claim Limits
The per-claim limit of Rs 5,000 applies to general claims. Category-specific sub-limits (dental Rs 10K, diagnostic Rs 10K, alt medicine Rs 8K) override this when a claim is entirely within that category. This allows TC002 (dental, Rs 8,000) to pass the limits check while TC003 (general, Rs 7,500) is correctly rejected.

### Co-Pay Applies Only to General Claims
The 10% co-pay is under `consultation_fees` in the policy JSON, meaning it applies to general consultation claims only — not to network claims, dental, alternative medicine, or other specialty categories. This correctly produces TC001's Rs 1,350 and TC006's Rs 4,000.

### Confidence Blending
The final confidence score blends deterministic rule clarity (60% weight) with the AI medical necessity score (40% weight). AI-raised flags further reduce confidence by 3% each. If blended confidence drops below 70%, the claim is forced to MANUAL_REVIEW regardless of the rule engine's decision.

### Graceful AI Degradation
If `GEMINI_API_KEY` is not configured, the system runs the full rule engine without AI. The medical review step passes neutrally, and confidence is based on rule engine clarity alone. This means the core adjudication logic works without any external API dependency.

## Assumptions

1. **Member database**: Pre-seeded with 10 test members (EMP001-EMP010). In production, this would integrate with an HR/policy management system.
2. **YTD tracking**: Year-to-date approved amount defaults to 0 for test cases. In production, this would be calculated from historical claims.
3. **Doctor registration validation**: Format-checked only (StateCode/Number/Year). No external registry lookup.
4. **Network hospital matching**: Bidirectional substring match (e.g., "Apollo" matches "Apollo Hospitals"). In production, this would use a provider ID lookup.
5. **Document storage**: File content is not persisted — only extraction results. In production, files would go to cloud storage (S3/GCS) with encryption.
6. **Single policy**: The system operates against one policy configuration (`policy_terms.json`). Multi-policy support would require policy selection at submission time.

## Potential Improvements

- **Late submission check**: Validate `submission_date - treatment_date <= 30 days`
- **Duplicate claim detection**: Query DB for same member + treatment date + similar amount
- **Multi-language support**: Gemini can handle regional language documents; the prompts could be extended
- **Audit log table**: Separate table for all state transitions
- **Webhook notifications**: Notify members on decision via email/SMS
- **Batch processing**: API endpoint for bulk claim submission
- **CI/CD pipeline**: GitHub Actions for lint, type-check, test runner on PR
