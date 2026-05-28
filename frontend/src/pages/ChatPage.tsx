import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import {
  Send, Bot, User, Sparkles, GitBranch,
  AlertCircle, Clock, ChevronRight, Copy,
  ThumbsUp, ThumbsDown, RefreshCcw, Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/utils/cn'
import { useAuthStore } from '@/store/authStore'
import { chatApi, releasesApi, issuesApi } from '@/services/api'
import { useQuery } from '@tanstack/react-query'
import type { ChatMessage } from '@/types'

// ─── Suggested prompts ────────────────────────────────────────────────────────

const SUGGESTED_PROMPTS = [
  { icon: <AlertCircle className="h-4 w-4" />, text: 'What are the critical open bugs in Optimus?' },
  { icon: <GitBranch className="h-4 w-4" />,   text: 'Show patch notes for the latest 1209 release' },
  { icon: <Zap className="h-4 w-4" />,          text: 'What is the GREEK_BCAST flag used for?' },
  { icon: <Sparkles className="h-4 w-4" />,     text: 'Explain the difference between 3009 and 1209 releases' },
]

// ─── Markdown renderer ────────────────────────────────────────────────────────

const MD_CLASS = [
  'prose prose-sm dark:prose-invert max-w-none leading-relaxed',
  'prose-headings:font-semibold prose-headings:text-foreground prose-headings:mt-3 prose-headings:mb-1',
  'prose-p:text-foreground/90 prose-p:my-1',
  'prose-strong:text-foreground prose-strong:font-semibold',
  'prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[0.8em] prose-code:font-mono prose-code:text-primary',
  'prose-pre:bg-muted/80 prose-pre:border prose-pre:border-border prose-pre:rounded-lg prose-pre:p-3',
  'prose-ul:my-1 prose-li:my-0.5 prose-li:text-foreground/90 prose-ol:my-1',
  'prose-table:border-collapse prose-th:border prose-th:border-border prose-th:bg-muted/50 prose-th:px-2 prose-th:py-1 prose-th:text-xs',
  'prose-td:border prose-td:border-border prose-td:px-2 prose-td:py-1 prose-td:text-xs',
  'prose-hr:border-border prose-hr:my-3 prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
].join(' ')

const MarkdownMessage: React.FC<{ content: string }> = ({ content }) => (
  <div className={MD_CLASS}>
    <ReactMarkdown>{content}</ReactMarkdown>
  </div>
)

// ─── Typing indicator ─────────────────────────────────────────────────────────

const TypingIndicator: React.FC = () => (
  <div className="flex items-end gap-3 max-w-[85%]">
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary flex-shrink-0 shadow-sm">
      <Bot className="h-4 w-4 text-white" />
    </div>
    <div className="rounded-2xl rounded-bl-sm bg-card border border-border px-4 py-3 shadow-sm">
      <div className="flex gap-1.5 items-center h-4">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-2 w-2 rounded-full bg-muted-foreground/60"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
          />
        ))}
      </div>
    </div>
  </div>
)

// ─── Single message bubble ────────────────────────────────────────────────────

const MessageBubble: React.FC<{
  message: ChatMessage
  index: number
  onCopy: (text: string) => void
}> = ({ message, index, onCopy }) => {
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null)
  const isUser = message.role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.02 }}
      className={cn('flex items-end gap-3 group', isUser && 'flex-row-reverse')}
    >
      {/* Avatar */}
      <div className={cn(
        'flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0 shadow-sm',
        isUser
          ? 'bg-gradient-to-br from-violet-500 to-purple-600'
          : 'bg-primary'
      )}>
        {isUser
          ? <User className="h-4 w-4 text-white" />
          : <Bot className="h-4 w-4 text-white" />
        }
      </div>

      {/* Bubble */}
      <div className={cn('flex flex-col gap-1 max-w-[80%]', isUser && 'items-end')}>
        <div className={cn(
          'rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm',
          isUser
            ? 'rounded-br-sm bg-gradient-to-br from-violet-600 to-purple-700 text-white'
            : 'rounded-bl-sm bg-card border border-border text-foreground'
        )}>
          {isUser
            ? <p className="whitespace-pre-wrap">{message.content}</p>
            : <MarkdownMessage content={message.content} />
          }
        </div>

        {/* Timestamp + actions row */}
        <div className={cn(
          'flex items-center gap-2 px-1 opacity-0 group-hover:opacity-100 transition-opacity',
          isUser && 'flex-row-reverse'
        )}>
          <span className="text-[10px] text-muted-foreground">
            {new Date(message.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {!isUser && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onCopy(message.content)}
                className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                title="Copy"
              >
                <Copy className="h-3 w-3" />
              </button>
              <button
                onClick={() => setFeedback('up')}
                className={cn('p-1 rounded hover:bg-muted transition-colors',
                  feedback === 'up' ? 'text-emerald-500' : 'text-muted-foreground hover:text-foreground'
                )}
                title="Good response"
              >
                <ThumbsUp className="h-3 w-3" />
              </button>
              <button
                onClick={() => setFeedback('down')}
                className={cn('p-1 rounded hover:bg-muted transition-colors',
                  feedback === 'down' ? 'text-red-500' : 'text-muted-foreground hover:text-foreground'
                )}
                title="Bad response"
              >
                <ThumbsDown className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Right sidebar ────────────────────────────────────────────────────────────

const healthColor = (h?: string) => {
  const l = (h || '').toLowerCase()
  return l === 'healthy' ? 'bg-emerald-500' : l === 'warning' ? 'bg-amber-500' : l === 'critical' ? 'bg-red-500' : 'bg-slate-400'
}

const RightSidebar: React.FC<{
  releases: Record<string, string>[]
  recentJira: Record<string, string>[]
  onPromptClick: (text: string) => void
}> = ({ releases, recentJira, onPromptClick }) => (
  <div className="hidden xl:flex flex-col w-72 flex-shrink-0 border-l border-border bg-background overflow-y-auto">
    <div className="p-4 space-y-5">

      {/* Detected Releases */}
      <div>
        <h3 className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          <GitBranch className="h-3.5 w-3.5" /> Detected Releases
        </h3>
        <div className="space-y-1.5">
          {(releases.length > 0 ? releases : [
            { version: 'Optimus', health: 'Healthy', environment: 'LIVE' },
            { version: '3009',    health: 'Healthy', environment: 'LIVE' },
            { version: '1209',    health: 'Healthy', environment: 'LIVE' },
            { version: 'Optimus', health: 'Warning', environment: 'QA' },
            { version: '3009',    health: 'Warning', environment: 'QA' },
          ]).slice(0, 6).map((r, i) => (
            <button
              key={i}
              onClick={() => onPromptClick(`Show details for ${r.version} ${r.environment || ''} release`)}
              className="flex items-center gap-2 w-full text-left rounded-lg px-2.5 py-2 hover:bg-muted/60 transition-colors group"
            >
              <span className={cn('h-2 w-2 rounded-full flex-shrink-0', healthColor(r.health))} />
              <span className="text-sm font-medium text-foreground flex-1">{r.version}</span>
              {i === 0 && (
                <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-[9px] font-semibold px-1.5 py-0.5">
                  Latest
                </span>
              )}
              <span className={cn('text-[9px] font-medium px-1.5 py-0.5 rounded',
                r.environment === 'LIVE' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' :
                'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400'
              )}>
                {r.environment || 'LIVE'}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-border" />

      {/* Recent JIRA Issues */}
      <div>
        <h3 className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          <AlertCircle className="h-3.5 w-3.5" /> Recent Jira Issues
        </h3>
        <div className="space-y-2">
          {(recentJira.length > 0 ? recentJira : [
            { jira_key: 'GETSCTCL-14597', summary: 'Testing Division Application', status: 'open', priority: 'medium' },
            { jira_key: 'GETSCTCL-14593', summary: 'For DMA IBT Retailer, NNF Displayed', status: 'open', priority: 'critical' },
          ]).slice(0, 5).map((issue, i) => (
            <button
              key={i}
              onClick={() => onPromptClick(`Tell me about ${issue.jira_key || issue.jira_id}`)}
              className="w-full text-left rounded-lg px-2.5 py-2 hover:bg-muted/60 transition-colors group"
            >
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <span className="text-[11px] font-mono font-bold text-primary">
                  {issue.jira_key || issue.jira_id}
                </span>
                <span className={cn('text-[9px] font-medium px-1.5 py-0.5 rounded-full',
                  (issue.priority || '').toLowerCase() === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400' :
                  (issue.priority || '').toLowerCase() === 'high' ? 'bg-orange-100 text-orange-700' :
                  'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                )}>
                  {issue.priority || 'Medium'}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground line-clamp-1 group-hover:text-foreground transition-colors">
                {issue.summary || issue.title}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-border" />

      {/* Sample Queries */}
      <div>
        <h3 className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          <Sparkles className="h-3.5 w-3.5" /> Sample Queries
        </h3>
        <div className="space-y-1">
          {[
            'What changed in the latest Optimus patch?',
            'Show RCA for GETSCTCL-14593',
            'Compare 3009 vs 1209 releases',
            'Find workaround for FIX tag 41 issue',
            'Which clients are on latest version?',
          ].map((q, i) => (
            <button
              key={i}
              onClick={() => onPromptClick(q)}
              className="flex items-center gap-2 w-full text-left rounded-lg px-2.5 py-2 hover:bg-muted/60 transition-colors group text-[11px] text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="h-3 w-3 flex-shrink-0 group-hover:text-primary transition-colors" />
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  </div>
)

// ─── Welcome screen ───────────────────────────────────────────────────────────

const WelcomeScreen: React.FC<{
  firstName: string
  onPrompt: (text: string) => void
}> = ({ firstName, onPrompt }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5 }}
    className="flex flex-col items-center justify-center h-full px-6 py-12 text-center"
  >
    {/* Avatar */}
    <div className="relative mb-6">
      <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-600 flex items-center justify-center shadow-xl">
        <Bot className="h-10 w-10 text-white" />
      </div>
      <span className="absolute -bottom-1 -right-1 h-5 w-5 bg-emerald-500 rounded-full border-2 border-background flex items-center justify-center">
        <span className="h-2 w-2 rounded-full bg-white" />
      </span>
    </div>

    <h1 className="text-2xl font-bold text-foreground mb-2">
      Welcome back, <span className="text-primary">{firstName}</span>! 👋
    </h1>
    <p className="text-sm text-muted-foreground mb-8 max-w-md leading-relaxed">
      I'm your ReleaseIQ AI Assistant. Ask me anything about releases, JIRA issues,
      FIX logs, patch notes, client deployments, or trading system operations.
    </p>

    {/* Suggestion cards */}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl">
      {SUGGESTED_PROMPTS.map((p, i) => (
        <motion.button
          key={i}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 + i * 0.07 }}
          onClick={() => onPrompt(p.text)}
          className={cn(
            'flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 text-left',
            'hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm transition-all',
            'group cursor-pointer'
          )}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary flex-shrink-0 group-hover:bg-primary/20 transition-colors">
            {p.icon}
          </span>
          <span className="text-sm text-foreground/80 group-hover:text-foreground transition-colors leading-snug">
            {p.text}
          </span>
        </motion.button>
      ))}
    </div>
  </motion.div>
)

// ─── Main Chat Page ───────────────────────────────────────────────────────────

const ChatPage: React.FC = () => {
  const { user } = useAuthStore()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId] = useState(() => `session_${Date.now()}`)
  const [copied, setCopied] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const firstName = useMemo(() =>
    (user?.full_name?.split(' ')[0] || user?.username || 'there')
  , [user])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading, scrollToBottom])

  // Real releases & issues for sidebar
  const { data: releasesData } = useQuery({
    queryKey: ['chat-releases'],
    queryFn: async () => {
      try { return (await releasesApi.list({ page_size: 6 })).data?.items ?? [] }
      catch { return [] }
    },
    staleTime: 5 * 60 * 1000,
  })

  const { data: issuesData } = useQuery({
    queryKey: ['chat-issues'],
    queryFn: async () => {
      try { return (await issuesApi.list({ page_size: 5 })).data?.items ?? [] }
      catch { return [] }
    },
    staleTime: 5 * 60 * 1000,
  })

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isLoading) return

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      const res = await chatApi.sendMessage(trimmed, sessionId)
      const data = res.data
      const assistantMsg = data.assistant_message || data
      const aiMsg: ChatMessage = {
        id: assistantMsg.id || `ai_${Date.now()}`,
        role: 'assistant',
        content: assistantMsg.content || data.message || data.content || 'Sorry, I could not generate a response.',
        timestamp: assistantMsg.created_at || new Date().toISOString(),
      }
      setMessages((prev) => [...prev, aiMsg])
    } catch {
      setMessages((prev) => [...prev, {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
      }])
    } finally {
      setIsLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isLoading, sessionId])

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
  }

  return (
    <div className="flex h-full overflow-hidden bg-background">
      {/* ── Main chat area ─────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <WelcomeScreen firstName={firstName} onPrompt={sendMessage} />
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
              <AnimatePresence initial={false}>
                {messages.map((msg, i) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    index={i}
                    onCopy={handleCopy}
                  />
                ))}
                {isLoading && (
                  <motion.div
                    key="typing"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                  >
                    <TypingIndicator />
                  </motion.div>
                )}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* ── Input area ─────────────────────────────────────────────────── */}
        <div className="border-t border-border bg-background/95 backdrop-blur-sm px-4 py-3">
          <div className="max-w-3xl mx-auto">
            <div className={cn(
              'flex items-end gap-2 rounded-2xl border bg-card px-4 py-3 transition-all',
              input ? 'border-primary/50 ring-1 ring-primary/20' : 'border-border hover:border-border/80'
            )}>
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Ask about releases, issues, logs, or anything..."
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none min-h-[24px] max-h-[160px] leading-6"
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isLoading}
                className={cn(
                  'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-all',
                  input.trim() && !isLoading
                    ? 'bg-primary text-white hover:bg-primary/90 shadow-sm'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                )}
              >
                {isLoading
                  ? <RefreshCcw className="h-4 w-4 animate-spin" />
                  : <Send className="h-4 w-4" />
                }
              </button>
            </div>

            {/* Quick chips — shown only when no messages */}
            {messages.length === 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[
                  'Find GETSCTCL-14597',
                  'Optimus patch notes',
                  'Critical bugs',
                  'Client release status',
                ].map((chip) => (
                  <button
                    key={chip}
                    onClick={() => sendMessage(chip)}
                    className="rounded-full border border-border bg-muted/40 px-3 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground hover:border-border/80 transition-all"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            )}

            <p className="text-center text-[10px] text-muted-foreground mt-2">
              ReleaseIQ AI · Powered by Claude Haiku · Always verify with source documents
            </p>
          </div>
        </div>
      </div>

      {/* ── Right sidebar ───────────────────────────────────────────────── */}
      <RightSidebar
        releases={(releasesData ?? []) as Record<string, string>[]}
        recentJira={(issuesData ?? []) as Record<string, string>[]}
        onPromptClick={sendMessage}
      />
    </div>
  )
}

export default ChatPage
