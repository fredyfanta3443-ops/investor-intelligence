import { Building2, Clock, Loader2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { ApiError, deleteCompany, type CompanyMetric } from '@/lib/api'
import { formatMillions, formatTimestamp } from '@/lib/format'

const KPI_FIELDS = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'net_income', label: 'Net Income' },
  { key: 'operating_income', label: 'Operating Income' },
  { key: 'cash_flow', label: 'Cash Flow' },
  { key: 'total_assets', label: 'Total Assets' },
  { key: 'total_liabilities', label: 'Total Liabilities' },
] as const

export function CompanyCard({
  metric,
  onDeleted,
}: {
  metric: CompanyMetric
  onDeleted: () => void
}) {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const result = await deleteCompany(metric.company)
      toast.success(`Deleted ${metric.company} (${result.records_deleted} year(s) of data)`)
      onDeleted()
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to delete.'
      toast.error(message)
    } finally {
      setDeleting(false)
    }
  }

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
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge variant="secondary">FY {metric.year}</Badge>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-destructive"
                disabled={deleting}
                aria-label={`Delete ${metric.company} FY ${metric.year}`}
              >
                {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete all {metric.company} data?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes {metric.company}'s entire KPI history (every year on
                  file, not just FY {metric.year} shown here) and its report chunks
                  from the vector store. You'll need to re-upload reports to get this
                  data back. This can't be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => void handleDelete()}
                  className="bg-destructive text-white hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
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

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="size-3.5" />
          Updated {formatTimestamp(metric.updated_at)}
        </div>
      </CardContent>
    </Card>
  )
}
