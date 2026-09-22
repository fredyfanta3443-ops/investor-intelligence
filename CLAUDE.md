# Investor Intelligence Platform

Reverse-engineered/rebuilt from `AI-Powered-Investor-Intelligence-Platform` (reference clone at
`~/Downloads/AI-Powered-Investor-Intelligence-Platform`), built module by module rather than
copied wholesale, plus a forecasting/ML extension the original never had.

Full build plan: `~/.claude/plans/fuzzy-sniffing-panda.md`

## What it does

Upload a company's annual report (PDF) → convert to Markdown → semantically chunk →
embed + store in a vector index → RAG-extract financial KPIs (Revenue, Net Income, Cash
Flow, Risks, Growth Drivers) → store in a database → dashboard shows latest metrics per
company → chat endpoint answers free-form questions over the ingested reports (RAG).

Extension beyond the original: a tiered forecasting module (basic trend → statistical →
ML → optional deep learning) projecting future KPIs from multi-year history.

## Stack (and why it differs from the original)

The original repo used Azure OpenAI (chat + embeddings) + Azure AI Search + Azure
PostgreSQL. Azure OpenAI has no free tier (pure pay-as-you-go), so the AI layer was
swapped for a free one. The vector store and KPI database ended up staying on Azure,
on resources that are free or already paid for elsewhere:

| Concern | Choice | Why |
|---|---|---|
| Chat LLM | **Groq** (`langchain-groq`, model `qwen/qwen3-32b`) | Free API key, fast hosted inference |
| Embeddings | **local HuggingFace** `sentence-transformers/all-MiniLM-L6-v2` (384 dims) | No API key, runs on-device, no cost |
| Vector store | **Azure AI Search, free F0 tier** (`investor-intel-search-sifat`, rg `investor-intelligence-rg`) | Genuinely free tier (50MB/3 indexes), keeps the original's search-based retrieval shape |
| KPI database | **Azure Cosmos DB (NoSQL API)** — db `investor_intelligence` / container `financial_metrics` (partition key `/company`), inside the existing `multi-agent-rag-cosmos` account | Reuses an existing account rather than creating a new one. Note: that account's free-tier RU/s allowance is already used by another project's containers, so this container (400 RU/s) is a small real ongoing cost (~$20-25/mo) — a known, accepted tradeoff, not actually free |
| PDF → Markdown | `pymupdf4llm` | Same as original |
| Semantic chunking | LangChain `SemanticChunker` | Same as original, different embedding backend |
| Frontend | **React + shadcn/ui** (Vite) | Replaces the original's server-rendered Jinja2 dashboard; `app.py` is a pure JSON API (CORS-enabled) instead of serving templates |

## Data model note (Cosmos vs. the original SQL schema)

The original inserted a new SQL row per ingestion run and picked the latest via
`ROW_NUMBER() OVER (PARTITION BY company, year ORDER BY created_at DESC)`. Cosmos DB
here instead **upserts** with a deterministic id (`{company}_{year}`), so there's
naturally exactly one item per company/year — no dedup-on-read logic needed.

Cosmos DB cross-partition queries with multi-field `ORDER BY` require a composite index
that doesn't exist by default — so `database/metrics.py` sorts client-side in Python
instead of in the query (`SELECT ...` with no `ORDER BY`, `enable_cross_partition_query=True`).

## Environment

Copy `.env.example` to `.env`. Azure Search + Cosmos DB credentials are already
provisioned and filled in `.env` for this project. You still need to add your own
`GROQ_API_KEY` (free at console.groq.com).

## Conventions

- No Claude/AI attribution in commit messages for this project.
- Build order follows the data pipeline: config → DB → PDF parsing → chunking → vector
  store → ingestion orchestration → LLM client → RAG extraction → API routes → app →
  frontend → forecasting extension. See the plan file for the full breakdown.
- Test each module directly against `data/raw_pdfs/` sample data (Apple/Microsoft/Tesla
  2024 10-Ks) as it's built, before moving to the next one.
