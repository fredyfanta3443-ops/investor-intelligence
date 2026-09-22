import { AlertCircle, FileStack, RefreshCw, UploadCloud } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { MetricsSkeleton } from '@/components/dashboard/MetricsSkeleton'
import { CompanyCard } from '@/components/dashboard/CompanyCard'
import { ForecastPanel } from '@/components/dashboard/ForecastPanel'
import { QualitativeInsights } from '@/components/dashboard/QualitativeInsights'
import { UploadDialog } from '@/components/upload/UploadDialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ApiError, fetchMetrics, type CompanyMetric } from '@/lib/api'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; metrics: CompanyMetric[] }

export function Dashboard() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [uploadOpen, setUploadOpen] = useState(false)

  const load = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const metrics = await fetchMetrics()
      setState({ status: 'ready', metrics })
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Something went wrong loading metrics.'
      setState({ status: 'error', message })
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Latest extracted KPIs per company, from ingested annual reports.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="size-4" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <UploadCloud className="size-4" />
            Upload Report
          </Button>
        </div>
      </div>

      {state.status === 'loading' && <MetricsSkeleton />}

      {state.status === 'error' && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Couldn't load metrics</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      {state.status === 'ready' && state.metrics.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <FileStack className="size-6" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">No companies ingested yet</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Upload a company&apos;s annual report (10-K PDF) to extract its financial KPIs and
              see them here.
            </p>
          </div>
          <Button className="mt-2" onClick={() => setUploadOpen(true)}>
            <UploadCloud className="size-4" />
            Upload your first report
          </Button>
        </div>
      )}

      {state.status === 'ready' && state.metrics.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {state.metrics.map((metric) => (
              <CompanyCard key={metric.id} metric={metric} onDeleted={() => void load()} />
            ))}
          </div>

          <QualitativeInsights metrics={state.metrics} />

          <ForecastPanel metrics={state.metrics} />
        </>
      )}

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploaded={() => void load()}
      />
    </div>
  )
}
