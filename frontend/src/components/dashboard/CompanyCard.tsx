import { Building2, Clock } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { CompanyMetric } from '@/lib/api'
import { formatMillions, formatTimestamp, parseLines } from '@/lib/format'

const KPI_FIELDS = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'net_income', label: 'Net Income' },
  { key: 'operating_income', label: 'Operating Income' },
  { key: 'cash_flow', label: 'Cash Flow' },
  { key: 'total_assets', label: 'Total Assets' },
  { key: 'total_liabilities', label: 'Total Liabilities' },
] as const

export function CompanyCard({ metric }: { metric: CompanyMetric }) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const riskFactors = parseLines(metric.risk_factors)
  const growthDrivers = parseLines(metric.growth_drivers)

  return (
    <Card className="gap-4">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Building2 className="size-4.5" />
          </div>
          <div>
            <h3 className="text-base font-semibold leading-tight text-foreground">
              {metric.company}
            </h3>
            <p className="text-xs text-muted-foreground">Fiscal year {metric.year}</p>
          </div>
        </div>
        <Badge variant="secondary" className="shrink-0">
          FY {metric.year}
        </Badge>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          {KPI_FIELDS.map(({ key, label }) => (
            <div key={key} className="rounded-md border border-border bg-muted/40 px-3 py-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {label}
              </p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
                {formatMillions(metric[key])}
              </p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3.5" />
            Updated {formatTimestamp(metric.updated_at)}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDetailsOpen(true)}
            disabled={riskFactors.length === 0 && growthDrivers.length === 0}
          >
            Risks & Growth
          </Button>
        </div>
      </CardContent>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {metric.company} · FY {metric.year}
            </DialogTitle>
            <DialogDescription>Risk factors and growth drivers extracted from the report.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="flex flex-col gap-5">
              <section>
                <h4 className="mb-2 text-sm font-semibold text-foreground">Risk Factors</h4>
                {riskFactors.length > 0 ? (
                  <ul className="list-disc space-y-1.5 pl-4 text-sm text-muted-foreground">
                    {riskFactors.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No risk factors extracted.</p>
                )}
              </section>
              <section>
                <h4 className="mb-2 text-sm font-semibold text-foreground">Growth Drivers</h4>
                {growthDrivers.length > 0 ? (
                  <ul className="list-disc space-y-1.5 pl-4 text-sm text-muted-foreground">
                    {growthDrivers.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No growth drivers extracted.</p>
                )}
              </section>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
