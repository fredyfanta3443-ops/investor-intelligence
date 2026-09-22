import { CheckCircle2, FileText, Loader2, UploadCloud, XCircle } from 'lucide-react'
import { type ChangeEvent, type DragEvent, useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { ApiError, uploadReport } from '@/lib/api'
import { cn } from '@/lib/utils'

type UploadState =
  | { phase: 'idle' }
  | { phase: 'uploading'; fraction: number }
  | { phase: 'processing' }
  | { phase: 'success'; fileName: string; message: string }
  | { phase: 'error'; message: string }

const MAX_SIZE_BYTES = 100 * 1024 * 1024 // 100MB, generous cap for 10-K PDFs

export function UploadDialog({
  open,
  onOpenChange,
  onUploaded,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUploaded: () => void
}) {
  const [state, setState] = useState<UploadState>({ phase: 'idle' })
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const busy = state.phase === 'uploading' || state.phase === 'processing'

  const validateAndSetFile = useCallback((file: File | undefined) => {
    if (!file) return
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Only PDF files are supported.')
      return
    }
    if (file.size > MAX_SIZE_BYTES) {
      toast.error('File is too large (max 100MB).')
      return
    }
    setSelectedFile(file)
    setState({ phase: 'idle' })
  }, [])

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    validateAndSetFile(event.target.files?.[0])
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    if (busy) return
    validateAndSetFile(event.dataTransfer.files?.[0])
  }

  const handleSubmit = async () => {
    if (!selectedFile) return
    setState({ phase: 'uploading', fraction: 0 })
    try {
      const response = await uploadReport(selectedFile, (fraction) => {
        setState((prev) =>
          prev.phase === 'uploading' || prev.phase === 'idle'
            ? fraction >= 1
              ? { phase: 'processing' }
              : { phase: 'uploading', fraction }
            : prev,
        )
      })
      setState({ phase: 'success', fileName: response.file_name, message: response.message })
      toast.success(`${response.file_name} processed successfully.`)
      onUploaded()
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'Upload failed. Please try again.'
      setState({ phase: 'error', message })
      toast.error(message)
    }
  }

  const reset = () => {
    setSelectedFile(null)
    setState({ phase: 'idle' })
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return // don't let an in-flight upload be dismissed
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Report</DialogTitle>
          <DialogDescription>
            Upload a company&apos;s annual report (10-K PDF). We&apos;ll parse it, extract KPIs,
            and add it to the dashboard.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <div
            role="button"
            tabIndex={0}
            onClick={() => !busy && inputRef.current?.click()}
            onKeyDown={(event) => {
              if ((event.key === 'Enter' || event.key === ' ') && !busy) {
                inputRef.current?.click()
              }
            }}
            onDragOver={(event) => {
              event.preventDefault()
              if (!busy) setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={cn(
              'flex flex-col items-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors',
              busy ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
              isDragging ? 'border-primary bg-accent' : 'border-border hover:bg-muted/40',
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              disabled={busy}
              onChange={handleInputChange}
            />
            {selectedFile ? (
              <>
                <FileText className="size-8 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
              </>
            ) : (
              <>
                <UploadCloud className="size-8 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Drop a PDF here, or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground">10-K annual reports, PDF only</p>
                </div>
              </>
            )}
          </div>

          {state.phase === 'uploading' && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Uploading&hellip;</span>
                <span>{Math.round(state.fraction * 100)}%</span>
              </div>
              <Progress value={state.fraction * 100} />
            </div>
          )}

          {state.phase === 'processing' && (
            <Alert>
              <Loader2 className="size-4 animate-spin" />
              <AlertTitle>Processing report&hellip;</AlertTitle>
              <AlertDescription>
                Parsing the PDF, chunking, embedding, and extracting KPIs with an LLM. This
                typically takes 30&ndash;90 seconds &mdash; please keep this open.
              </AlertDescription>
            </Alert>
          )}

          {state.phase === 'success' && (
            <Alert>
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
              <AlertTitle>Upload complete</AlertTitle>
              <AlertDescription>
                {state.message || `${state.fileName} was ingested successfully.`} The dashboard
                has been refreshed.
              </AlertDescription>
            </Alert>
          )}

          {state.phase === 'error' && (
            <Alert variant="destructive">
              <XCircle className="size-4" />
              <AlertTitle>Upload failed</AlertTitle>
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          )}

          <div className="flex items-center gap-2">
            <Button
              className="flex-1"
              disabled={!selectedFile || busy}
              onClick={() => void handleSubmit()}
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              {state.phase === 'uploading' && 'Uploading…'}
              {state.phase === 'processing' && 'Processing…'}
              {state.phase !== 'uploading' && state.phase !== 'processing' && 'Upload & Analyze'}
            </Button>
            {(selectedFile || state.phase === 'success' || state.phase === 'error') && (
              <Button variant="outline" onClick={reset} disabled={busy}>
                {state.phase === 'success' ? 'Upload Another' : 'Clear'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
