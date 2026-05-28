import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mail,
  Send,
  Search,
  Plus,
  X,
  Paperclip,
  Brain,
  Clock,
  Inbox,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { cn } from '@/utils/cn'
import type { Email } from '@/types'

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_EMAILS: Email[] = [
  {
    id: '1',
    subject: 'URGENT: FIX Session Drop on NSE — JIRA-1039',
    from_address: 'kotak-it@kotak.com',
    to_addresses: ['support@greeksoft.co.in'],
    body: `Dear GreekSoft Support,\n\nWe are observing frequent FIX session drops on our NSE trading gateway since upgrading to v9.47 yesterday. The issue seems to occur during peak market hours (9:30–10:30 AM) when order volumes exceed 15,000/min.\n\nPlease treat this as a P1 escalation. Our trading operations are severely impacted.\n\nError from fix_engine.log:\n[09:32:11.445] WARN  QuickFIXJ - Session DROP: SENDERCOMPID=KOTAK heartbeat timeout after 30s\n[09:32:11.447] ERROR QuickFIXJ - Reconnection failed: max_retries=3 exceeded\n\nKindly acknowledge and provide an ETA for resolution.\n\nRegards,\nIT Team\nKotak Securities`,
    received_at: '2025-05-28T09:45:00Z',
    type: 'escalation',
    is_read: false,
    attachments: ['fix_engine_20250528.log'],
  },
  {
    id: '2',
    subject: 'Re: v9.48 Deployment Confirmation — HDFC Securities',
    from_address: 'deepak.mehta@hdfc.com',
    to_addresses: ['releases@greeksoft.co.in'],
    body: `Hi Team,\n\nThank you for coordinating the v9.48 deployment on our UAT environment. The deployment completed successfully at 02:15 AM IST.\n\nInitial smoke tests look good. We will run full regression over the weekend and confirm production go-ahead by Monday EOD.\n\nPlease note:\n- Our OMS memory baseline: 2.1 GB (healthy)\n- FIX heartbeat stable for 4 hours post-deployment\n- No order rejection in 500 test orders\n\nThanks & Regards,\nDeepak Mehta\nHDFC Securities — IT Infrastructure`,
    received_at: '2025-05-27T14:20:00Z',
    type: 'deployment',
    is_read: true,
  },
  {
    id: '3',
    subject: 'RCA Report: OMS Memory Leak — v9.44 to v9.47',
    from_address: 'neha.joshi@greeksoft.co.in',
    to_addresses: ['management@greeksoft.co.in', 'clients@greeksoft.co.in'],
    body: `# Root Cause Analysis: OMS Memory Leak\n\n**Issue**: Progressive heap growth in OMS under cancel-replace storm conditions.\n**Affected Versions**: v9.44, v9.45, v9.46, v9.47\n**Fixed In**: v9.48\n\n## Root Cause\nCancelReplaceOrderProcessor.java line 342: PendingOrderMap not being cleared on order final state transition. Each cancel-replace created a new PendingOrderEntry without garbage collecting the prior entry.\n\n## Impact\n- Memory leak: ~50 MB/hour under load\n- Eventual OOM crash after ~8 hours continuous operation\n\n## Fix\nPR #847: Added explicit map.remove() in OrderStateManager.finalizeOrder(). Validated over 24-hour soak test with 0% memory growth.\n\nThis report is being shared with all affected clients.`,
    received_at: '2025-05-26T11:00:00Z',
    type: 'rca',
    is_read: true,
    attachments: ['RCA_OMS_MemoryLeak_May2025.pdf'],
  },
  {
    id: '4',
    subject: 'NSE Circular NSEIT/CMPT/2025/031 — Compliance Required',
    from_address: 'compliance@nseindia.com',
    to_addresses: ['compliance@greeksoft.co.in'],
    body: `Dear Technology Partner,\n\nNSE India Ltd. is issuing the following compliance circular effective June 15, 2025:\n\nCircular No: NSEIT/CMPT/2025/031\nSubject: New Order Type Identifiers for Algorithmic Trading\n\nAll trading members and their technology partners are required to implement the following changes:\n1. New order type code 0x1F for Iceberg orders\n2. Updated TimeInForce values for pre-open session\n3. Heartbeat interval reduction from 30s to 15s for FIX connectivity\n\nDeadline for compliance: June 15, 2025\n\nPlease acknowledge receipt.`,
    received_at: '2025-05-24T10:30:00Z',
    type: 'release',
    is_read: false,
  },
  {
    id: '5',
    subject: 'Q2 2025 Release Planning — Client Consultation',
    from_address: 'ananya.iyer@greeksoft.co.in',
    to_addresses: ['clients@greeksoft.co.in'],
    body: `Dear Clients,\n\nWe are planning our Q2 2025 release (v9.49) for July 2025 and would like to align with your requirements.\n\nPlanned features:\n1. MCX commodity trading support\n2. BSE equity derivative order types\n3. Enhanced risk check performance (target: <50μs)\n4. Multi-exchange failover support\n\nPlease share your priority requirements by June 5th.\n\nBest regards,\nAnanya Iyer\nProduct Management, GreekSoft Technologies`,
    received_at: '2025-05-22T15:45:00Z',
    type: 'release',
    is_read: true,
  },
  {
    id: '6',
    subject: 'Support Ticket #8821: Zerodha — Order Rejection Issue',
    from_address: 'tech-support@zerodha.com',
    to_addresses: ['support@greeksoft.co.in'],
    body: `Hi,\n\nWe are experiencing intermittent order rejections with error code 1044 (RISK_CHECK_FAILED) for modify orders. This started after applying v9.47 patch.\n\nSteps to reproduce:\n1. Place order for RELIANCE NSE\n2. Immediately send modify order (same quantity, price change only)\n3. ~15% of modify orders get rejected with 1044\n\nThe SKIP_RISK_ON_MODIFY flag seems to be ignored.\n\nAttaching relevant logs.\n\nRegards,\nZerodha Technology Team`,
    received_at: '2025-05-21T13:10:00Z',
    type: 'support',
    is_read: true,
    attachments: ['zerodha_reject_log.txt'],
  },
]

const EMAIL_TEMPLATES = [
  { id: 'rca', label: 'RCA Template', content: '# Root Cause Analysis\n\n**Issue**: \n**Affected Versions**: \n**Fixed In**: \n\n## Root Cause\n\n## Impact\n\n## Fix\n\n## Prevention\n' },
  { id: 'deployment', label: 'Deployment Notice', content: 'Dear Client,\n\nWe are pleased to inform you that version [VERSION] has been deployed to your [ENVIRONMENT] environment on [DATE].\n\n**Deployment Summary**\n- Start Time: \n- End Time: \n- Status: Successful\n\nPlease run your smoke tests and confirm readiness.\n\nRegards,\nGreekSoft Release Team' },
  { id: 'escalation', label: 'Escalation Response', content: 'Dear [CLIENT],\n\nThank you for reaching out. We have received your escalation regarding [ISSUE] and are treating this as P1.\n\n**Current Status**: Under Investigation\n**Assigned To**: [ENGINEER]\n**Expected ETA**: [TIME]\n\nWe will provide updates every 30 minutes until resolution.\n\nRegards,\nGreekSoft Support' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<Email['type'], { label: string; bg: string; text: string }> = {
  support: { label: 'Support', bg: 'bg-blue-100 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-400' },
  deployment: { label: 'Deployment', bg: 'bg-emerald-100 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-400' },
  rca: { label: 'RCA', bg: 'bg-purple-100 dark:bg-purple-950/40', text: 'text-purple-700 dark:text-purple-400' },
  escalation: { label: 'Escalation', bg: 'bg-red-100 dark:bg-red-950/40', text: 'text-red-700 dark:text-red-400' },
  release: { label: 'Release', bg: 'bg-amber-100 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-400' },
  client: { label: 'Client', bg: 'bg-indigo-100 dark:bg-indigo-950/40', text: 'text-indigo-700 dark:text-indigo-400' },
}

function formatEmailDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const hours = Math.floor(diff / 3600000)
  if (hours < 24) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
}

function getSenderName(from: string) {
  const match = from.match(/([^<@]+)/)
  const domain = from.split('@')[1]?.split('.')[0] ?? ''
  return domain.charAt(0).toUpperCase() + domain.slice(1)
}

// ─── Email Item ───────────────────────────────────────────────────────────────

const EmailItem: React.FC<{ email: Email; selected: boolean; onClick: () => void }> = ({ email, selected, onClick }) => {
  const typeCfg = TYPE_CONFIG[email.type]
  return (
    <motion.button
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        'w-full text-left px-4 py-3 border-b border-border transition-colors hover:bg-muted/40',
        selected && 'bg-primary/5 border-l-2 border-l-primary',
        !email.is_read && 'bg-muted/20'
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-2.5">
        <div className="flex-shrink-0 mt-1">
          {!email.is_read && <span className="h-2 w-2 rounded-full bg-primary block" />}
          {email.is_read && <span className="h-2 w-2 rounded-full block" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className={cn('text-xs font-semibold truncate', !email.is_read ? 'text-foreground' : 'text-muted-foreground')}>
              {getSenderName(email.from_address)}
            </span>
            <span className="text-[10px] text-muted-foreground flex-shrink-0">{formatEmailDate(email.received_at)}</span>
          </div>
          <p className={cn('text-xs truncate mb-1', !email.is_read ? 'font-medium text-foreground' : 'text-muted-foreground')}>{email.subject}</p>
          <div className="flex items-center gap-1.5">
            <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-medium', typeCfg.bg, typeCfg.text)}>{typeCfg.label}</span>
            {email.attachments && email.attachments.length > 0 && (
              <Paperclip className="h-2.5 w-2.5 text-muted-foreground" />
            )}
          </div>
        </div>
      </div>
    </motion.button>
  )
}

// ─── Email Reader ─────────────────────────────────────────────────────────────

const EmailReader: React.FC<{ email: Email }> = ({ email }) => {
  const typeCfg = TYPE_CONFIG[email.type]
  return (
    <div className="flex flex-col h-full">
      <div className="p-5 border-b border-border">
        <div className="flex items-start justify-between gap-4 mb-3">
          <h2 className="text-base font-semibold text-foreground leading-snug flex-1">{email.subject}</h2>
          <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium flex-shrink-0', typeCfg.bg, typeCfg.text)}>{typeCfg.label}</span>
        </div>
        <div className="space-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground w-8">From:</span>
            <span>{email.from_address}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground w-8">To:</span>
            <span>{email.to_addresses.join(', ')}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3" />
            <span>{new Date(email.received_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
          </div>
        </div>
        {email.attachments && email.attachments.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {email.attachments.map((a) => (
              <div key={a} className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1 text-xs text-foreground">
                <Paperclip className="h-3 w-3 text-muted-foreground" />
                {a}
              </div>
            ))}
          </div>
        )}
      </div>
      <ScrollArea className="flex-1 p-5">
        <pre className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed font-sans">{email.body}</pre>
      </ScrollArea>
    </div>
  )
}

// ─── Compose Dialog ───────────────────────────────────────────────────────────

interface ComposeForm {
  to: string
  subject: string
  body: string
  type: Email['type']
  template: string
}

const ComposeDialog: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const [form, setForm] = useState<ComposeForm>({ to: '', subject: '', body: '', type: 'support', template: '' })
  const [aiDrafting, setAiDrafting] = useState(false)

  const set = (field: keyof ComposeForm) => (v: string) => setForm((prev) => ({ ...prev, [field]: v }))

  const handleTemplate = (templateId: string) => {
    const t = EMAIL_TEMPLATES.find((t) => t.id === templateId)
    if (t) setForm((prev) => ({ ...prev, body: t.content, template: templateId }))
  }

  const handleAiDraft = () => {
    setAiDrafting(true)
    setTimeout(() => {
      setForm((prev) => ({
        ...prev,
        body: `Dear Client,\n\nThank you for reaching out to GreekSoft Support.\n\nRegarding your inquiry about "${prev.subject}", our team has reviewed the situation and can confirm:\n\n1. We have identified the root cause as a configuration issue in the FIX engine heartbeat settings introduced in v9.47.\n\n2. A targeted patch is available in v9.48 which fully resolves this issue.\n\n3. We recommend upgrading to v9.48 at your earliest convenience. Our team can assist with a guided upgrade session.\n\nPlease let us know a convenient time for a technical call.\n\nBest regards,\nGreekSoft Technical Support`,
      }))
      setAiDrafting(false)
    }, 1800)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Send className="h-4 w-4" /> Compose Email</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">To</Label>
              <Input value={form.to} onChange={(e) => set('to')(e.target.value)} placeholder="recipient@client.com" className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email Type</Label>
              <Select value={form.type} onValueChange={(v) => set('type')(v as Email['type'])}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_CONFIG).map(([v, cfg]) => (
                    <SelectItem key={v} value={v}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Subject</Label>
            <Input value={form.subject} onChange={(e) => set('subject')(e.target.value)} placeholder="Email subject" className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Body</Label>
              <div className="flex items-center gap-2">
                <Select value={form.template} onValueChange={handleTemplate}>
                  <SelectTrigger className="h-7 text-xs w-40"><SelectValue placeholder="Use template" /></SelectTrigger>
                  <SelectContent>
                    {EMAIL_TEMPLATES.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={handleAiDraft} disabled={aiDrafting}>
                  <Brain className={cn('h-3 w-3', aiDrafting && 'animate-pulse')} />
                  {aiDrafting ? 'Drafting…' : 'AI Draft'}
                </Button>
              </div>
            </div>
            <textarea
              value={form.body}
              onChange={(e) => set('body')(e.target.value)}
              placeholder="Compose your email..."
              className="w-full min-h-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" className="gap-1.5" disabled={!form.to || !form.subject}>
            <Send className="h-3.5 w-3.5" /> Send
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const EmailsPage: React.FC = () => {
  const [emails] = useState<Email[]>(MOCK_EMAILS)
  const [selectedId, setSelectedId] = useState<string>(MOCK_EMAILS[0].id)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [composeOpen, setComposeOpen] = useState(false)

  const filtered = useMemo(() =>
    emails.filter((e) => {
      const matchSearch = !search || e.subject.toLowerCase().includes(search.toLowerCase()) || e.from_address.toLowerCase().includes(search.toLowerCase())
      const matchType = typeFilter === 'all' || e.type === typeFilter
      return matchSearch && matchType
    }),
    [emails, search, typeFilter]
  )

  const selectedEmail = emails.find((e) => e.id === selectedId) ?? null
  const unreadCount = emails.filter((e) => !e.is_read).length

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Emails"
        subtitle="Manage client communications, RCA reports, deployment notices, and support tickets."
        actions={
          <Button size="sm" className="gap-1.5" onClick={() => setComposeOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Compose
          </Button>
        }
      />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-260px)] min-h-[500px]"
      >
        {/* Left panel — inbox list */}
        <Card className="flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <Inbox className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Inbox</span>
              {unreadCount > 0 && (
                <span className="ml-auto rounded-full bg-primary text-primary-foreground text-[10px] font-medium px-1.5 py-0.5">{unreadCount}</span>
              )}
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search emails..." className="pl-7 h-8 text-xs" />
            </div>
            <div className="flex gap-1 mt-2 flex-wrap">
              {(['all', 'support', 'deployment', 'rca', 'escalation', 'release'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors capitalize',
                    typeFilter === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <ScrollArea className="flex-1">
            {filtered.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">No emails found</div>
            ) : (
              filtered.map((email) => (
                <EmailItem
                  key={email.id}
                  email={email}
                  selected={selectedId === email.id}
                  onClick={() => setSelectedId(email.id)}
                />
              ))
            )}
          </ScrollArea>
        </Card>

        {/* Right panel — email reader */}
        <Card className="lg:col-span-2 flex flex-col overflow-hidden">
          {selectedEmail ? (
            <EmailReader email={selectedEmail} />
          ) : (
            <EmptyState icon={<Mail />} title="Select an email" description="Choose an email from the inbox to read it." compact />
          )}
        </Card>
      </motion.div>

      <ComposeDialog open={composeOpen} onClose={() => setComposeOpen(false)} />
    </div>
  )
}

export default EmailsPage
