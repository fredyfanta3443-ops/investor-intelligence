import { CheckCircle2, ShieldAlert, TrendingUp } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CompanyMetric } from '@/lib/api'
import { parseLines } from '@/lib/format'

/**
 * Always-visible "deep dive" section: pick a company, see its Growth
 * Drivers and Risk Factors side by side. This mirrors the reference
 * app's dedicated qualitative-insights panel — surfacing this content
 * inline instead of behind a button/dialog, since that made it too easy
 * to miss entirely.
 */
export function QualitativeInsights({ metrics }: { metrics: CompanyMetric[] }) {
  const [selected, setSelected] = useState(metrics[0]?.company ?? '')

  useEffect(() => {
    if (!metrics.some((m) => m.company === selected)) {
      setSelected(metrics[0]?.company ?? '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metrics])

  if (metrics.length === 0) return null

  const active = metrics.find((m) => m.company === selected) ?? metrics[0]
  const growthDrivers = parseLines(active.growth_drivers)
  const riskFactors = parseLines(active.risk_factors)

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Qualitative Insights</h2>
          <p className="text-sm text-muted-foreground">
            Growth drivers and risk factors extracted from the report.
          </p>
        </div>
        <Select value={active.company} onValueChange={setSelected}>
          <SelectTrigger size="sm" className="min-w-40">
            <SelectValue placeholder="Select company" />
          </SelectTrigger>
          <SelectContent>
            {metrics.map((m) => (
              <SelectItem key={m.company} value={m.company}>
                {m.company} (FY {m.year})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>

      <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section>
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <TrendingUp className="size-4 text-primary" />
            Top Growth Drivers
          </h3>
          {growthDrivers.length > 0 ? (
            <ul className="flex flex-col gap-2.5">
              {growthDrivers.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No growth drivers extracted.</p>
          )}
        </section>

        <section>
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <ShieldAlert className="size-4 text-destructive" />
            Top Risk Factors
          </h3>
          {riskFactors.length > 0 ? (
            <ul className="flex flex-col gap-2.5">
              {riskFactors.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No risk factors extracted.</p>
          )}
        </section>
      </CardContent>
    </Card>
  )
}
