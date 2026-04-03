# Plum OPD Claim Adjudication System

An AI-powered system that automates the adjudication (approval/rejection) of Outpatient Department (OPD) insurance claims. An LLM agent decides what checks to run, queries a policy knowledge base, and synthesizes a final decision — with full explainability and a human-in-the-loop review interface.

Built for Plum's AI Automation Engineer Assignment.

**Live Demo:** [https://plum-claims-production.up.railway.app](https://plum-claims-production.up.railway.app)

---

## Demo — Claim Submission & Agent Decision

https://github.com/user-attachments/assets/4d431d18-7da6-4fbc-8025-6c36c5dd4321

---

## Demo — Policy RAG Chat

https://github.com/user-attachments/assets/15872534-987e-45a6-9597-3a2316e2fe4f

---

## How It Works

A claim comes in (via document upload or structured JSON). The system:

1. **Extracts data** from uploaded medical documents (prescriptions, bills, reports) using OCR
2. **Structures it** into a standard format using an LLM
3. **Retrieves** relevant policy sections from a RAG knowledge base
4. **Runs an AI agent** that autonomously decides which checks to perform and in what order
5. **Produces a decision** with confidence score, line-item breakdown, and natural language explanation

The agent isn't a fixed pipeline — it reasons about each claim individually, calling tools as needed and stopping early when it finds a rejection reason.

---

## Architecture

```
                          CLAIM SUBMISSION
                                |
                +---------------+---------------+
                |                               |
          Form + Documents                 JSON Input
                |                               |
                v                               |
     +---------------------+                    |
     |     OCR Pipeline     |                   |
     |                      |                   |
     |  PDF --> unpdf       |                   |
     |  Image --> tesseract |                   |
     |  Fallback --> Gemini |                   |
     |        Vision        |                   |
     +---------+------------+                   |
               |                                |
               v                                |
     +---------------------+                    |
     |  Groq / Llama 3.3   |                   |
     |  Structured JSON     |                   |
     |  Extraction          |                   |
     +---------+------------+                   |
               |                                |
               +----------> ClaimInput <--------+
                                |
                                v
               +-------------------------------+
               |      RAG Knowledge Base       |
               |   (HuggingFace Embeddings)    |
               |                               |
               |   policy_terms.json (11 chunks)|
               |   adjudication rules (chunked)|
               |   medical knowledge (8 chunks)|
               |   cosine similarity search    |
               +---------------+---------------+
                               |
                               v
     +--------------------------------------------------+
     |              AI AGENT (Groq/Llama)               |
     |                                                  |
     |  The LLM autonomously decides which tools to     |
     |  call and in what order. Available tools:         |
     |                                                  |
     |  lookup_member ........... verify member in DB   |
     |  check_eligibility ....... policy + waiting      |
     |  validate_documents ...... prescription, dr reg  |
     |  check_coverage .......... exclusions, partial   |
     |  calculate_limits ........ copay, sub-limits     |
     |  detect_fraud ............ patterns, frequency   |
     |  assess_medical_necessity  AI + RAG scoring      |
     |  search_policy ........... semantic policy lookup |
     |  make_decision ........... final structured call  |
     |                                                  |
     |  The agent reasons between steps:                |
     |  - If coverage returns PARTIAL, passes adjusted  |
     |    amount to calculate_limits                    |
     |  - If any check returns REJECT, stops early      |
     |  - Searches policy when unsure about a rule      |
     +-------------------------+------------------------+
                               |
                               v
     +--------------------------------------------------+
     |            EXPLAINABILITY ENGINE                 |
     |                                                  |
     |  - Natural language summary                      |
     |  - Amount waterfall (claim -> deductions -> net) |
     |  - Line item breakdown (approved vs rejected)    |
     |  - Counterfactual scenarios ("What if...")        |
     |  - Confidence breakdown (rule vs AI)             |
     |  - Policy section references                     |
     +-------------------------+------------------------+
                               |
                 +-------------+-------------+
                 |                           |
                 v                           v
           Turso DB                   User Interface
           (Audit trail)          (Dashboard, Detail, Appeal)
                                              |
                                              v
                                  +---------------------+
                                  | Human-in-the-Loop   |
                                  | Review Interface     |
                                  +---------------------+
```

### Decision Flow

```
Claim --> [Eligible?] ----no----> REJECTED
               |
              yes
               v
         [Docs valid?] ---no----> REJECTED
               |
              yes
               v
         [Covered?] ---excluded-> REJECTED
               |       --partial-> PARTIAL (some items excluded)
              yes
               v
         [Within limits?] -over-> REJECTED
               |
              yes (copay + network discount applied)
               v
         [Fraud?] --------yes---> MANUAL_REVIEW
               |
              no
               v
         [Medically necessary?] -> low score -> MANUAL_REVIEW
               |
             high
               v
          APPROVED
```

---

## Tech Stack

| Layer | Technology | Why this choice |
|-------|-----------|-----------------|
| **Framework** | Next.js 16, React 19, TypeScript | App Router with server/client components. API routes serve as backend. |
| **Styling** | Tailwind CSS v4, shadcn/ui | Rapid UI development with consistent design tokens. |
| **AI Agent** | Groq + Llama 3.3 70B (via Vercel AI SDK) | Free, fast inference. The Vercel AI SDK provides a clean tool-calling abstraction for the agentic loop. Groq's speed makes multi-step agent execution practical. |
| **OCR** | unpdf + tesseract.js + Gemini Vision fallback | `unpdf` handles digital PDFs (free, instant). `tesseract.js` handles printed images (free, local). Gemini Vision only fires for handwritten/blurry docs — keeps API costs near zero. |
| **Embeddings** | HuggingFace transformers.js (all-MiniLM-L6-v2) | Runs entirely on CPU, no API key needed. 384-dim vectors with good quality. Model downloads once (~23MB), then works offline. |
| **Text Generation** | Groq / Llama 3.3 70B | Used for structured extraction from OCR text, medical review with RAG context, and policy Q&A. Free tier with key rotation for rate limits. |
| **Database** | Turso (libSQL) + Drizzle ORM | Serverless SQLite — zero config, works locally and in cloud. Drizzle gives type-safe queries. |
| **PDF Generation** | PDFKit | Generates sample medical documents for testing the pipeline. |

### Why a hybrid OCR approach?

Medical documents come in many forms — clean digital PDFs, printed bills, handwritten prescriptions, blurry photos. No single tool handles all of these well:

- **Digital PDFs** (most common): `unpdf` extracts embedded text instantly, no API call needed
- **Printed images**: `tesseract.js` runs OCR locally — free and fast for clean text
- **Hard cases** (handwritten, blurry, multilingual): Gemini Vision handles these well, but we only call it when local OCR confidence is below 55% or extracted text is too short

This means ~80% of claims use zero API quota for OCR.

### Why local embeddings instead of an API?

The RAG knowledge base is small (~30 chunks of policy terms, rules, and medical knowledge). Using a local embedding model means:
- No API key needed for RAG to work
- No rate limits on embedding queries
- The agent can call `search_policy` as many times as it needs without cost

---

## Setup

### Prerequisites

- Node.js 18+
- A Groq API key (free — [get one here](https://console.groq.com/keys))
- Optional: A Gemini API key for handwritten document OCR fallback ([get one here](https://aistudio.google.com/apikey))

### Installation

```bash
cd plum-claims
npm install
```

### Environment Variables

Create a `.env.local` file:

```bash
# Required — powers the AI agent, extraction, and medical review
GROQ_API_KEY=gsk_your_key_here

# Optional — additional keys for rate limit rotation
GROQ_API_KEY_2=gsk_second_key
GROQ_API_KEY_3=gsk_third_key

# Optional — switches between models (default: llama-3.1-8b-instant)
# Use llama-3.3-70b-versatile for best quality
GROQ_MODEL=llama-3.3-70b-versatile

# Optional — enables Gemini Vision fallback for hard OCR cases
GEMINI_API_KEY=your_gemini_key_here

# Database — Turso cloud or local SQLite
TURSO_DATABASE_URL=libsql://your-db.turso.io   # or file:local.db for local
TURSO_AUTH_TOKEN=your_turso_token
```

> The system works without a Gemini key — local OCR handles most documents. Without a Groq key, the full rule engine still runs but without AI extraction or the agentic loop.

### Database Setup

```bash
npm run db:push    # Push schema to database
```

### Run

```bash
npm run dev
```

Open [http://localhost:3737](http://localhost:3737).

---

## Testing

### Generate Sample Documents

The project includes a document generator that creates realistic medical PDFs matching Indian healthcare formats:

```bash
npx tsx scripts/generate-test-docs.ts
```

This creates 5 test documents in `scripts/test-docs/`.

Pre-made test images are also available in `public/test-documents/` (`prescription_tc001.png`, `bill_tc001.png`, `dental_tc002.png`) — these can be uploaded directly via the Submit Claim UI.

Generated PDFs:

| Doc | Scenario | What it tests |
|-----|----------|--------------|
| `01_consultation_viral_fever.pdf` | Standard consultation + CBC + medicines | Happy path — full approval with copay |
| `02_dental_with_cosmetic.pdf` | Root canal + teeth whitening | Cosmetic exclusion detection, partial coverage, per-claim limits |
| `03_diabetes_checkup.pdf` | Diabetes follow-up with 6 diagnostic tests | Heavy diagnostics, pre-existing condition handling |
| `04_weight_loss_excluded.pdf` | Bariatric consultation + diet plan | Policy exclusion (weight loss), supplement exclusion |
| `05_pharmacy_branded_drugs.pdf` | Pharmacy-only bill with branded drugs | Branded vs generic drug copay |

### Submit a Test Claim

```bash
curl -X POST http://localhost:3737/api/claims \
  -F "member_id=EMP001" -F "member_name=Rajesh Kumar" \
  -F "treatment_date=2025-03-15" -F "claim_amount=2045" \
  -F "documents=@scripts/test-docs/01_consultation_viral_fever.pdf"
```

### Test Results

End-to-end results with the full pipeline (OCR + Groq extraction + agentic adjudication):

| # | Document | Expected | Actual Result | Details |
|---|----------|----------|---------------|---------|
| 1 | Viral fever consultation | Approve | **APPROVED ₹1,635** | Copay and network discounts applied correctly |
| 2 | Dental + cosmetic whitening | Partial/Reject | **REJECTED** | Correctly identified cosmetic whitening as excluded (₹4,000 removed), remaining ₹13,300 exceeded dental per-claim limit |
| 3 | Diabetes checkup | Approve | **APPROVED** (with 70B model) | 8B model fails on structured JSON extraction — use `llama-3.3-70b-versatile` for production |
| 4 | Weight loss program | Reject | Agent correctly decided REJECT | Agent identified weight loss as excluded treatment |
| 5 | Pharmacy branded drugs | Approve with copay | **APPROVED ₹999** | 10% copay correctly applied on ₹1,110 claim |

> **Note on model choice**: The `llama-3.3-70b-versatile` model handles all 5 documents correctly. The `llama-3.1-8b-instant` model (default, higher rate limits) occasionally fails on structured JSON extraction. Set `GROQ_MODEL=llama-3.3-70b-versatile` in `.env.local` for best results.

### Rule Engine Test Cases

Visit [http://localhost:3737/test-runner](http://localhost:3737/test-runner) to run all 30 built-in test cases that validate the deterministic rule engine.

#### Original 10 (TC001-TC010)

| ID | Scenario | Expected | Validates |
|----|----------|----------|-----------|
| TC001 | Simple consultation (fever) | APPROVED, ₹1,350 | Co-pay deduction (10%) |
| TC002 | Root canal + teeth whitening | PARTIAL, ₹8,000 | Cosmetic exclusion |
| TC003 | Gastroenteritis, ₹7,500 | REJECTED | Per-claim limit (₹5,000) |
| TC004 | Missing prescription | REJECTED | Document validation |
| TC005 | Diabetes within 90 days | REJECTED | Specific ailment waiting period |
| TC006 | Ayurvedic treatment | APPROVED, ₹4,000 | Alternative medicine coverage |
| TC007 | MRI without pre-auth | REJECTED | Pre-authorization required |
| TC008 | 3 claims same day | MANUAL_REVIEW | Fraud detection |
| TC009 | Weight loss treatment | REJECTED | Policy exclusion |
| TC010 | Apollo Hospital cashless | APPROVED, ₹3,600 | Network discount (20%) |

#### Additional 20 (TC011-TC030)

| ID | Scenario | Expected | Validates |
|----|----------|----------|-----------|
| TC011 | Pharmacy for respiratory infection | APPROVED, ₹1,980 | General claim copay |
| TC012 | Invalid doctor registration format | REJECTED | DOCTOR_REG_INVALID |
| TC013 | Prescription missing diagnosis | REJECTED | INVALID_PRESCRIPTION |
| TC014 | Infertility treatment (IVF) | REJECTED | SERVICE_NOT_COVERED (exclusion) |
| TC015 | Vision/myopia eye checkup | APPROVED, ₹4,500 | Vision sub-limit, no copay |
| TC016 | Experimental clinical trial | REJECTED | SERVICE_NOT_COVERED (exclusion) |
| TC017 | Hypertension within 90-day wait | REJECTED | WAITING_PERIOD (specific ailment) |
| TC018 | Sinusitis at Fortis (network) | APPROVED, ₹2,400 | Network discount, no copay |
| TC019 | Missing bill/receipt | REJECTED | MISSING_DOCUMENTS |
| TC020 | ₹28,000 dental claim | MANUAL_REVIEW | High-value fraud flag |
| TC021 | Alcoholism treatment | REJECTED | SERVICE_NOT_COVERED (exclusion) |
| TC022 | Dental filling for cavity | APPROVED, ₹3,500 | Dental sub-limit, no copay |
| TC023 | CT scan without pre-auth | REJECTED | PRE_AUTH_MISSING |
| TC024 | Claim within initial 30-day wait | REJECTED | WAITING_PERIOD (initial) |
| TC025 | Homeopathy for eczema | APPROVED, ₹3,000 | Alt medicine sub-limit |
| TC026 | ₹400 claim (below minimum) | REJECTED | BELOW_MIN_AMOUNT |
| TC027 | Exactly ₹5,000 claim | MANUAL_REVIEW | Limit boundary fraud flag |
| TC028 | Extraction + botox | PARTIAL, ₹5,000 | Cosmetic partial exclusion |
| TC029 | Cashless at Max Healthcare | APPROVED, ₹2,800 | Network cashless + discount |
| TC030 | Unknown member ID | REJECTED | MEMBER_NOT_COVERED |

```bash
npx tsx scripts/run-tests.ts
```

---

## What Makes This Agentic

This is not a fixed pipeline with LLM calls bolted on. The AI agent:

- **Decides its own workflow**: The LLM chooses which tools to call based on the claim. A simple fever consultation might need 5 tool calls. A complex dental claim with cosmetic items triggers policy searches, coverage checks, and careful limit calculations — 10+ tool calls.

- **Reasons between steps**: When coverage returns `PARTIAL` with an adjusted amount, the agent passes that adjusted amount to `calculate_limits` (not the original claim amount). When a check returns `REJECT`, it stops processing and calls `make_decision` immediately.

- **Searches for knowledge**: The agent can query the policy knowledge base at any point using `search_policy`. It does this when it's unsure about a rule — for example, searching for "dental exclusions" before making a coverage decision.

- **Falls back gracefully**: If the agent fails (rate limit, timeout, malformed response), the system falls back to a deterministic 6-step pipeline that applies the same rules without LLM reasoning.

The deterministic pipeline acts as both a fallback and a set of tools for the agent. Each rule-engine function (`checkEligibility`, `validateDocuments`, etc.) serves double duty — callable directly in the pipeline or as an agent tool.

---

## Pages

| Page | URL | Description |
|------|-----|-------------|
| Dashboard | `/` | Claims list with metrics, approval rates, rejection reasons |
| Submit Claim | `/submit` | Upload documents or paste JSON to submit a new claim |
| Claim Detail | `/claims/[id]` | Full explainability — amount waterfall, line items, agent reasoning, counterfactuals |
| Policy Explorer | `/policy` | Natural language Q&A about the insurance policy (RAG-powered) |
| Test Runner | `/test-runner` | Run and visualize all 30 rule-engine test cases |
| Settings | `/settings` | Configure API keys at runtime |

---

## Project Structure

```
src/
  lib/
    ai/
      agent.ts ............... Agentic adjudication (Groq/Llama + tool calling)
      groq.ts ................ Groq client with key rotation
      ocr.ts ................. Hybrid OCR (unpdf + tesseract + Gemini fallback)
      extract.ts ............. Document extraction + medical review
      rag.ts ................. In-memory vector store (HuggingFace embeddings)
      prompts.ts ............. Prompt templates with few-shot examples
      gemini.ts .............. Gemini Vision client (OCR fallback only)
    engine/
      pipeline.ts ............ Deterministic 6-step adjudication pipeline
      eligibility.ts ......... Policy status, waiting periods
      documents.ts ........... Prescription, doctor registration validation
      coverage.ts ............ Exclusions, partial coverage, pre-auth
      limits.ts .............. Per-claim limits, copay, network discounts
      fraud.ts ............... Same-day frequency, high-value detection
      medical-review.ts ...... AI medical necessity scoring
      explainability.ts ...... Decision explanations, counterfactuals
    db/
      schema.ts .............. Drizzle schema (members + claims tables)
      seed.ts ................ Seed 30 test members
  app/
    api/claims/route.ts ...... Main claim submission + listing endpoint
    api/rag/ask/route.ts ..... Policy Q&A endpoint
    submit/page.tsx .......... Claim submission UI
    claims/[id]/page.tsx ..... Claim detail + review UI
```

---

## Key Design Decisions

**Category-aware per-claim limits**: The general per-claim limit is ₹5,000, but dental (₹10K), diagnostic (₹10K), and alternative medicine (₹8K) have their own sub-limits. This lets a ₹8,000 dental claim pass while a ₹7,500 general claim is rejected.

**Copay on general claims only**: The 10% copay applies to consultation-type claims, not specialty categories. This correctly produces ₹1,350 for a ₹1,500 fever consultation and ₹4,000 for an ₹4,000 Ayurvedic treatment.

**Confidence blending**: Final confidence = 60% rule engine clarity + 40% AI medical score. Below 70% triggers MANUAL_REVIEW regardless of the rule engine's decision.

**Groq key rotation**: The system supports up to 3 Groq API keys (`GROQ_API_KEY`, `_2`, `_3`). On a 429 rate limit, it automatically rotates to the next key and retries. This effectively 3x's the free tier.

---

## Cloud Deployment

The app is deployed on Railway (chosen over Vercel because the agentic loop needs 15-30s per claim — Vercel's free tier has a 10s timeout on serverless functions).

| Component | Service | Details |
|-----------|---------|---------|
| App | Railway | Next.js 16, persistent Node.js process (no timeout limits) |
| Database | Turso | Cloud SQLite with 30 seeded members |
| LLM | Groq | LLaMA 3.3 70B (extraction, medical review, agentic orchestration) |
| OCR Fallback | Google Gemini | 2.5 Flash Vision for handwritten/low-quality docs |
| Embeddings | In-memory | MiniLM-L6-v2 loads on cold start (~5-10s first request) |
| RAG | In-memory | Knowledge base rebuilt from source files on startup |

Environment variables on Railway: `GROQ_API_KEY`, `GROQ_MODEL`, `GEMINI_API_KEY`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`

---

## Assumptions

1. **30 pre-seeded members** (EMP001-EMP030). Production would integrate with HR/policy systems.
2. **YTD tracking** defaults to 0. Production would calculate from historical claims.
3. **Doctor registration** is format-validated only (StateCode/Number/Year), not verified against an external registry.
4. **Network hospital matching** uses substring match. Production would use a provider ID lookup.
5. **Single policy** — operates against `policy_terms.json`. Multi-policy support would require policy selection at submission.
