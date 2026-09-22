import { AlertTriangle, Bot, Loader2, User } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface ChatMessageData {
  id: string
  role: 'user' | 'assistant'
  content: string
  status: 'pending' | 'done' | 'error'
}

export function ChatMessage({ message }: { message: ChatMessageData }) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-accent text-accent-foreground',
        )}
      >
        {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
      </div>

      <div
        className={cn(
          'flex max-w-[85%] flex-col gap-1.5 rounded-xl px-3.5 py-2.5 text-sm',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
          message.status === 'error' && 'bg-destructive/10 text-destructive',
        )}
      >
        {message.status === 'pending' ? (
          <span className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Researching&hellip; this can take up to a minute
          </span>
        ) : message.status === 'error' ? (
          <span className="flex items-start gap-1.5">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            {message.content}
          </span>
        ) : (
          <span className="whitespace-pre-wrap">{message.content}</span>
        )}
      </div>
    </div>
  )
}
