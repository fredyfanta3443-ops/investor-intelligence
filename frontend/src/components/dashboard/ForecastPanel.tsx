import { AlertCircle, TrendingUp } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError, fetchForecast, type CompanyMetric, type ForecastResult, type ForecastTier } from '@/lib/api'
import { formatMillions } from '@/lib/format'

const KPI_OPTIONS = [
  { value: 'revenue', label: 'Revenue' },
  { value: 'net_income', label: 'Net Income' },
  { value: 'operating_income', label: 'Operating Income' },
  { value: 'cash_flow', label: 'Cash Flow' },
  { value: 'total_assets', label: 'Total Assets' },
  { value: 'total_liabilities', label: 'Total Liabilities' },
] as const

const TIER_OPTIONS: { value: ForecastTier; label: string; description: string }[] = [
  { value: 'basic', label: 'Basic', description: 'Linear trend' },
  { value: 'statistical', label: 'Statistical', description: "Holt's smoothing" },
  { value: 'ml', label: 'ML', description: 'Random Forest' },
  { value: 'deep_learning', label: 'Deep Learning', description: 'LSTM' },
]

type ChartRow = {
  year: number
  historicalValue: number | null
  forecastValue: number | null
}

function buildChartData(result: ForecastResult): ChartRow[] {
  const rows: ChartRow[] = result.points.map((p) => ({
    year: p.year,
    historicalValue: p.kind === 'historical' ? p.value : null,
    forecastValue: p.kind === 'forecast' ? p.value : null,
  }))

  // Bridge the gap between the two <Line> series so the dashed forecast
  // segment visually connects to the end of the solid historical line
  // instead of starting from a disconnected point.
  const lastHistoricalIndex = [...rows].reverse().findIndex((r) => r.historicalValue !== null)
  const boundaryIndex = lastHistoricalIndex === -1 ? -1 : rows.length - 1 - lastHistoricalIndex
  if (boundaryIndex >= 0 && boundaryIndex < rows.length - 1) {
    rows[boundaryIndex] = { ...rows[boundaryIndex], forecastValue: rows[boundaryIndex].historicalValue }
  }

  return rows
}

interface ChartTooltipProps {
  active?: boolean
  label?: number
  payload?: { dataKey: string; value: number | null }[]
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  const point = payload.find((p) => p.value !== null && p.value !== undefined)
  if (!point) return null
  const isForecast = point.dataKey === 'forecastValue'

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-popover-foreground">FY {label}</p>
      <p className="text-muted-foreground">
        {formatMillions(point.value)} {isForecast && <span className="text-primary">(projected)</span>}
      </p>
    </div>
  )
}

export function ForecastPanel({ metrics }: { metrics: CompanyMetric[] }) {
  const [company, setCompany] = useState(metrics[0]?.company ?? '')
  const [kpi, setKpi] = useState<string>('revenue')
  const [tier, setTier] = useState<ForecastTier>('basic')
  const [result, setResult] = useState<ForecastResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Until the user explicitly picks a company, an "insufficient data" error
  // auto-advances to the next company instead of dead-ending on whichever
  // one happened to load first (e.g. the alphabetically-first company may
  // simply have thinner history than the others for the default KPI).
  const userPickedCompany = useRef(false)
  const triedCompanies = useRef(new Set<string>())

  useEffect(() => {
    if (!metrics.some((m) => m.company === company)) {
      setCompany(metrics[0]?.company ?? '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metrics])

  useEffect(() => {
    // A new KPI/tier may be satisfiable by a company already ruled out for
    // the previous one — give auto-advance a fresh set of candidates.
    triedCompanies.current = new Set()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kpi, tier])

  useEffect(() => {
    if (!company) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setResult(null)

    fetchForecast({ company, kpi, model: tier })
      .then((data) => {
        if (!cancelled) setResult(data)
      })
      .catch((err) => {
        if (cancelled) return

        if (!userPickedCompany.current) {
          triedCompanies.current.add(company)
          const next = metrics.find((m) => !triedCompanies.current.has(m.company))
          if (next) {
            setCompany(next.company)
            return
          }
        }

        setError(err instanceof ApiError ? err.message : 'Could not generate a forecast.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company, kpi, tier])

  const handleCompanyChange = (value: string) => {
    userPickedCompany.current = true
    setCompany(value)
  }

  const chartData = useMemo(() => (result ? buildChartData(result) : []), [result])
  const boundaryYear = useMemo(() => {
    const historical = result?.points.filter((p) => p.kind === 'historical') ?? []
    return historical.length > 0 ? historical[historical.length - 1].year : null
  }, [result])

  if (metrics.length === 0) return null

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-1.5 text-base font-semibold text-foreground">
            <TrendingUp className="size-4 text-primary" />
            Forecast
          </h2>
          <p className="text-sm text-muted-foreground">
            Project future KPIs from historical filings.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={company} onValueChange={handleCompanyChange}>
            <SelectTrigger size="sm" className="min-w-32">
              <SelectValue placeholder="Company" />
            </SelectTrigger>
            <SelectContent>
              {metrics.map((m) => (
                <SelectItem key={m.company} value={m.company}>
                  {m.company}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={kpi} onValueChange={setKpi}>
            <SelectTrigger size="sm" className="min-w-36">
              <SelectValue placeholder="KPI" />
            </SelectTrigger>
            <SelectContent>
              {KPI_OPTIONS.map((k) => (
                <SelectItem key={k.value} value={k.value}>
                  {k.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={tier} onValueChange={(v) => setTier(v as ForecastTier)}>
            <SelectTrigger size="sm" className="min-w-40">
              <SelectValue placeholder="Model" />
            </SelectTrigger>
            <SelectContent>
              {TIER_OPTIONS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label} — {t.description}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        {loading && <Skeleton className="h-64 w-full rounded-lg" />}

        {!loading && error && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>Can't forecast this yet</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!loading && !error && result && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 bg-primary" /> Historical
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 border-t-2 border-dashed border-primary/60" /> Forecast
              </span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="year"
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                    axisLine={{ stroke: 'var(--border)' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => formatMillions(v)}
                    width={64}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  {boundaryYear !== null && (
                    <ReferenceLine
                      x={boundaryYear}
                      stroke="var(--border)"
                      strokeDasharray="3 3"
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="historicalValue"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    dot={{ r: 3, fill: 'var(--primary)', strokeWidth: 0 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="forecastValue"
                    stroke="var(--primary)"
                    strokeOpacity={0.6}
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={{ r: 3, fill: 'var(--card)', stroke: 'var(--primary)', strokeWidth: 2 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {result.note && <p className="text-xs text-muted-foreground">{result.note}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
