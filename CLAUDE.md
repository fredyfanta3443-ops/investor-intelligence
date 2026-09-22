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
| Chat LLM | **Groq** (`langchain-groq`, model `openai/gpt-oss-20b`) | Free API key, fast hosted inference. `qwen/qwen3-32b` (the original reference project's model) no longer exists in Groq's catalog — models were swapped once, then again after hitting the 8000 tokens/minute free-tier cap (which turned out to be an account-wide limit, not model-specific, so the smaller model was kept) |
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

## RAG retrieval — real bugs found and fixed

`vectorstore/azure_ai_search.py`'s `Retriever` originally did keyword-only search,
never actually using the `content_vector` field despite it being embedded and
indexed — fixed by adding a `VectorizedQuery` for hybrid search (`Retriever` now
takes an `embeddings` model). `ingestion/semantic_chunker.py`'s default percentile
threshold produced huge chunks (up to 22K chars) on dense 10-Ks, both blowing
Groq's rate limit and diluting relevance — `breakpoint_threshold_amount=70` gives
~850-char chunks instead. `rag/kpi_extractor_rag.py` uses per-category targeted
retrieval (income statement / balance sheet / cash flow / risks / growth) rather
than one broad query, since a single query diluted across topics tends to surface
a table of contents instead of the actual figures.

## Frontend structure (deviated from the original plan)

Originally planned as separate `/`, `/upload`, `/chat` routes; ended up as a single
dashboard page instead, per direct feedback that navigating away to upload/chat was
unnecessary friction. Upload is an in-page dialog; chat is a floating help-bubble
widget (Intercom-style, bottom-right, mounted globally in `App.tsx`) rather than a
page. Risk factors / growth drivers were initially hidden behind a per-card dialog
button — moved to an always-visible `QualitativeInsights` section after user
feedback that it was easy to miss entirely.

## Forecasting (Part B) — status

`forecasting/` has four tiers behind a common `ForecastResult` interface (see
`forecasting/schema.py`): `basic` (linear trend), `statistical` (Holt's exponential
smoothing), `ml` (Random Forest over lag + time-index features — documented,
verified limitation: tree ensembles can't extrapolate past the observed value
range, so this tier's multi-year forecasts flatten on a trending series, unlike
tiers 1-2), `deep_learning` (a real, not stubbed, small LSTM — gated behind a
minimum-history threshold our current data doesn't meet, so it correctly raises
`InsufficientDataError` rather than training on a handful of points). Exposed via
`GET /api/forecast?company=&kpi=&model=&horizon=`, surfaced on the dashboard as
`ForecastPanel` (Recharts line chart, solid=historical / dashed=forecast).

Historical data: ingested 2020-2024 10-Ks for Apple/Microsoft/Tesla (15 company-years
in Cosmos DB) via SEC EDGAR (public, free) + headless-Chrome htm→PDF rendering, using
the existing ingestion pipeline unmodified. **Data quality varies by company** —
Microsoft and Tesla's extracted figures were cross-checked against real filings and
are accurate; Apple's 2020-2021 revenue/net_income came back wrong (retrieval issue
specific to how older Apple 10-Ks chunk/match, not yet root-caused) and were nulled
out rather than left wrong — Apple's forecast series is thinner as a result until
that's investigated. Known minor cleanup item: a failed-then-retried ingestion of
2022_Apple left ~309 duplicate vector chunks in the Azure Search index (doesn't
affect KPI data, just index storage on the free F0 tier).

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
