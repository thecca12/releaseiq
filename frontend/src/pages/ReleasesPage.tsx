import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  GitBranch,
  Calendar,
  Filter,
  Search,
  Eye,
  GitCompare,
  ChevronDown,
  ChevronRight,
  Download,
  RefreshCcw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Package,
  Clock,
  Users,
  FileText,
  X,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
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
import { cn } from '@/utils/cn'
import { releasesApi } from '@/services/api'
import type { Release } from '@/types'

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_RELEASES: Release[] = [
  { id: '1', version: 'v9.48', release_date: '2025-05-22', type: 'live', status: 'healthy', module: 'RMS,FIX,OMS', description: 'Full production release with FIX engine revert and OMS optimizations.', jira_ids: ['JIRA-1039', 'JIRA-1040', 'JIRA-1041'], clients: ['Kotak', 'HDFC', 'Axis'], health_score: 96 },
  { id: '2', version: 'v9.47.1', release_date: '2025-05-20', type: 'qa', status: 'healthy', module: 'RMS,FIX', description: 'Patch release: fixes NPE in RMS order modify and FIX heartbeat crash.', jira_ids: ['JIRA-1042', 'JIRA-1038'], clients: [], health_score: 92 },
  { id: '3', version: 'v9.47', release_date: '2025-05-10', type: 'live', status: 'warning', module: 'RMS,FIX,OMS,SERVER', description: 'Major feature release: pre-open session handling, FIX 5.0 SP2, OMS batching.', jira_ids: ['JIRA-1030', 'JIRA-1031', 'JIRA-1032'], clients: ['Zerodha', 'ICICI'], health_score: 72 },
  { id: '4', version: 'v9.46', release_date: '2025-04-28', type: 'live', status: 'healthy', module: 'RMS,OMS,CLIENT', description: 'NSE circular compliance: new order types AMO=7, GTD=8.', jira_ids: ['JIRA-1021', 'JIRA-1022'], clients: ['Kotak', 'HDFC', 'Axis', 'Zerodha'], health_score: 98 },
  { id: '5', version: 'v9.45.2', release_date: '2025-04-18', type: 'qa', status: 'healthy', module: 'SERVER', description: 'Emergency patch for server disconnect handling on NSE failover.', jira_ids: ['JIRA-1020'], clients: [], health_score: 95 },
  { id: '6', version: 'v9.45', release_date: '2025-04-14', type: 'live', status: 'healthy', module: 'ALL', description: 'Q2 2025 quarterly release with performance improvements across all modules.', jira_ids: ['JIRA-1010', 'JIRA-1011', 'JIRA-1012', 'JIRA-1013'], clients: ['All'], health_score: 94 },
  { id: '7', version: 'v9.44', release_date: '2025-03-31', type: 'live', status: 'critical', module: 'FIX,CLIENT', description: 'FIX engine upgrade (was rolled back in v9.47.1). Known issues persist.', jira_ids: ['JIRA-1000', 'JIRA-1001', 'JIRA-1002', 'JIRA-1003'], clients: [], health_score: 41 },
  { id: '8', version: 'v9.43', release_date: '2025-03-15', type: 'live', status: 'healthy', module: 'RMS,OMS', description: 'Basket order improvements and risk check enhancements.', jira_ids: ['JIRA-990', 'JIRA-991'], clients: ['HDFC', 'Axis'], health_score: 91 },
]

const DETAIL_NOTES: Record<string, { release_notes: string; patch_notes: string; affected_jiras: { id: string; title: string; status: string }[] }> = {
  'v9.48': {
    release_notes: '## v9.48 Release Notes\n\n### FIX Engine\n- Reverted QuickFIX/J from 2.3.1 to 2.2.0 to fix session drop issue (JIRA-1039)\n- Added adaptive thread-pool sizing (max threads configurable via FIX_MAX_THREADS)\n- Improved heartbeat resilience under load\n\n### OMS\n- Memory leak fix for cancel-replace storm scenario\n- Heap optimizations for high-throughput desks\n\n### RMS\n- Minor stability improvements\n- Updated SKIP_RISK_ON_MODIFY flag documentation',
    patch_notes: 'No patch notes for base release v9.48.',
    affected_jiras: [
      { id: 'JIRA-1039', title: 'FIX session drops under load', status: 'Resolved' },
      { id: 'JIRA-1040', title: 'OMS memory leak on cancel-replace', status: 'Resolved' },
      { id: 'JIRA-1041', title: 'RMS stability improvements', status: 'Closed' },
    ],
  },
  'v9.47': {
    release_notes: '## v9.47 Release Notes\n\n### Pre-open Session\n- New pre-open order modification handling\n- Risk bypass flag SKIP_RISK_ON_MODIFY added (CAUTION: known NPE — see JIRA-1042)\n\n### FIX Engine (ROLLED BACK IN v9.47.1)\n- Upgraded to QuickFIX/J 2.3.1\n- Work-stealing thread pool (caused JIRA-1039 — reverted in v9.47.1)\n\n### OMS\n- Cancel-replace order batching (memory leak — see JIRA-1038)',
    patch_notes: '## v9.47.1 Patch Notes\n\n- Fixed NPE in RiskManager.validateModification (JIRA-1042)\n- Reverted FIX engine to 2.2.0 (JIRA-1039 partially fixed)\n- OMS memory leak deferred to v9.48',
    affected_jiras: [
      { id: 'JIRA-1042', title: 'Order rejection in RMS v9.47', status: 'Open' },
      { id: 'JIRA-1038', title: 'OMS memory leak on cancel-replace', status: 'In Progress' },
      { id: 'JIRA-1039', title: 'FIX session drops under load', status: 'In Progress' },
    ],
  },
}

// ─── Health dot ───────────────────────────────────────────────────────────────

const HealthDot: React.FC<{ status: Release['status'] }> = ({ status }) => {
  const map = { healthy: 'bg-emerald-500', warning: 'bg-amber-500', critical: 'bg-red-500' }
  return <span className={cn('inline-block h-2.5 w-2.5 rounded-full flex-shrink-0', map[status])} />
}

const HealthIcon: React.FC<{ status: Release['status'] }> = ({ status }) => {
  if (status === 'healthy') return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
  if (status === 'warning') return <AlertTriangle className="h-4 w-4 text-amber-500" />
  return <XCircle className="h-4 w-4 text-red-500" />
}

// ─── Release card ─────────────────────────────────────────────────────────────

interface ReleaseCardProps {
  release: Release
  index: number
  onViewDetails: (r: Release) => void
}

const ReleaseCard: React.FC<ReleaseCardProps> = ({ release, index, onViewDetails }) => {
  const typeColor = release.type === 'live'
    ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
    : 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400'

  const scoreColor = release.health_score >= 90
    ? 'text-emerald-600 dark:text-emerald-400'
    : release.health_score >= 70
    ? 'text-amber-600 dark:text-amber-400'
    : 'text-red-600 dark:text-red-400'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
    >
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            {/* Left */}
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <HealthDot status={release.status} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-bold text-foreground font-mono">{release.version}</span>
                  <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', typeColor)}>
                    {release.type === 'live' ? 'Live' : 'QA'}
                  </span>
                  <StatusBadge status={release.status} size="sm" />
                </div>
                <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" />
                  {new Date(release.release_date).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                </p>
                {release.description && (
                  <p className="mt-1.5 text-xs text-foreground/70 line-clamp-2 max-w-md">{release.description}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {release.module && (
                    <span className="flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      {release.module}
                    </span>
                  )}
                  {release.jira_ids && release.jira_ids.length > 0 && (
                    <span className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      {release.jira_ids.length} JIRAs
                    </span>
                  )}
                  {release.clients && release.clients.length > 0 && (
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {release.clients.slice(0, 3).join(', ')}
                      {release.clients.length > 3 && ` +${release.clients.length - 3}`}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Right */}
            <div className="flex items-center gap-2 sm:flex-col sm:items-end flex-shrink-0">
              <div className="text-right">
                <p className={cn('text-xl font-bold tabular-nums', scoreColor)}>{release.health_score}%</p>
                <p className="text-[10px] text-muted-foreground">health score</p>
              </div>
              <div className="flex gap-1.5 sm:mt-2">
                <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => onViewDetails(release)}>
                  <Eye className="h-3 w-3" /> Details
                </Button>
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                  <GitCompare className="h-3 w-3" /> Compare
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ─── Details dialog ───────────────────────────────────────────────────────────

const ReleaseDetailsDialog: React.FC<{ release: Release | null; onClose: () => void }> = ({ release, onClose }) => {
  if (!release) return null
  const notes = DETAIL_NOTES[release.version] ?? {
    release_notes: `## ${release.version} Release Notes\n\n${release.description ?? 'No details available.'}`,
    patch_notes: 'No patch notes available.',
    affected_jiras: release.jira_ids?.map((id) => ({ id, title: `${id} issue`, status: 'Unknown' })) ?? [],
  }
  const statusMap: Record<string, string> = { Open: 'open', 'In Progress': 'in_progress', Resolved: 'resolved', Closed: 'completed', Unknown: 'unknown' }

  return (
    <Dialog open={!!release} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HealthIcon status={release.status} />
            {release.version}
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', release.type === 'live' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700')}>
              {release.type === 'live' ? 'Live' : 'QA'}
            </span>
          </DialogTitle>
          <DialogDescription>
            Released on {new Date(release.release_date).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })} · Health score: {release.health_score}%
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Release notes */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2">Release Notes</h4>
            <div className="rounded-lg bg-muted/40 border border-border p-4 text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed font-mono">
              {notes.release_notes}
            </div>
          </div>

          {/* Patch notes */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2">Patch Notes</h4>
            <div className="rounded-lg bg-muted/40 border border-border p-4 text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed font-mono">
              {notes.patch_notes}
            </div>
          </div>

          {/* Affected JIRAs */}
          {notes.affected_jiras.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2">Affected JIRAs</h4>
              <div className="space-y-2">
                {notes.affected_jiras.map((j) => (
                  <div key={j.id} className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
                    <span className="text-xs font-mono font-semibold text-primary">{j.id}</span>
                    <span className="text-xs text-muted-foreground flex-1 px-3 truncate">{j.title}</span>
                    <StatusBadge status={statusMap[j.status] ?? 'unknown'} size="sm" label={j.status} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Clients */}
          {release.clients && release.clients.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2">Deployed To Clients</h4>
              <div className="flex flex-wrap gap-2">
                {release.clients.map((c) => (
                  <span key={c} className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground">{c}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const ReleasesPage: React.FC = () => {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [filterModule, setFilterModule] = useState('all')
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null)
  const [activeTab, setActiveTab] = useState('all')

  const { data, isLoading } = useQuery({
    queryKey: ['releases'],
    queryFn: async () => {
      try {
        const res = await releasesApi.list()
        // Backend returns real releases: v9.40–v9.48 with status, health, modules, environment
        const raw = res.data?.items ?? res.data
        if (Array.isArray(raw) && raw.length > 0) {
          return raw.map((item: Record<string, unknown>, idx: number) => {
            // Map health_status / status string to internal status
            const rawStatus = String(item.health ?? item.health_status ?? item.status ?? 'healthy').toLowerCase()
            const status: Release['status'] = rawStatus === 'critical' ? 'critical' : rawStatus === 'warning' ? 'warning' : 'healthy'
            // Map environment to type
            const env = String(item.environment ?? '').toLowerCase()
            const type: Release['type'] = env === 'qa' || env === 'testing' ? 'qa' : 'live'
            // Map modules array or string
            const modulesRaw = item.modules
            const moduleStr = Array.isArray(modulesRaw) ? (modulesRaw as string[]).join(',') : String(modulesRaw ?? item.module ?? 'RMS')
            // Health score heuristic
            const healthScore = typeof item.health_score === 'number'
              ? item.health_score
              : status === 'healthy' ? 95 : status === 'warning' ? 72 : 41
            return {
              id: String(item.id ?? idx + 1),
              version: String(item.version ?? `v9.4${idx}`),
              release_date: String(item.release_date ?? item.deployment_date ?? new Date().toISOString().split('T')[0]),
              type,
              status,
              module: moduleStr,
              description: item.description as string | undefined,
              jira_ids: item.jira_refs as string[] | undefined ?? item.jira_ids as string[] | undefined,
              clients: item.clients as string[] | undefined,
              health_score: healthScore,
            } as Release
          })
        }
        return MOCK_RELEASES
      } catch {
        return MOCK_RELEASES
      }
    },
  })

  const releases = data ?? MOCK_RELEASES

  const filtered = useMemo(() => {
    return releases.filter((r) => {
      const matchSearch = !search || r.version.toLowerCase().includes(search.toLowerCase()) || r.module?.toLowerCase().includes(search.toLowerCase())
      const matchStatus = filterStatus === 'all' || r.status === filterStatus
      const matchType = filterType === 'all' || r.type === filterType
      const matchModule = filterModule === 'all' || r.module?.includes(filterModule)
      const matchTab = activeTab === 'all'
        || (activeTab === 'qa' && r.type === 'qa')
        || (activeTab === 'live' && r.type === 'live')
        || (activeTab === 'client' && (r.clients ?? []).length > 0)
      return matchSearch && matchStatus && matchType && matchModule && matchTab
    })
  }, [releases, search, filterStatus, filterType, filterModule, activeTab])

  const clearFilters = () => {
    setSearch('')
    setFilterStatus('all')
    setFilterType('all')
    setFilterModule('all')
  }

  const hasFilters = search || filterStatus !== 'all' || filterType !== 'all' || filterModule !== 'all'

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Releases"
        subtitle="Manage and track all release versions, patch notes, and client deployments."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
            <Button size="sm" className="gap-1.5 gradient-brand border-0 text-white hover:opacity-90">
              <RefreshCcw className="h-3.5 w-3.5" /> Sync
            </Button>
          </div>
        }
      />

      {/* Summary stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="grid grid-cols-3 gap-3"
      >
        {[
          { label: 'Total Releases', value: releases.length, color: 'text-foreground' },
          { label: 'Healthy', value: releases.filter((r) => r.status === 'healthy').length, color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Needs Attention', value: releases.filter((r) => r.status !== 'healthy').length, color: 'text-red-600 dark:text-red-400' },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 text-center">
              <p className={cn('text-2xl font-bold tabular-nums', s.color)}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="all">All Releases</TabsTrigger>
          <TabsTrigger value="qa">QA Patch Notes</TabsTrigger>
          <TabsTrigger value="live">Live Patch Notes</TabsTrigger>
          <TabsTrigger value="client">Client Releases</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {/* Filter bar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
            className="flex flex-wrap gap-2 mb-4"
          >
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search versions, modules..."
                className="pl-8 h-9 text-sm"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36 h-9 text-sm">
                <SelectValue placeholder="Health status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="healthy">Healthy</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-32 h-9 text-sm">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="live">Live</SelectItem>
                <SelectItem value="qa">QA</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterModule} onValueChange={setFilterModule}>
              <SelectTrigger className="w-32 h-9 text-sm">
                <SelectValue placeholder="Module" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All modules</SelectItem>
                <SelectItem value="RMS">RMS</SelectItem>
                <SelectItem value="FIX">FIX</SelectItem>
                <SelectItem value="OMS">OMS</SelectItem>
                <SelectItem value="SERVER">SERVER</SelectItem>
                <SelectItem value="CLIENT">CLIENT</SelectItem>
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="ghost" size="sm" className="h-9 gap-1 text-xs" onClick={clearFilters}>
                <X className="h-3 w-3" /> Clear
              </Button>
            )}
          </motion.div>

          {/* Results count */}
          <p className="text-xs text-muted-foreground mb-3">
            Showing <span className="font-medium text-foreground">{filtered.length}</span> release{filtered.length !== 1 ? 's' : ''}
          </p>

          {/* Release list */}
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}><CardContent className="p-5"><Skeleton className="h-20 w-full" /></CardContent></Card>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<GitBranch />}
              title="No releases found"
              description="Try adjusting your filters or search query."
              action={{ label: 'Clear filters', onClick: clearFilters }}
              compact
            />
          ) : (
            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {filtered.map((release, i) => (
                  <ReleaseCard
                    key={release.id}
                    release={release}
                    index={i}
                    onViewDetails={setSelectedRelease}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Details dialog */}
      <ReleaseDetailsDialog release={selectedRelease} onClose={() => setSelectedRelease(null)} />
    </div>
  )
}

export default ReleasesPage
