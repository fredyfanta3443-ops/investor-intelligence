import { ChatBubble } from '@/components/chat/ChatBubble'
import { AppShell } from '@/components/layout/AppShell'
import { Toaster } from '@/components/ui/sonner'
import { Dashboard } from '@/pages/Dashboard'

function App() {
  return (
    <>
      <AppShell>
        <Dashboard />
      </AppShell>
      <ChatBubble />
      <Toaster />
    </>
  )
}

export default App
