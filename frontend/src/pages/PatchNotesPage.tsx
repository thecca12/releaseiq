import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  Search,
  ChevronDown,
  ChevronRight,
  FileStack,
  Calendar,
  GitCompare,
  X,
  Bot,
  Download,
  RefreshCcw,
  CheckCircle2,
  Tag,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { cn } from '@/utils/cn'
import { patchNotesApi } from '@/services/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PatchNote {
  version: string
  filename?: string
  release_date: string
  environments: string[]
  jira_refs: string[]
  qa_notes: string
  live_notes: string
  summary?: string
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_PATCH_NOTES: PatchNote[] = [
  {
    version: 'v9.48',
    release_date: '2025-05-20',
    environments: ['qa', 'live'],
    jira_refs: ['JIRA-1024', 'JIRA-1039', 'JIRA-1040', 'JIRA-1045'],
    qa_notes: `## QA Patch Notes — v9.48

### FIX Engine
- Reverted QuickFIX/J from 2.3.1 to 2.2.0 to resolve session drop issue (JIRA-1039)
- Added adaptive thread-pool sizing via FIX_MAX_THREADS config
- Improved heartbeat resilience under sustained load > 15k msg/sec

### OMS
- Fixed memory leak in cancel-replace order batching logic (JIRA-1040)
- Heap usage stabilized at < 70% during mass order modifications
- Reduced GC pressure by 40% during order storms

### RMS
- Minor stability improvements to risk check validation chain
- Updated SKIP_RISK_ON_MODIFY flag behavior documentation

### Testing Notes
- Full regression suite passed: 847/847 test cases
- Load test at 18k msg/sec for 2 hours — no session drops observed`,
    live_notes: `## LIVE Deployment Notes — v9.48

### Deployment Summary
- Deployed to production on 2025-05-22 02:15 IST (maintenance window)
- All clients migrated successfully: Kotak, HDFC, Axis, Motilal Oswal

### FIX Session Stability
- FIX session stability significantly improved post QuickFIX/J rollback
- Heartbeat success rate: 99.97% (up from 96.2% in v9.47)

### Known Issues in Live
- None critical at time of deployment

### Rollback Plan
- Rollback to v9.47.1 available within 15 minutes if needed
- Contact: deployment-team@greeksoft.co.in`,
    summary: 'Full production release with FIX engine revert to QuickFIX/J 2.2.0, OMS memory leak fix, and stability improvements. Key focus: FIX session reliability under high throughput.',
  },
  {
    version: 'v9.47',
    release_date: '2025-05-05',
    environments: ['qa', 'live'],
    jira_refs: ['JIRA-1021', 'JIRA-1022', 'JIRA-1030', 'JIRA-1031'],
    qa_notes: `## QA Patch Notes — v9.47

### Pre-open Session Handling
- Added support for order modifications during pre-open session (9:00–9:15 AM)
- New flag: PRE_OPEN_MODIFICATIONS (default: true)
- New risk bypass: SKIP_RISK_ON_MODIFY — CAUTION: NPE reported in testing (JIRA-1042)

### FIX Engine Upgrade (ROLLED BACK in v9.47.1)
- Upgraded QuickFIX/J to 2.3.1 with work-stealing thread pool
- Performance gain: ~18% throughput improvement under normal load
- Issue discovered: session drops at > 15k msg/sec sustained (JIRA-1039)

### OMS Batching
- Cancel-replace order batching: up to 200 orders/batch
- Memory leak discovered under cancel-replace storm scenario (JIRA-1038)`,
    live_notes: `## LIVE Deployment Notes — v9.47

### Deployment Summary
- Deployed on 2025-05-10 03:00 IST
- Deployed to: Zerodha, ICICI Direct

### Known Live Issues
- FIX session instability at peak hours (> 15k msg/sec) — JIRA-1039
- RMS NPE on order modifications with SKIP_RISK_ON_MODIFY=true — JIRA-1042
- Patch v9.47.1 available to address above issues

### Recommendation
Clients on v9.47 should upgrade to v9.47.1 or v9.48 immediately`,
    summary: 'Major feature release introducing pre-open session order modifications and FIX 5.0 SP2 upgrade. FIX engine later reverted in v9.47.1 due to session stability issues.',
  },
  {
    version: 'v9.46',
    release_date: '2025-04-18',
    environments: ['qa', 'live'],
    jira_refs: ['JIRA-1019', 'JIRA-1021', 'JIRA-1022'],
    qa_notes: `## QA Patch Notes — v9.46

### NSE Circular Compliance
- Implemented new order type codes per NSE/TECH/48832
  - AMO (After Market Order) = type code 7
  - GTD (Good-Till-Date) = type code 8
- Updated FIX tag 40 mapping for BSE and NSE
- New flags: AMO_ORDER_ENABLE, GTD_ORDER_ENABLE

### FIX Protocol
- Added validation for NSE order type code range (1–9)
- Reject orders with undefined type codes with error 1003

### Test Coverage
- New test cases for AMO and GTD order flows: 24 cases added
- All regression tests passed: 823/823`,
    live_notes: `## LIVE Deployment Notes — v9.46

### Deployment Summary
- Deployed on 2025-04-28 01:00 IST (weekend maintenance)
- Clients: Kotak, HDFC, Axis, Zerodha — all environments updated

### NSE Compliance
- NSE/TECH/48832 compliance verified by NSE testing team
- Compliance certificate received and archived

### Post-deployment Health
- Health score: 98% — best in last 6 months
- Zero support tickets in first 48 hours post-deployment`,
    summary: 'NSE circular NSE/TECH/48832 compliance release adding AMO and GTD order type codes. Widely deployed — highest health score (98%) of recent releases.',
  },
  {
    version: 'v9.45',
    release_date: '2025-04-05',
    environments: ['qa'],
    jira_refs: ['JIRA-1010', 'JIRA-1011', 'JIRA-1012'],
    qa_notes: `## QA Patch Notes — v9.45

### Performance Improvements
- RMS risk check throughput improved by 25% (multi-threaded validation)
- OMS order routing optimized for basket orders
- Server process startup time reduced from 45s to 28s

### Dynamic Risk Parameter Reload
- Fixed JIRA-1012: Risk parameters now reload at runtime without restart
- New API: POST /api/rms/reload-risk-params
- Changes propagate to all risk threads within 2 seconds

### Stability
- SERVER reconnect interval made configurable (SERVER_RECONNECT_INTERVAL)
- Added exponential backoff for exchange reconnection attempts`,
    live_notes: '',
    summary: 'Q2 2025 quarterly release with performance improvements. Dynamic risk parameter reload fix is the key change for operational teams.',
  },
  {
    version: 'v9.44',
    release_date: '2025-03-20',
    environments: ['live'],
    jira_refs: ['JIRA-1000', 'JIRA-1001', 'JIRA-1003'],
    qa_notes: '',
    live_notes: `## LIVE Deployment Notes — v9.44

### FIX Engine Upgrade
- Initial upgrade to QuickFIX/J 2.3.1 (later rolled back in v9.47.1)
- Thread pool model changed to work-stealing (java.util.concurrent.ForkJoinPool)

### Known Critical Issues (Identified Post-deployment)
- JIRA-1003: FIX hangs on malformed heartbeat payload (hotfix applied inline)
- JIRA-1001: Bracket order rejection on BSE (root cause: incorrect order type mapping)

### Client Impact
- Sharekhan: Affected by JIRA-1001 — BSE bracket orders rejected
- Escalation handled by support team

### Status
- v9.44 flagged as critical — upgrade to v9.48 strongly recommended`,
    summary: 'Initial FIX engine upgrade to QuickFIX/J 2.3.1. Known critical issues — clients still on v9.44 should upgrade immediately to v9.48.',
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })
}

const ENV_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  qa: { label: 'QA', bg: 'bg-blue-100 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-400' },
  live: { label: 'LIVE', bg: 'bg-emerald-100 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-400' },
}

// ─── Compare Dialog ───────────────────────────────────────────────────────────

const CompareDialog: React.FC<{
  notes: PatchNote[]
  open: boolean
  onClose: () => void
}> = ({ notes, open, onClose }) => {
  const [v1, setV1] = useState('')
  const [v2, setV2] = useState('')
  const [compareResult, setCompareResult] = useState<{ v1: PatchNote; v2: PatchNote } | null>(null)

  const versions = notes.map((n) => n.version)

  const handleCompare = () => {
    const note1 = notes.find((n) => n.version === v1)
    const note2 = notes.find((n) => n.version === v2)
    if (note1 && note2) setCompareResult({ v1: note1, v2: note2 })
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompare className="h-4 w-4 text-primary" />
            Compare Patch Notes
          </DialogTitle>
          <DialogDescription>Select two versions to compare their release notes side by side.</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 mt-2">
          <Select value={v1} onValueChange={setV1}>
            <SelectTrigger className="w-40 h-9">
              <SelectValue placeholder="Version 1" />
            </SelectTrigger>
            <SelectContent>
              {versions.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground text-sm">vs</span>
          <Select value={v2} onValueChange={setV2}>
            <SelectTrigger className="w-40 h-9">
              <SelectValue placeholder="Version 2" />
            </SelectTrigger>
            <SelectContent>
              {versions.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={handleCompare} disabled={!v1 || !v2 || v1 === v2} className="gradient-brand border-0 text-white hover:opacity-90">
            <GitCompare className="h-3.5 w-3.5 mr-1.5" /> Compare
          </Button>
        </div>

        {compareResult && (
          <div className="mt-4 grid grid-cols-2 gap-4">
            {([compareResult.v1, compareResult.v2] as PatchNote[]).map((note) => (
              <div key={note.version} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-primary text-sm">{note.version}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(note.release_date)}</span>
                </div>
                {note.qa_notes && (
                  <div>
                    <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-1">QA Notes</p>
                    <div className="rounded-lg bg-muted/40 border border-border p-3 text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                      {note.qa_notes}
                    </div>
                  </div>
                )}
                {note.live_notes && (
                  <div>
                    <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-1">LIVE Notes</p>
                    <div className="rounded-lg bg-muted/40 border border-border p-3 text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                      {note.live_notes}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Patch Note Card ──────────────────────────────────────────────────────────

const PatchNoteCard: React.FC<{
  note: PatchNote
  index: number
}> = ({ note, index }) => {
  const [expanded, setExpanded] = useState(index === 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Card className={cn('hover:shadow-md transition-shadow', expanded && 'shadow-md ring-1 ring-primary/10')}>
        {/* Header row — always visible */}
        <div
          className="flex items-center justify-between px-5 py-4 cursor-pointer select-none"
          onClick={() => setExpanded((v) => !v)}
        >
          <div className="flex flex-wrap items-center gap-2.5">
            {/* expand/collapse chevron */}
            {expanded
              ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            }

            {/* Version badge */}
            <span className="rounded-full bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-400 px-3 py-0.5 text-sm font-bold font-mono">
              {note.version}
            </span>

            {/* Date */}
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {formatDate(note.release_date)}
            </span>

            {/* Environment badges */}
            <div className="flex items-center gap-1">
              {note.environments.map((env) => {
                const cfg = ENV_CONFIG[env.toLowerCase()] ?? { label: env.toUpperCase(), bg: 'bg-muted', text: 'text-foreground' }
                return (
                  <span key={env} className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', cfg.bg, cfg.text)}>
                    {cfg.label}
                  </span>
                )
              })}
            </div>

            {/* JIRA count */}
            {note.jira_refs.length > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Tag className="h-3 w-3" />
                {note.jira_refs.length} JIRA{note.jira_refs.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Ask AI button — stop propagation */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-primary flex-shrink-0"
            onClick={(e) => { e.stopPropagation() }}
          >
            <Bot className="h-3.5 w-3.5" /> Ask AI
          </Button>
        </div>

        {/* Expanded content */}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <Separator />
              <div className="p-5 space-y-4">
                {/* Summary */}
                {note.summary && (
                  <div className="rounded-lg bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800/40 px-4 py-3">
                    <p className="text-[10px] font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide mb-1">Summary</p>
                    <p className="text-xs text-foreground/80 leading-relaxed">{note.summary}</p>
                  </div>
                )}

                {/* JIRA references */}
                {note.jira_refs.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">JIRA References</p>
                    <div className="flex flex-wrap gap-1.5">
                      {note.jira_refs.map((ref) => (
                        <span
                          key={ref}
                          className="rounded-md bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 text-[11px] font-mono font-semibold"
                        >
                          {ref}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Two-column notes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* QA Notes */}
                  {note.qa_notes ? (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
                        <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">QA Patch Notes</p>
                      </div>
                      <div className="rounded-lg bg-blue-50/50 dark:bg-blue-950/10 border border-blue-200/60 dark:border-blue-800/30 p-4 text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed font-mono max-h-72 overflow-y-auto">
                        {note.qa_notes}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border p-4 flex items-center justify-center text-xs text-muted-foreground">
                      No QA notes for this version
                    </div>
                  )}

                  {/* LIVE Notes */}
                  {note.live_notes ? (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0" />
                        <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">LIVE Deployment Notes</p>
                      </div>
                      <div className="rounded-lg bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-200/60 dark:border-emerald-800/30 p-4 text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed font-mono max-h-72 overflow-y-auto">
                        {note.live_notes}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border p-4 flex items-center justify-center text-xs text-muted-foreground">
                      Not yet deployed to LIVE
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const PatchNotesPage: React.FC = () => {
  const [search, setSearch] = useState('')
  const [envFilter, setEnvFilter] = useState('all')
  const [versionFilter, setVersionFilter] = useState('all')
  const [compareOpen, setCompareOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['patch-notes'],
    queryFn: async () => {
      try {
        const res = await patchNotesApi.list()
        const items = (res.data?.items ?? res.data) as PatchNote[]
        if (Array.isArray(items) && items.length > 0) return items
        return MOCK_PATCH_NOTES
      } catch {
        return MOCK_PATCH_NOTES
      }
    },
  })

  const notes = data ?? MOCK_PATCH_NOTES
  const versions = useMemo(() => notes.map((n) => n.version), [notes])

  const filtered = useMemo(() => {
    return notes.filter((n) => {
      const q = search.toLowerCase()
      const matchSearch = !search
        || n.version.toLowerCase().includes(q)
        || n.qa_notes.toLowerCase().includes(q)
        || n.live_notes.toLowerCase().includes(q)
        || n.summary?.toLowerCase().includes(q)
        || n.jira_refs.some((r) => r.toLowerCase().includes(q))
      const matchEnv = envFilter === 'all' || n.environments.map((e) => e.toLowerCase()).includes(envFilter)
      const matchVersion = versionFilter === 'all' || n.version === versionFilter
      return matchSearch && matchEnv && matchVersion
    })
  }, [notes, search, envFilter, versionFilter])

  const hasFilters = search || envFilter !== 'all' || versionFilter !== 'all'
  const clearFilters = () => { setSearch(''); setEnvFilter('all'); setVersionFilter('all') }

  // Stats
  const stats = useMemo(() => ({
    total: notes.length,
    withQa: notes.filter((n) => n.qa_notes).length,
    withLive: notes.filter((n) => n.live_notes).length,
    totalJiras: notes.reduce((sum, n) => sum + n.jira_refs.length, 0),
  }), [notes])

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Historic Patch / Release Notes"
        subtitle="Browse QA and LIVE patch notes for all release versions. Expand a card to view detailed notes."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setCompareOpen(true)}>
              <GitCompare className="h-3.5 w-3.5" /> Compare Versions
            </Button>
            <Button size="sm" className="gap-1.5 gradient-brand border-0 text-white hover:opacity-90">
              <RefreshCcw className="h-3.5 w-3.5" /> Sync
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Versions', value: stats.total, color: 'text-foreground' },
          { label: 'With QA Notes', value: stats.withQa, color: 'text-blue-600 dark:text-blue-400' },
          { label: 'With Live Notes', value: stats.withLive, color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Total JIRAs', value: stats.totalJiras, color: 'text-violet-600 dark:text-violet-400' },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardContent className="p-4 text-center">
              <p className={cn('text-2xl font-bold tabular-nums', color)}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Filters */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes, version, JIRA…"
            className="pl-8 h-9 text-sm"
          />
          {search && (
            <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setSearch('')}>
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <Select value={versionFilter} onValueChange={setVersionFilter}>
          <SelectTrigger className="w-36 h-9 text-sm">
            <SelectValue placeholder="Version" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All versions</SelectItem>
            {versions.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={envFilter} onValueChange={setEnvFilter}>
          <SelectTrigger className="w-36 h-9 text-sm">
            <SelectValue placeholder="Environment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All environments</SelectItem>
            <SelectItem value="qa">QA</SelectItem>
            <SelectItem value="live">LIVE</SelectItem>
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-9 gap-1 text-xs" onClick={clearFilters}>
            <X className="h-3 w-3" /> Clear
          </Button>
        )}
      </motion.div>

      <p className="text-xs text-muted-foreground">
        Showing <span className="font-medium text-foreground">{filtered.length}</span> version{filtered.length !== 1 ? 's' : ''} — click any card to expand release notes
      </p>

      {/* Timeline list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FileStack />}
          title="No patch notes found"
          description="Try adjusting your search or filters."
          action={{ label: 'Clear filters', onClick: clearFilters }}
          compact
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((note, i) => (
            <PatchNoteCard key={note.version} note={note} index={i} />
          ))}
        </div>
      )}

      <CompareDialog notes={notes} open={compareOpen} onClose={() => setCompareOpen(false)} />
    </div>
  )
}

export default PatchNotesPage
