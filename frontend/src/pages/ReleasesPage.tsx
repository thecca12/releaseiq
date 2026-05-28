import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  Calendar,
  Eye,
  GitCompare,
  Download,
  RefreshCcw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Package,
  FileText,
  Rocket,
  FlaskConical,
  Bug,
  Shield,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/utils/cn'
import { releasesApi, analyticsApi } from '@/services/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface EnvEntry { env: string; date: string; jira_count: number; patch_files: number }

interface ReleaseRow {
  version: string
  modules: string
  liveEnv: EnvEntry | null
  qaEnv:   EnvEntry | null
  notes:   string
}

interface JiraStats {
  version: string
  live_issues: number
  qa_bugs: number
  health_live: string
  health_qa: string
}

// ─── Health helpers ───────────────────────────────────────────────────────────

function healthIcon(h: string) {
  if (h === 'Critical') return <XCircle className="h-3.5 w-3.5 text-red-500" />
  if (h === 'Warning')  return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
  return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
}

function healthBadge(h: string) {
  const map: Record<string, string> = {
    Healthy:  'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40',
    Warning:  'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40',
    Critical: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40',
  }
  return cn('flex items-center gap-1 text-[10px] font-medium rounded-full px-2 py-0.5', map[h] ?? map.Healthy)
}

// ─── Release Details Dialog ───────────────────────────────────────────────────

interface DetailProps {
  row: ReleaseRow | null
  liveStats: JiraStats | null
  onClose: () => void
}

const ReleaseDetailsDialog: React.FC<DetailProps> = ({ row, liveStats, onClose }) => {
  if (!row) return null
  return (
    <Dialog open={!!row} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono">
            {row.version}
          </DialogTitle>
          <DialogDescription>Modules: {row.modules}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          <div className="grid grid-cols-2 gap-4">
            {/* Live */}
            <div className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20 p-4">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1.5 mb-3">
                <Rocket className="h-3.5 w-3.5" /> Production (Live)
              </p>
              <div className="space-y-2 text-xs text-foreground/80">
                <p><span className="text-muted-foreground">Deploy Date:</span> {row.liveEnv?.date || '—'}</p>
                <p><span className="text-muted-foreground">Patch Files:</span> {row.liveEnv?.patch_files ?? 0}</p>
                <p><span className="text-muted-foreground">Live Issues:</span> {liveStats?.live_issues ?? 0}</p>
                <p><span className="text-muted-foreground">Health:</span> {liveStats?.health_live ?? 'Healthy'}</p>
              </div>
            </div>

            {/* QA */}
            <div className="rounded-xl border border-purple-200 dark:border-purple-900 bg-purple-50/40 dark:bg-purple-950/20 p-4">
              <p className="text-xs font-semibold text-purple-700 dark:text-purple-400 flex items-center gap-1.5 mb-3">
                <FlaskConical className="h-3.5 w-3.5" /> Under Development (QA)
              </p>
              <div className="space-y-2 text-xs text-foreground/80">
                <p><span className="text-muted-foreground">QA Date:</span> {row.qaEnv?.date || '—'}</p>
                <p><span className="text-muted-foreground">Patch Files:</span> {row.qaEnv?.patch_files ?? 0}</p>
                <p><span className="text-muted-foreground">QA Bugs:</span> {liveStats?.qa_bugs ?? 0}</p>
                <p><span className="text-muted-foreground">Health:</span> {liveStats?.health_qa ?? 'Healthy'}</p>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-semibold mb-2">Notes</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">{row.notes || 'No notes available.'}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Release row component ────────────────────────────────────────────────────

interface RowProps {
  row: ReleaseRow
  mode: 'live' | 'qa'
  jira: JiraStats | null
  index: number
  onView: () => void
}

const ReleaseRowCard: React.FC<RowProps> = ({ row, mode, jira, index, onView }) => {
  const isLive = mode === 'live'
  const date = isLive ? row.liveEnv?.date : row.qaEnv?.date
  const patchFiles = isLive ? (row.liveEnv?.patch_files ?? 0) : (row.qaEnv?.patch_files ?? 0)
  const issueCount = isLive ? (jira?.live_issues ?? 0) : (jira?.qa_bugs ?? 0)
  const health = isLive ? (jira?.health_live ?? 'Healthy') : (jira?.health_qa ?? 'Healthy')

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      className="flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors border-b border-border last:border-0"
    >
      {/* Left: version + meta */}
      <div className="flex items-center gap-4 min-w-0">
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0', isLive ? 'bg-blue-100 dark:bg-blue-950/40' : 'bg-purple-100 dark:bg-purple-950/40')}>
          {isLive
            ? <Rocket className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            : <FlaskConical className="h-4 w-4 text-purple-600 dark:text-purple-400" />}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground font-mono">{row.version}</span>
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', isLive ? 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400' : 'bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400')}>
              {isLive ? 'Live' : 'QA'}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{date || '—'}</span>
            <span className="flex items-center gap-1"><Package className="h-3 w-3" />{row.modules}</span>
            <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{patchFiles} patch files</span>
          </div>
        </div>
      </div>

      {/* Right: JIRA issues + health + actions */}
      <div className="flex items-center gap-4 flex-shrink-0">
        <div className="text-center min-w-[60px]">
          <div className={cn('text-lg font-bold tabular-nums', issueCount === 0 ? 'text-emerald-600' : health === 'Critical' ? 'text-red-600' : 'text-amber-600')}>
            {issueCount}
          </div>
          <div className="text-[10px] text-muted-foreground">{isLive ? 'live issues' : 'QA bugs'}</div>
        </div>

        <span className={healthBadge(health)}>
          {healthIcon(health)} {health}
        </span>

        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={onView}>
            <Eye className="h-3 w-3" /> Details
          </Button>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
            <GitCompare className="h-3 w-3" /> Compare
          </Button>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

interface SectionHeaderProps {
  title: string
  subtitle: string
  icon: React.ReactNode
  badge: string
  badgeClass: string
  totalIssues: number
  issueLabel: string
  healthSummary: string
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ title, subtitle, icon, badge, badgeClass, totalIssues, issueLabel, healthSummary }) => (
  <CardHeader className="pb-0">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-xl', badgeClass.includes('blue') ? 'bg-blue-500' : 'bg-purple-500')}>
          <span className="text-white [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
        </div>
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription className="text-[11px]">{subtitle}</CardDescription>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className={cn('text-xl font-bold tabular-nums', totalIssues > 0 ? (totalIssues > 30 ? 'text-red-500' : 'text-amber-500') : 'text-emerald-500')}>{totalIssues}</p>
          <p className="text-[10px] text-muted-foreground">{issueLabel}</p>
        </div>
        <span className={cn('rounded-full text-[10px] font-semibold px-2.5 py-1', badgeClass)}>{badge}</span>
      </div>
    </div>
  </CardHeader>
)

// ─── Page ─────────────────────────────────────────────────────────────────────

const ReleasesPage: React.FC = () => {
  const [selectedRow, setSelectedRow] = useState<ReleaseRow | null>(null)

  // Fetch base release data (version, dates, environments, patch files)
  const { data: releasesData, isLoading: releasesLoading, refetch } = useQuery({
    queryKey: ['releases-page'],
    queryFn: async () => {
      try {
        const res = await releasesApi.list({ page_size: 20 })
        const raw: Record<string, unknown>[] = res.data?.items ?? []
        return raw.map((item) => {
          const envs: EnvEntry[] = (item.environments as EnvEntry[]) ?? []
          return {
            version:  String(item.version ?? ''),
            modules:  Array.isArray(item.modules) ? (item.modules as string[]).join(', ') : String(item.modules ?? 'RMS, FIX, OMS, CLIENT, SERVER'),
            liveEnv:  envs.find((e) => e.env === 'LIVE') ?? null,
            qaEnv:    envs.find((e) => e.env === 'QA')   ?? null,
            notes:    String(item.notes ?? item.description ?? ''),
          } as ReleaseRow
        })
      } catch {
        return FALLBACK_ROWS
      }
    },
  })

  // Fetch JIRA stats (live issues + QA bugs per version)
  const { data: jiraStatsData } = useQuery({
    queryKey: ['release-jira-stats'],
    queryFn: async () => {
      try {
        const res = await analyticsApi.getReleaseJiraStats()
        return res.data?.by_version as Record<string, JiraStats> ?? {}
      } catch {
        return {} as Record<string, JiraStats>
      }
    },
  })

  const rows: ReleaseRow[] = releasesData ?? FALLBACK_ROWS
  const jiraStats: Record<string, JiraStats> = jiraStatsData ?? {}

  const getJira = (version: string): JiraStats | null => jiraStats[version] ?? null

  const totalLiveIssues = rows.reduce((s, r) => s + (getJira(r.version)?.live_issues ?? 0), 0)
  const totalQaBugs     = rows.reduce((s, r) => s + (getJira(r.version)?.qa_bugs ?? 0), 0)

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Releases"
        subtitle="Track production deployments and releases under QA development — with real-time JIRA issue counts."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
            <Button size="sm" className="gap-1.5 gradient-brand border-0 text-white hover:opacity-90" onClick={() => refetch()}>
              <RefreshCcw className="h-3.5 w-3.5" /> Sync
            </Button>
          </div>
        }
      />

      {/* Summary stats */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Releases',       value: rows.length,     color: 'text-foreground' },
          { label: 'Production (Live)',     value: rows.length,     color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Under Development (QA)', value: rows.length,   color: 'text-purple-600 dark:text-purple-400' },
          { label: 'Total JIRA Issues',    value: totalLiveIssues + totalQaBugs, color: totalLiveIssues + totalQaBugs > 50 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400' },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 text-center">
              <p className={cn('text-2xl font-bold tabular-nums', s.color)}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* ── Production (Live) Releases ─────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card>
          <SectionHeader
            title="Production Releases"
            subtitle="Deployed to Live environment — tracked by Support team issues"
            icon={<Rocket />}
            badge="LIVE"
            badgeClass="bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400"
            totalIssues={totalLiveIssues}
            issueLabel="live issues"
            healthSummary=""
          />
          <CardContent className="p-0 mt-4">
            <div className="border-t border-border">
              {releasesLoading
                ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 mx-5 my-3 rounded-lg" />)
                : rows.map((row, i) => (
                    <ReleaseRowCard
                      key={row.version}
                      row={row}
                      mode="live"
                      jira={getJira(row.version)}
                      index={i}
                      onView={() => setSelectedRow(row)}
                    />
                  ))
              }
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Under Development (QA) Releases ───────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
        <Card>
          <SectionHeader
            title="Under Development (QA)"
            subtitle="Releases in QA/testing phase — tracked by QA team bug reports"
            icon={<FlaskConical />}
            badge="QA"
            badgeClass="bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400"
            totalIssues={totalQaBugs}
            issueLabel="QA bugs"
            healthSummary=""
          />
          <CardContent className="p-0 mt-4">
            <div className="border-t border-border">
              {releasesLoading
                ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 mx-5 my-3 rounded-lg" />)
                : rows.map((row, i) => (
                    <ReleaseRowCard
                      key={row.version}
                      row={row}
                      mode="qa"
                      jira={getJira(row.version)}
                      index={i}
                      onView={() => setSelectedRow(row)}
                    />
                  ))
              }
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Legend */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
        <Card className="bg-muted/20">
          <CardContent className="p-4 flex flex-wrap gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="font-medium text-foreground">Issue Type Legend:</span>
              <span className="flex items-center gap-1.5">
                <Bug className="h-3 w-3 text-blue-500" />
                <strong className="text-foreground">Live Issue</strong> = Production bugs (Support team)
              </span>
              <span className="flex items-center gap-1.5">
                <Bug className="h-3 w-3 text-purple-500" />
                <strong className="text-foreground">Bug</strong> = QA-reported issues (QA team)
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-medium text-foreground">Health:</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Healthy</span>
              <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-amber-500" /> Warning (Live &gt;10 / QA &gt;50)</span>
              <span className="flex items-center gap-1"><XCircle className="h-3 w-3 text-red-500" /> Critical (Live &gt;20 / QA &gt;200)</span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <ReleaseDetailsDialog
        row={selectedRow}
        liveStats={selectedRow ? getJira(selectedRow.version) : null}
        onClose={() => setSelectedRow(null)}
      />
    </div>
  )
}

// ─── Fallback data ────────────────────────────────────────────────────────────

const FALLBACK_ROWS: ReleaseRow[] = [
  {
    version: 'Optimus',
    modules: 'RMS, FIX, OMS, CLIENT, SERVER',
    liveEnv: { env: 'LIVE', date: '12 May 2026', jira_count: 19, patch_files: 2 },
    qaEnv:   { env: 'QA',   date: '26 May 2026', jira_count: 7,  patch_files: 6 },
    notes: 'Optimus patch for LIVE. 19 issues addressed.',
  },
  {
    version: '3009',
    modules: 'RMS, FIX, OMS, CLIENT, SERVER',
    liveEnv: { env: 'LIVE', date: '—', jira_count: 0, patch_files: 4 },
    qaEnv:   { env: 'QA',   date: '—', jira_count: 0, patch_files: 6 },
    notes: '3009 patch for LIVE. 0 issues addressed.',
  },
  {
    version: '1209',
    modules: 'RMS, FIX, OMS, CLIENT, SERVER',
    liveEnv: { env: 'LIVE', date: '—', jira_count: 0, patch_files: 4 },
    qaEnv:   { env: 'QA',   date: '22 May 2026', jira_count: 0, patch_files: 6 },
    notes: '1209 patch for LIVE. 0 issues addressed.',
  },
]

export default ReleasesPage
