import React, { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  Search,
  Filter,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Eye,
  ExternalLink,
  X,
  AlertCircle,
  RefreshCcw,
  Download,
  Clock,
  User,
  Package,
  GitBranch,
  FileText,
  MessageSquare,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/utils/cn'
import { issuesApi } from '@/services/api'
import type { JiraIssue } from '@/types'

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_ISSUES: JiraIssue[] = [
  { id: '1', jira_id: 'JIRA-1042', title: 'Order rejection in RMS v9.47 — NPE in risk check bypass', status: 'Open', priority: 'Critical', assignee: 'Rahul Mehta', created_at: '2025-05-18T09:32:11Z', updated_at: '2025-05-20T14:00:00Z', module: 'RMS', affected_versions: ['v9.47', 'v9.46'], description: 'Order modification API throws NPE when risk check is bypassed during pre-open session. Stack trace points to RiskManager.validateModification() line 412.' },
  { id: '2', jira_id: 'JIRA-1039', title: 'FIX session drops under sustained load > 15k msg/sec', status: 'In Progress', priority: 'High', assignee: 'Vikram Nair', created_at: '2025-05-14T11:00:00Z', updated_at: '2025-05-21T09:00:00Z', module: 'FIX', affected_versions: ['v9.47', 'v9.48'], description: 'FIX gateway drops sessions when message throughput exceeds 15,000 msg/sec sustained for >30 seconds. Thread-pool starvation in QuickFIX/J 2.3.1.' },
  { id: '3', jira_id: 'JIRA-1038', title: 'OMS memory leak during cancel-replace order storm', status: 'In Progress', priority: 'High', assignee: 'Priya Sharma', created_at: '2025-05-16T08:45:00Z', updated_at: '2025-05-21T11:30:00Z', module: 'OMS', affected_versions: ['v9.47'], description: 'Memory leak identified in OMS cancel-replace batching logic. Heap usage climbs to 94% during mass order modifications, triggering GC pressure and latency spikes.' },
  { id: '4', jira_id: 'JIRA-1035', title: 'SERVER restarts unexpectedly on NSE gateway disconnect', status: 'Open', priority: 'Medium', assignee: 'Arun Kumar', created_at: '2025-05-12T16:30:00Z', updated_at: '2025-05-18T12:00:00Z', module: 'SERVER', affected_versions: ['v9.47'], description: 'Trading server process restarts when NSE gateway connection is lost during market hours. Reconnect logic does not handle the gateway-side disconnect gracefully.' },
  { id: '5', jira_id: 'JIRA-1031', title: 'Client login times out after 10 minutes of idle', status: 'Open', priority: 'Low', assignee: 'Sunita Rao', created_at: '2025-05-10T14:00:00Z', updated_at: '2025-05-15T10:00:00Z', module: 'CLIENT', affected_versions: ['v9.46', 'v9.47'], description: 'Client session token is not refreshed during idle periods. After ~10 minutes, the next action fails with a 401 Unauthorized error.' },
  { id: '6', jira_id: 'JIRA-1021', title: 'NSE circular compliance — implement new order type codes', status: 'Closed', priority: 'Medium', assignee: 'Anita Desai', created_at: '2025-04-02T10:00:00Z', updated_at: '2025-04-28T08:00:00Z', module: 'RMS', affected_versions: ['v9.46'], description: 'NSE circular NSE/TECH/48832 mandates new order type codes: AMO=7, GTD=8. FIX tag 40 mapping must be updated. Deployment deadline: April 10, 2025.' },
  { id: '7', jira_id: 'JIRA-1020', title: 'Server process crashes on NSE failover trigger', status: 'Resolved', priority: 'High', assignee: 'Rahul Mehta', created_at: '2025-04-01T07:00:00Z', updated_at: '2025-04-18T17:00:00Z', module: 'SERVER', affected_versions: ['v9.45', 'v9.45.2'], description: 'When NSE primary gateway fails over to secondary, trading server does not reconnect and the process eventually crashes after 5 minutes.' },
  { id: '8', jira_id: 'JIRA-1012', title: 'RMS risk parameter reload not applied at runtime', status: 'Resolved', priority: 'Medium', assignee: 'Priya Sharma', created_at: '2025-03-20T09:00:00Z', updated_at: '2025-04-14T16:00:00Z', module: 'RMS', affected_versions: ['v9.44', 'v9.45'], description: 'Dynamic risk parameter reload via API does not propagate to all risk check threads. Requires process restart for changes to take effect.' },
  { id: '9', jira_id: 'JIRA-1003', title: 'FIX engine hangs on malformed heartbeat payload', status: 'Resolved', priority: 'Critical', assignee: 'Vikram Nair', created_at: '2025-03-02T11:00:00Z', updated_at: '2025-03-31T14:00:00Z', module: 'FIX', affected_versions: ['v9.44'], description: 'QuickFIX/J 2.3.1 introduced a bug where a heartbeat with payload size=0 causes an infinite loop in the message parsing thread.' },
  { id: '10', jira_id: 'JIRA-1001', title: 'Client bracket order rejected on BSE exchange', status: 'Closed', priority: 'Low', assignee: 'Sunita Rao', created_at: '2025-02-28T15:00:00Z', updated_at: '2025-03-15T10:00:00Z', module: 'CLIENT', affected_versions: ['v9.43', 'v9.44'], description: 'Bracket orders placed via client UI are rejected by BSE with error code 16. Root cause was incorrect target order type mapping for BSE bracket orders.' },
]

// ─── Priority badge ───────────────────────────────────────────────────────────

const PriorityBadge: React.FC<{ priority: JiraIssue['priority'] }> = ({ priority }) => {
  const map = {
    Critical: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
    High: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400',
    Medium: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
    Low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  }
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium', map[priority])}>
      {priority}
    </span>
  )
}

const statusMap: Record<string, string> = {
  Open: 'open',
  'In Progress': 'in_progress',
  Resolved: 'resolved',
  Closed: 'completed',
}

// ─── Sort icon ────────────────────────────────────────────────────────────────

type SortDir = 'asc' | 'desc' | null
const SortIcon: React.FC<{ dir: SortDir }> = ({ dir }) => {
  if (dir === 'asc') return <ChevronUp className="h-3 w-3" />
  if (dir === 'desc') return <ChevronDown className="h-3 w-3" />
  return <ChevronsUpDown className="h-3 w-3 opacity-40" />
}

// ─── Issue detail dialog ──────────────────────────────────────────────────────

const IssueDetailDialog: React.FC<{ issue: JiraIssue | null; onClose: () => void }> = ({ issue, onClose }) => {
  if (!issue) return null

  return (
    <Dialog open={!!issue} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono text-primary">{issue.jira_id}</span>
            <PriorityBadge priority={issue.priority} />
          </DialogTitle>
          <DialogDescription className="text-left text-foreground/80 font-medium mt-1">
            {issue.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              <p className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">Status</p>
              <StatusBadge status={statusMap[issue.status] ?? 'unknown'} size="sm" label={issue.status} />
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">Priority</p>
              <PriorityBadge priority={issue.priority} />
            </div>
            {issue.assignee && (
              <div className="space-y-1">
                <p className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">Assignee</p>
                <p className="flex items-center gap-1 text-foreground"><User className="h-3 w-3" /> {issue.assignee}</p>
              </div>
            )}
            {issue.module && (
              <div className="space-y-1">
                <p className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">Module</p>
                <p className="flex items-center gap-1 text-foreground"><Package className="h-3 w-3" /> {issue.module}</p>
              </div>
            )}
            <div className="space-y-1">
              <p className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">Created</p>
              <p className="flex items-center gap-1 text-foreground">
                <Clock className="h-3 w-3" />
                {new Date(issue.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">Updated</p>
              <p className="flex items-center gap-1 text-foreground">
                <Clock className="h-3 w-3" />
                {new Date(issue.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>

          {issue.affected_versions && issue.affected_versions.length > 0 && (
            <div>
              <p className="text-muted-foreground font-medium uppercase tracking-wide text-[10px] mb-2">Affected Versions</p>
              <div className="flex flex-wrap gap-1.5">
                {issue.affected_versions.map((v) => (
                  <span key={v} className="rounded-md bg-muted px-2 py-0.5 text-xs font-mono font-medium text-foreground">{v}</span>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {issue.description && (
            <div>
              <p className="text-muted-foreground font-medium uppercase tracking-wide text-[10px] mb-2">Description</p>
              <p className="text-sm text-foreground/80 leading-relaxed">{issue.description}</p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <ExternalLink className="h-3.5 w-3.5" /> Open in Jira
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <MessageSquare className="h-3.5 w-3.5" /> Ask AI About This
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type SortField = 'jira_id' | 'title' | 'status' | 'priority' | 'assignee' | 'module' | 'created_at'

const PRIORITY_ORDER: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 }
const STATUS_ORDER: Record<string, number> = { Open: 0, 'In Progress': 1, Resolved: 2, Closed: 3 }

const JiraIssuesPage: React.FC = () => {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')
  const [filterModule, setFilterModule] = useState('all')
  const [filterAssignee, setFilterAssignee] = useState('all')
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selectedIssue, setSelectedIssue] = useState<JiraIssue | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['jira-issues'],
    queryFn: async () => {
      try {
        const res = await issuesApi.list({ page_size: 100 })
        // Backend returns real JIRA data — map to display format
        const raw = res.data?.items ?? res.data
        // Normalize backend enum values to UI display strings
        const normStatus = (s: unknown): JiraIssue['status'] => {
          const m: Record<string, JiraIssue['status']> = {
            open: 'Open', in_progress: 'In Progress', in_review: 'In Progress',
            testing: 'In Progress', done: 'Resolved', resolved: 'Resolved',
            closed: 'Closed', wont_fix: 'Closed',
          }
          return m[String(s ?? '').toLowerCase()] ?? 'Open'
        }
        const normPriority = (p: unknown): JiraIssue['priority'] => {
          const m: Record<string, JiraIssue['priority']> = {
            critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', trivial: 'Low',
          }
          return m[String(p ?? '').toLowerCase()] ?? 'Medium'
        }
        if (Array.isArray(raw) && raw.length > 0) {
          return raw.map((item: Record<string, unknown>, idx: number) => ({
            id: String(item.id ?? idx + 1),
            jira_id: String(item.jira_key ?? item.jira_id ?? `JIRA-${1000 + idx}`),
            title: String(item.summary ?? item.title ?? ''),
            status: normStatus(item.status),
            priority: normPriority(item.priority),
            assignee: item.assignee as string | undefined,
            created_at: String(item.created_at ?? new Date().toISOString()),
            updated_at: String(item.updated_at ?? new Date().toISOString()),
            module: item.module as string | undefined,
            affected_versions: item.affected_version
              ? [String(item.affected_version)]
              : (item.affected_versions as string[] | undefined),
            description: item.description as string | undefined,
          })) as JiraIssue[]
        }
        return MOCK_ISSUES
      } catch {
        return MOCK_ISSUES
      }
    },
  })

  const issues = data ?? MOCK_ISSUES

  const assignees = useMemo(() => Array.from(new Set(issues.map((i) => i.assignee).filter(Boolean) as string[])), [issues])
  const modules = useMemo(() => Array.from(new Set(issues.map((i) => i.module).filter(Boolean) as string[])), [issues])

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }, [sortField])

  const getSortDir = (field: SortField): SortDir => sortField === field ? sortDir : null

  const filtered = useMemo(() => {
    let items = issues.filter((i) => {
      const q = search.toLowerCase()
      const matchSearch = !search
        || i.jira_id.toLowerCase().includes(q)
        || i.title.toLowerCase().includes(q)
        || i.assignee?.toLowerCase().includes(q)
        || i.module?.toLowerCase().includes(q)
      const matchStatus = filterStatus === 'all' || i.status === filterStatus
      const matchPriority = filterPriority === 'all' || i.priority === filterPriority
      const matchModule = filterModule === 'all' || i.module === filterModule
      const matchAssignee = filterAssignee === 'all' || i.assignee === filterAssignee
      return matchSearch && matchStatus && matchPriority && matchModule && matchAssignee
    })

    items.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'jira_id': cmp = a.jira_id.localeCompare(b.jira_id); break
        case 'title': cmp = a.title.localeCompare(b.title); break
        case 'status': cmp = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99); break
        case 'priority': cmp = (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99); break
        case 'assignee': cmp = (a.assignee ?? '').localeCompare(b.assignee ?? ''); break
        case 'module': cmp = (a.module ?? '').localeCompare(b.module ?? ''); break
        case 'created_at': cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return items
  }, [issues, search, filterStatus, filterPriority, filterModule, filterAssignee, sortField, sortDir])

  const hasFilters = search || filterStatus !== 'all' || filterPriority !== 'all' || filterModule !== 'all' || filterAssignee !== 'all'
  const clearFilters = () => {
    setSearch('')
    setFilterStatus('all')
    setFilterPriority('all')
    setFilterModule('all')
    setFilterAssignee('all')
  }

  // Summary counts
  const counts = useMemo(() => ({
    open: issues.filter((i) => i.status === 'Open').length,
    inProgress: issues.filter((i) => i.status === 'In Progress').length,
    resolved: issues.filter((i) => i.status === 'Resolved').length,
    critical: issues.filter((i) => i.priority === 'Critical').length,
  }), [issues])

  const SortableHeader: React.FC<{ field: SortField; label: string; className?: string }> = ({ field, label, className }) => (
    <th
      className={cn('px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none transition-colors', className)}
      onClick={() => handleSort(field)}
    >
      <span className="flex items-center gap-1">
        {label}
        <SortIcon dir={getSortDir(field)} />
      </span>
    </th>
  )

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="JIRA Issues"
        subtitle="Browse, search, and analyze all JIRA issues across modules and releases."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
            <Button size="sm" className="gap-1.5 gradient-brand border-0 text-white hover:opacity-90">
              <RefreshCcw className="h-3.5 w-3.5" /> Sync Jira
            </Button>
          </div>
        }
      />

      {/* Summary stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
      >
        {[
          { label: 'Open', value: counts.open, color: 'text-blue-600 dark:text-blue-400' },
          { label: 'In Progress', value: counts.inProgress, color: 'text-amber-600 dark:text-amber-400' },
          { label: 'Resolved', value: counts.resolved, color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Critical', value: counts.critical, color: 'text-red-600 dark:text-red-400' },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 text-center">
              <p className={cn('text-2xl font-bold tabular-nums', s.color)}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.1 }}
        className="flex flex-wrap gap-2"
      >
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ID, title, assignee..."
            className="pl-8 h-9 text-sm"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 h-9 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="Open">Open</SelectItem>
            <SelectItem value="In Progress">In Progress</SelectItem>
            <SelectItem value="Resolved">Resolved</SelectItem>
            <SelectItem value="Closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-32 h-9 text-sm">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="Critical">Critical</SelectItem>
            <SelectItem value="High">High</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="Low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterModule} onValueChange={setFilterModule}>
          <SelectTrigger className="w-32 h-9 text-sm">
            <SelectValue placeholder="Module" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All modules</SelectItem>
            {modules.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterAssignee} onValueChange={setFilterAssignee}>
          <SelectTrigger className="w-36 h-9 text-sm">
            <SelectValue placeholder="Assignee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All assignees</SelectItem>
            {assignees.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-9 gap-1 text-xs" onClick={clearFilters}>
            <X className="h-3 w-3" /> Clear
          </Button>
        )}
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
      >
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{filtered.length}</span> issue{filtered.length !== 1 ? 's' : ''} found
              </p>
            </div>

            {isLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={<AlertCircle />}
                title="No issues found"
                description="Try adjusting your search or filters."
                action={{ label: 'Clear filters', onClick: clearFilters }}
                compact
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <SortableHeader field="jira_id" label="JIRA ID" className="pl-6" />
                      <SortableHeader field="title" label="Title" />
                      <SortableHeader field="status" label="Status" />
                      <SortableHeader field="priority" label="Priority" />
                      <SortableHeader field="assignee" label="Assignee" />
                      <SortableHeader field="module" label="Module" />
                      <SortableHeader field="created_at" label="Created" />
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <AnimatePresence initial={false}>
                      {filtered.map((issue, idx) => (
                        <motion.tr
                          key={issue.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2, delay: idx * 0.02 }}
                          className="hover:bg-muted/30 transition-colors cursor-pointer group"
                          onClick={() => setSelectedIssue(issue)}
                        >
                          <td className="pl-6 pr-4 py-3 font-mono text-xs font-semibold text-primary whitespace-nowrap">
                            {issue.jira_id}
                          </td>
                          <td className="px-4 py-3 text-xs text-foreground max-w-[220px]">
                            <span className="line-clamp-2 leading-snug">{issue.title}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <StatusBadge status={statusMap[issue.status] ?? 'unknown'} size="sm" label={issue.status} />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <PriorityBadge priority={issue.priority} />
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                            {issue.assignee ?? '—'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {issue.module && (
                              <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">{issue.module}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(issue.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                          </td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setSelectedIssue(issue)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <IssueDetailDialog issue={selectedIssue} onClose={() => setSelectedIssue(null)} />
    </div>
  )
}

export default JiraIssuesPage
