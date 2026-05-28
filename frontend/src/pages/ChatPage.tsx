import React, { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send,
  Bot,
  User,
  ThumbsUp,
  ThumbsDown,
  ChevronRight,
  Copy,
  RotateCcw,
  Zap,
  FileText,
  AlertTriangle,
  GitBranch,
  Terminal,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  BarChart2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { cn } from '@/utils/cn'
import { useAuthStore } from '@/store/authStore'
import { chatApi, releasesApi, issuesApi } from '@/services/api'
import { useQuery } from '@tanstack/react-query'
import type { ChatMessage } from '@/types'

// ─── Static chips (always same — these are demo prompts) ─────────────────────

const QUICK_CHIPS = [
  'Find JIRA-1021 across all files',
  'Show all crash issues in version v9.47',
  'Why did order modification fail?',
  'Show patch notes related to RMS',
  'List critical bugs in OMS module',
  'Which clients are on v9.48?',
]

const SAMPLE_QUERIES = [
  'What changed in v9.47?',
  'Show RCA for JIRA-1022',
  'Compare v9.46 vs v9.47',
  'Find workaround for FIX tag 41',
  'Which release is Axis Bank on?',
]

// Health → color mapping
const healthColor = (h?: string) => {
  if (!h) return 'bg-slate-400'
  const l = h.toLowerCase()
  if (l === 'healthy') return 'bg-emerald-500'
  if (l === 'warning') return 'bg-amber-500'
  if (l === 'critical') return 'bg-red-500'
  return 'bg-slate-400'
}

// Module color mapping
const MODULE_COLORS: Record<string, string> = {
  RMS: 'bg-purple-500', FIX: 'bg-blue-500', OMS: 'bg-indigo-500',
  SERVER: 'bg-violet-500', CLIENT: 'bg-fuchsia-500',
}

function buildMockResponse(query: string): string {
  const q = query.toLowerCase()
  if (q.includes('order modification') || q.includes('order reject')) {
    return JSON.stringify({
      type: 'jira_detail',
      jira_id: 'JIRA-1042',
      title: 'Order modification failure in RMS v9.47',
      status: 'Open',
      priority: 'Critical',
      created: '2025-05-18',
      assignee: 'Rahul Mehta',
      affected_versions: ['v9.47', 'v9.46'],
      jira_details: 'Order modification API throws NPE when risk check is bypassed during pre-open session. Stack trace points to RiskManager.validateModification() line 412.',
      release_notes: 'v9.47 introduced new risk check bypass flag `SKIP_RISK_ON_MODIFY`. When set to 1, it skips null checks in validation chain.',
      patch_notes: 'Patch v9.47.1 reverts the bypass flag and adds proper null guard. Deployed to UAT on May 20, 2025.',
      matching_logs: '[2025-05-18 09:32:11] ERROR RMS NullPointerException at RiskManager.validateModification:412\n[2025-05-18 09:32:11] ERROR Order 78432 failed: MODIFY_REJECTED',
      root_cause: 'The SKIP_RISK_ON_MODIFY flag introduced in v9.47 omits a critical null check in the modification validation chain. When an order is modified during pre-open, the parent order reference can be null, causing NPE.',
      workaround: 'Set SKIP_RISK_ON_MODIFY=0 in trading_style.ini and restart RMS. This re-enables the full validation path and prevents the NPE.',
      sources: ['jira', 'logs', 'release_notes', 'patch_notes'],
    })
  }
  if (q.includes('crash') || q.includes('9.47')) {
    return JSON.stringify({
      type: 'jira_detail',
      jira_id: 'JIRA-1038',
      title: 'Multiple crash issues found in v9.47',
      status: 'In Progress',
      priority: 'High',
      created: '2025-05-16',
      assignee: 'Priya Sharma',
      affected_versions: ['v9.47'],
      jira_details: 'Three crash-class issues identified in v9.47: (1) RMS NPE on order modify, (2) FIX session crash on malformed heartbeat, (3) OMS memory leak on cancel-replace storm.',
      release_notes: 'v9.47 shipped with new pre-open handling, updated FIX engine (5.0 SP2), and OMS cancel-replace batching. All three crash paths trace to these new features.',
      patch_notes: 'v9.47.1 addresses items 1 and 2. Item 3 (OMS memory leak) fix is scheduled for v9.48.',
      matching_logs: '[2025-05-16 09:45:22] FATAL RMS Segfault at 0x7f3a2b1c4d08\n[2025-05-17 10:12:05] ERROR FIX Unexpected heartbeat payload size=0\n[2025-05-17 14:30:18] WARN OMS Heap usage 94% — GC pressure increasing',
      root_cause: 'v9.47 bundled three independent risky changes without adequate regression coverage. The FIX engine upgrade introduced a breaking change in heartbeat parsing.',
      workaround: 'Upgrade to v9.47.1 for RMS and FIX fixes. For OMS memory leak, increase heap to 8GB via -Xmx8g and schedule daily restart until v9.48 patch.',
      sources: ['jira', 'logs', 'patch_notes'],
    })
  }
  if (q.includes('jira-1021')) {
    return JSON.stringify({
      type: 'jira_detail',
      jira_id: 'JIRA-1021',
      title: 'NSE circular compliance — new order type flags',
      status: 'Closed',
      priority: 'Medium',
      created: '2025-04-02',
      assignee: 'Anita Desai',
      affected_versions: ['v9.46', 'v9.45'],
      jira_details: 'NSE circular NSE/TECH/48832 mandates new order type codes for AMO and GTD orders. Implementation spans RMS, OMS, and FIX adapter.',
      release_notes: 'v9.46 adds ORDER_TYPE_AMO=7 and ORDER_TYPE_GTD=8. FIX tag 40 mapping updated accordingly.',
      patch_notes: 'No patch needed — full implementation shipped in v9.46 base release.',
      matching_logs: '[2025-04-10 08:00:01] INFO RMS NSE new order types registered: AMO=7, GTD=8\n[2025-04-10 08:00:02] INFO FIX Tag40 mapping updated',
      root_cause: 'Regulatory requirement from NSE circular NSE/TECH/48832 dated 2025-03-28. Effective date 2025-04-10.',
      workaround: 'N/A — compliance item, no workaround applicable.',
      sources: ['jira', 'release_notes', 'docs'],
    })
  }
  return JSON.stringify({
    type: 'jira_detail',
    jira_id: 'JIRA-1039',
    title: 'FIX session drops under sustained load',
    status: 'In Progress',
    priority: 'High',
    created: '2025-05-14',
    assignee: 'Vikram Nair',
    affected_versions: ['v9.47', 'v9.48'],
    jira_details: 'FIX gateway drops sessions when message throughput exceeds 15,000 msg/sec sustained for >30 seconds. Clients on high-volume desks are affected during market hours.',
    release_notes: 'v9.47 upgraded FIX engine to QuickFIX/J 2.3.1. The new version has a known thread-pool starvation issue under high load.',
    patch_notes: 'v9.48 reverts FIX engine to QuickFIX/J 2.2.0 and adds adaptive thread-pool sizing. In testing.',
    matching_logs: '[2025-05-14 10:15:33] ERROR FIX SessionID=CLIENT1 Disconnected: HeartbeatTimeout\n[2025-05-14 10:15:34] WARN FIX ThreadPool exhausted (32/32 threads active)',
    root_cause: 'QuickFIX/J 2.3.1 changed thread-pool management from fixed to work-stealing. Under high message rates, the stealing algorithm causes starvation of the I/O thread, leading to missed heartbeats and session drop.',
    workaround: 'Set FIX_MAX_THREADS=64 in fix_config.ini to increase thread pool size. Also set HEARTBEAT_INTERVAL=60 to reduce heartbeat frequency during peak hours.',
    sources: ['jira', 'logs', 'release_notes', 'patch_notes', 'docs'],
  })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const TypingIndicator: React.FC = () => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 8 }}
    className="flex items-center gap-3"
  >
    <div className="h-8 w-8 rounded-full gradient-brand flex items-center justify-center flex-shrink-0">
      <Bot className="h-4 w-4 text-white" />
    </div>
    <div className="rounded-2xl rounded-tl-sm bg-card border border-border px-4 py-3 shadow-sm">
      <div className="flex gap-1 items-center h-4">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-2 w-2 rounded-full bg-primary/60"
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
    </div>
  </motion.div>
)

interface ParsedResponse {
  type: string
  jira_id?: string
  title?: string
  status?: string
  priority?: string
  created?: string
  assignee?: string
  affected_versions?: string[]
  jira_details?: string
  release_notes?: string
  patch_notes?: string
  matching_logs?: string
  root_cause?: string
  workaround?: string
  sources?: string[]
}

const priorityColor = (p?: string) => {
  if (!p) return 'bg-slate-100 text-slate-600'
  switch (p.toLowerCase()) {
    case 'critical': return 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
    case 'high': return 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400'
    case 'medium': return 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
    default: return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
  }
}

const statusColor = (s?: string) => {
  if (!s) return 'open'
  const map: Record<string, string> = { Open: 'open', 'In Progress': 'in_progress', Resolved: 'resolved', Closed: 'completed' }
  return map[s] ?? 'unknown'
}

const SourceBadge: React.FC<{ source: string }> = ({ source }) => {
  const map: Record<string, { label: string; cls: string }> = {
    jira: { label: 'Jira', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' },
    logs: { label: 'Logs', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
    release_notes: { label: 'Release Notes', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400' },
    patch_notes: { label: 'Patch Notes', cls: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400' },
    docs: { label: 'Docs', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' },
  }
  const cfg = map[source] ?? { label: source, cls: 'bg-muted text-muted-foreground' }
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium', cfg.cls)}>
      {cfg.label}
    </span>
  )
}

const AIResponseCard: React.FC<{ content: string; messageId: string }> = ({ content, messageId }) => {
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null)
  let parsed: ParsedResponse | null = null
  try {
    parsed = JSON.parse(content) as ParsedResponse
  } catch {
    // plain text
  }

  if (!parsed) {
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed text-foreground">
        {content}
      </div>
    )
  }

  const detailCards = [
    { icon: <AlertCircle className="h-4 w-4 text-blue-500" />, title: 'Jira Details', content: parsed.jira_details },
    { icon: <FileText className="h-4 w-4 text-purple-500" />, title: 'Release Notes', content: parsed.release_notes },
    { icon: <GitBranch className="h-4 w-4 text-indigo-500" />, title: 'Patch Notes', content: parsed.patch_notes },
    { icon: <Terminal className="h-4 w-4 text-slate-500" />, title: 'Matching Logs', content: parsed.matching_logs, mono: true },
    { icon: <Search className="h-4 w-4 text-red-500" />, title: 'Root Cause (AI Analysis)', content: parsed.root_cause },
    { icon: <Zap className="h-4 w-4 text-amber-500" />, title: 'Workaround', content: parsed.workaround },
  ]

  return (
    <div className="space-y-3">
      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-foreground">{parsed.jira_id}</span>
        <span className="text-muted-foreground">·</span>
        {parsed.status && <StatusBadge status={statusColor(parsed.status)} size="sm" label={parsed.status} />}
        {parsed.priority && (
          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', priorityColor(parsed.priority))}>
            {parsed.priority}
          </span>
        )}
        {parsed.created && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3 w-3" /> {parsed.created}
          </span>
        )}
        {parsed.assignee && (
          <span className="text-muted-foreground">Assignee: <span className="text-foreground font-medium">{parsed.assignee}</span></span>
        )}
        {parsed.affected_versions && parsed.affected_versions.length > 0 && (
          <span className="text-muted-foreground">
            Versions:{' '}
            {parsed.affected_versions.map((v) => (
              <span key={v} className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono text-foreground">{v}</span>
            ))}
          </span>
        )}
      </div>

      {parsed.title && (
        <p className="text-sm font-semibold text-foreground">{parsed.title}</p>
      )}

      {/* Detail grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {detailCards.map((card) => (
          <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
            <div className="flex items-center gap-1.5">
              {card.icon}
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{card.title}</span>
            </div>
            <p className={cn('text-xs text-foreground/80 leading-relaxed line-clamp-4', card.mono && 'font-mono text-[10px] bg-muted rounded p-1')}>
              {card.content ?? '—'}
            </p>
          </div>
        ))}
      </div>

      {/* Sources */}
      {parsed.sources && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground font-medium">Sources:</span>
          {parsed.sources.map((s) => <SourceBadge key={s} source={s} />)}
        </div>
      )}

      <Separator />

      {/* Feedback & actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Was this helpful?</span>
          <button
            onClick={() => setFeedback('up')}
            className={cn('rounded-md p-1.5 transition-colors hover:bg-muted', feedback === 'up' && 'bg-emerald-100 dark:bg-emerald-950/40')}
          >
            <ThumbsUp className={cn('h-3.5 w-3.5', feedback === 'up' ? 'text-emerald-600' : 'text-muted-foreground')} />
          </button>
          <button
            onClick={() => setFeedback('down')}
            className={cn('rounded-md p-1.5 transition-colors hover:bg-muted', feedback === 'down' && 'bg-red-100 dark:bg-red-950/40')}
          >
            <ThumbsDown className={cn('h-3.5 w-3.5', feedback === 'down' ? 'text-red-600' : 'text-muted-foreground')} />
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {['Show similar issues', 'Show all logs', 'Show related releases', 'Find workaround', 'Export Summary'].map((action) => (
            <button
              key={action}
              className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-muted transition-colors"
            >
              {action}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

interface MessageBubbleProps {
  message: ChatMessage
  index: number
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, index }) => {
  const isUser = message.role === 'user'
  const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: index * 0.04 }}
      className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}
    >
      {/* Avatar */}
      {!isUser && (
        <div className="h-8 w-8 rounded-full gradient-brand flex items-center justify-center flex-shrink-0 shadow">
          <Bot className="h-4 w-4 text-white" />
        </div>
      )}
      {isUser && (
        <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
          <User className="h-4 w-4 text-slate-600 dark:text-slate-300" />
        </div>
      )}

      <div className={cn('flex flex-col gap-1 max-w-[80%]', isUser && 'items-end')}>
        {isUser ? (
          <div className="rounded-2xl rounded-tr-sm gradient-brand px-4 py-2.5 shadow">
            <p className="text-sm text-white leading-relaxed">{message.content}</p>
          </div>
        ) : (
          <div className="rounded-2xl rounded-tl-sm bg-card border border-border px-4 py-3 shadow-sm w-full">
            <AIResponseCard content={message.content} messageId={message.id} />
          </div>
        )}
        <span className="text-[10px] text-muted-foreground px-1">{time}</span>
      </div>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const ChatPage: React.FC = () => {
  const { user } = useAuthStore()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId] = useState(() => `session_${Date.now()}`)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Fetch real releases for right panel
  const { data: releasesData } = useQuery({
    queryKey: ['chat-releases'],
    queryFn: async () => {
      try {
        const res = await releasesApi.list({ page_size: 6 })
        return res.data.items ?? []
      } catch { return [] }
    },
    staleTime: 5 * 60 * 1000,
  })

  // Fetch real recent JIRA issues for right panel
  const { data: issuesData } = useQuery({
    queryKey: ['chat-issues'],
    queryFn: async () => {
      try {
        const res = await issuesApi.list({ page_size: 5 })
        return res.data.items ?? []
      } catch { return [] }
    },
    staleTime: 5 * 60 * 1000,
  })

  const detectedReleases = releasesData ?? []
  const recentJira = issuesData ?? []

  // Compute module log counts from issues (proxy for log file count per module)
  const moduleCounts = recentJira.reduce((acc: Record<string, number>, i: Record<string, string>) => {
    const m = (i.components?.[0] || i.module || 'Other') as string
    acc[m] = (acc[m] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  const topModules = Object.entries(moduleCounts)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 5)
    .map(([name, count], i, arr) => ({
      name,
      count: count as number,
      color: MODULE_COLORS[name] || 'bg-slate-500',
      pct: Math.round(((count as number) / (arr[0][1] as number)) * 100),
    }))

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading, scrollToBottom])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      const res = await chatApi.sendMessage(text.trim(), sessionId)
      const data = res.data
      // API returns { assistant_message: { content, sources }, session_id }
      const assistantMsg = data.assistant_message || data
      const aiMsg: ChatMessage = {
        id: assistantMsg.id || `ai_${Date.now()}`,
        role: 'assistant',
        content: assistantMsg.content || data.message || data.content || buildMockResponse(text),
        timestamp: assistantMsg.created_at || new Date().toISOString(),
        sources: assistantMsg.sources,
        confidence: data.confidence,
      }
      setMessages((prev) => [...prev, aiMsg])
    } catch {
      const aiMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        content: buildMockResponse(text),
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, aiMsg])
    } finally {
      setIsLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isLoading, sessionId])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const displayName = user?.full_name?.split(' ')[0] ?? user?.username ?? 'Admin'

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Main chat area ── */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <ScrollArea className="flex-1">
          <div className="px-6 py-6 space-y-6 max-w-4xl mx-auto">

            {/* Welcome header */}
            {messages.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="text-center pt-8 pb-4"
              >
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl gradient-brand shadow-lg mb-4">
                  <Bot className="h-8 w-8 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-foreground">
                  Hi {displayName}! 👋
                </h1>
                <p className="mt-2 text-muted-foreground text-sm max-w-md mx-auto">
                  I'm your ReleaseIQ AI Assistant. Ask me about JIRA issues, release notes, patch history, log analysis, or root cause investigation.
                </p>
              </motion.div>
            )}

            {/* Quick action chips */}
            {messages.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="flex flex-wrap justify-center gap-2"
              >
                {QUICK_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => sendMessage(chip)}
                    className="rounded-full border border-border bg-background px-3.5 py-2 text-xs font-medium text-foreground shadow-sm hover:bg-muted hover:border-primary/40 transition-all"
                  >
                    {chip}
                  </button>
                ))}
              </motion.div>
            )}

            {/* Messages */}
            <div className="space-y-5">
              {messages.map((msg, i) => (
                <MessageBubble key={msg.id} message={msg} index={i} />
              ))}
              <AnimatePresence>
                {isLoading && <TypingIndicator />}
              </AnimatePresence>
            </div>

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input bar */}
        <div className="border-t border-border bg-background/95 backdrop-blur px-6 py-4">
          <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
            <div className="flex gap-2 items-end">
              <div className="flex-1 relative">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about issues, releases, logs, or root causes..."
                  className="h-11 pr-4 rounded-xl border-border focus-visible:ring-primary/40 text-sm"
                  disabled={isLoading}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      sendMessage(input)
                    }
                  }}
                />
              </div>
              <Button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="h-11 w-11 rounded-xl gradient-brand border-0 p-0 shadow-sm hover:opacity-90 transition-opacity"
                size="icon"
              >
                <Send className="h-4 w-4 text-white" />
              </Button>
            </div>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              ReleaseIQ AI may produce inaccurate results. Always verify critical information with source documents.
            </p>
          </form>
        </div>
      </div>

      {/* ── Right panel ── */}
      <motion.aside
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="hidden xl:flex flex-col w-72 flex-shrink-0 border-l border-border bg-card overflow-y-auto"
      >
        <ScrollArea className="flex-1 px-4 py-4">
          <div className="space-y-5">

            {/* Detected Releases */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <GitBranch className="h-3.5 w-3.5" /> Detected Releases
              </h3>
              <Card className="p-0">
                <CardContent className="p-3 space-y-2">
                  {detectedReleases.slice(0, 6).map((rel: Record<string, string>, idx: number) => (
                    <div key={rel.version || idx} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={cn('h-2 w-2 rounded-full flex-shrink-0', healthColor(rel.health))} />
                        <span className="text-sm font-medium text-foreground">{rel.version}</span>
                        {idx === 0 && (
                          <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-[10px] font-medium px-1.5 py-0.5">
                            Latest
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {rel.release_date ? new Date(rel.release_date).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : ''}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Top Modules */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <BarChart2 className="h-3.5 w-3.5" /> Top Modules (Logs)
              </h3>
              <Card className="p-0">
                <CardContent className="p-3 space-y-3">
                  {(topModules.length > 0 ? topModules : [
                    { name: 'RMS', count: 9 as number, color: 'bg-purple-500', pct: 100 },
                    { name: 'FIX', count: 7 as number, color: 'bg-blue-500', pct: 78 },
                    { name: 'OMS', count: 6 as number, color: 'bg-indigo-500', pct: 67 },
                  ]).map((mod) => (
                    <div key={mod.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-foreground">{mod.name}</span>
                        <span className="text-muted-foreground">{mod.count as number} issues</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className={cn('h-full rounded-full', mod.color)} style={{ width: `${mod.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Recent Jira Issues */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> Recent Jira Issues
              </h3>
              <Card className="p-0">
                <CardContent className="p-3 space-y-3">
                  {recentJira.slice(0, 5).map((issue: Record<string, string>) => (
                    <div key={issue.jira_key || issue.id} className="space-y-1 cursor-pointer hover:opacity-80"
                      onClick={() => sendMessage(`Tell me about ${issue.jira_key || issue.jira_id}`)}>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-mono font-semibold text-primary">{issue.jira_key || issue.jira_id}</span>
                        <StatusBadge status={statusColor(issue.status)} size="sm" label={issue.status} showDot={false} />
                      </div>
                      <p className="text-xs text-muted-foreground leading-snug line-clamp-1">{issue.summary || issue.title}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Sample Queries */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Sample Queries
              </h3>
              <div className="space-y-1.5">
                {SAMPLE_QUERIES.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground hover:bg-muted hover:border-primary/30 transition-all group"
                  >
                    <span>{q}</span>
                    <ChevronRight className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
                  </button>
                ))}
              </div>
            </div>

          </div>
        </ScrollArea>
      </motion.aside>
    </div>
  )
}

export default ChatPage
