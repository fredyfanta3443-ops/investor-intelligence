import { MessageCircle, Send, Sparkles, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { ChatMessage, type ChatMessageData } from '@/components/chat/ChatMessage'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ApiError, askQuestion, fetchMetrics } from '@/lib/api'

const ALL_COMPANIES = '__all__'
const ANY_YEAR = '__any__'

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Floating "help bubble" style chat widget (à la Intercom/Drift), mounted
 * once at the app root so it's available everywhere rather than living on
 * its own page.
 */
export function ChatBubble() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessageData[]>([])
  const [question, setQuestion] = useState('')
  const [company, setCompany] = useState(ALL_COMPANIES)
  const [year, setYear] = useState(ANY_YEAR)
  const [companies, setCompanies] = useState<string[]>([])
  const [years, setYears] = useState<string[]>([])
  const [isSending, setIsSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    fetchMetrics()
      .then((metrics) => {
        setCompanies(Array.from(new Set(metrics.map((m) => m.company))).sort())
        setYears(Array.from(new Set(metrics.map((m) => m.year))).sort().reverse())
      })
      .catch(() => {
        // Filters are a convenience; silently degrade to free-text-only chat.
      })
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = async () => {
    const trimmed = question.trim()
    if (!trimmed || isSending) return

    const userMessage: ChatMessageData = {
      id: makeId(),
      role: 'user',
      content: trimmed,
      status: 'done',
    }
    const pendingId = makeId()
    const pendingMessage: ChatMessageData = {
      id: pendingId,
      role: 'assistant',
      content: '',
      status: 'pending',
    }

    setMessages((prev) => [...prev, userMessage, pendingMessage])
    setQuestion('')
    setIsSending(true)

    try {
      const response = await askQuestion({
        question: trimmed,
        company: company === ALL_COMPANIES ? null : company,
        year: year === ANY_YEAR ? null : Number(year),
      })
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId ? { ...m, content: response.answer, status: 'done' } : m,
        ),
      )
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'Something went wrong answering that question.'
      setMessages((prev) =>
        prev.map((m) => (m.id === pendingId ? { ...m, content: message, status: 'error' } : m)),
      )
      toast.error(message)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-4 z-50 flex h-[32rem] w-[23rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl sm:right-6">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Sparkles className="size-3.5" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight text-foreground">AI Research</p>
                <p className="text-[11px] text-muted-foreground">Ask about your ingested reports</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
            >
              <X className="size-4" />
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-3 py-2">
            <span className="text-[11px] font-medium text-muted-foreground">Scope:</span>
            <Select value={company} onValueChange={setCompany}>
              <SelectTrigger size="sm" className="h-7 min-w-28 text-xs">
                <SelectValue placeholder="All companies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_COMPANIES}>All companies</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger size="sm" className="h-7 min-w-20 text-xs">
                <SelectValue placeholder="Any year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY_YEAR}>Any year</SelectItem>
                {years.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground">
                <Sparkles className="size-7" />
                <p className="text-xs">
                  Ask about revenue trends, risk factors, growth drivers, or anything else in the
                  ingested reports.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {messages.map((message) => (
                  <ChatMessage key={message.id} message={message} />
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          <form
            className="flex items-end gap-2 border-t border-border p-2.5"
            onSubmit={(event) => {
              event.preventDefault()
              void handleSubmit()
            }}
          >
            <Textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void handleSubmit()
                }
              }}
              placeholder="Ask a question..."
              className="min-h-9 flex-1 resize-none text-sm"
              rows={1}
              disabled={isSending}
            />
            <Button type="submit" size="icon" disabled={!question.trim() || isSending}>
              <Send className="size-4" />
            </Button>
          </form>
        </div>
      )}

      <Button
        size="icon"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-4 right-4 z-50 size-14 rounded-full shadow-xl sm:right-6"
        aria-label={open ? 'Close AI Research chat' : 'Open AI Research chat'}
      >
        {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
      </Button>
    </>
  )
}
