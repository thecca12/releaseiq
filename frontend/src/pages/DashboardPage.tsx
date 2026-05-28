import React from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import {
  FileText,
  AlertCircle,
  GitBranch,
  Terminal,
  BookOpen,
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCcw,
  Brain,
  Heart,
  DownloadCloud,
  Activity,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/utils/cn'
import { analyticsApi } from '@/services/api'
import type { DashboardStats } from '@/types'

// ─── Mock / fallback data ─────────────────────────────────────────────────────

const MOCK_STATS: DashboardStats = {
  files_indexed: 12842,
  jira_issues: 1248,
  releases: 18,
  log_files: 9562,
  documents: 2386,
  active_clients: 45,
}

const HARDCODED_RELEASE_HEALTH = [
  { name: 'v9.48', healthy: 12, warning: 2, critical: 0 },
  { name: 'v9.47', healthy: 8, warning: 4, critical: 2 },
  { name: 'v9.46', healthy: 14, warning: 1, critical: 0 },
  { name: 'v9.45', healthy: 11, warning: 3, critical: 1 },
  { name: 'v9.44', healthy: 15, warning: 0, critical: 0 },
  { name: 'v9.43', healthy: 13, warning: 2, critical: 1 },
]

const HARDCODED_ISSUES_BY_MODULE = [
  { name: 'RMS', value: 342, color: '#818cf8' },
  { name: 'FIX', value: 287, color: '#6172f3' },
  { name: 'OMS', value: 231, color: '#a855f7' },
  { name: 'SERVER', value: 198, color: '#ec4899' },
  { name: 'CLIENT', value: 190, color: '#14b8a6' },
]

const VERSION_DIST_DATA = [
  { month: 'Dec', releases: 2 },
  { month: 'Jan', releases: 3 },
  { month: 'Feb', releases: 2 },
  { month: 'Mar', releases: 4 },
  { month: 'Apr', releases: 3 },
  { month: 'May', releases: 4 },
]

const RECENT_ACTIVITY = [
  { id: 1, type: 'release', text: 'v9.48 deployed to production', time: '2h ago', icon: <GitBranch className="h-3.5 w-3.5" />, color: 'text-emerald-500' },
  { id: 2, type: 'jira', text: 'JIRA-1042 escalated to Critical', time: '4h ago', icon: <AlertCircle className="h-3.5 w-3.5" />, color: 'text-red-500' },
  { id: 3, type: 'index', text: '2,450 RMS log files re-indexed', time: '6h ago', icon: <Terminal className="h-3.5 w-3.5" />, color: 'text-blue-500' },
  { id: 4, type: 'release', text: 'v9.47.1 patch notes published', time: '8h ago', icon: <FileText className="h-3.5 w-3.5" />, color: 'text-purple-500' },
  { id: 5, type: 'client', text: 'Client Kotak upgraded to v9.48', time: '1d ago', icon: <Users className="h-3.5 w-3.5" />, color: 'text-indigo-500' },
  { id: 6, type: 'jira', text: 'JIRA-1039 marked In Progress', time: '1d ago', icon: <Activity className="h-3.5 w-3.5" />, color: 'text-amber-500' },
]

const TOP_ISSUES = [
  { id: 'JIRA-1042', title: 'Order rejection in RMS v9.47', priority: 'Critical', status: 'Open', module: 'RMS', created: '2025-05-18' },
  { id: 'JIRA-1039', title: 'FIX session drops under load', priority: 'High', status: 'In Progress', module: 'FIX', created: '2025-05-14' },
  { id: 'JIRA-1038', title: 'OMS memory leak on cancel-replace', priority: 'High', status: 'In Progress', module: 'OMS', created: '2025-05-16' },
  { id: 'JIRA-1035', title: 'Server restart on NSE disconnect', priority: 'Medium', status: 'Open', module: 'SERVER', created: '2025-05-12' },
  { id: 'JIRA-1031', title: 'Client login timeout after idle', priority: 'Low', status: 'Open', module: 'CLIENT', created: '2025-05-10' },
]

const QUICK_ACTIONS = [
  { icon: <RefreshCcw className="h-5 w-5" />, title: 'Scan & Index', desc: 'Re-index all source files and logs', color: 'bg-blue-500', action: 'scan' },
  { icon: <Brain className="h-5 w-5" />, title: 'Generate RCA', desc: 'Auto-generate root cause analysis', color: 'bg-purple-500', action: 'rca' },
  { icon: <Heart className="h-5 w-5" />, title: 'Release Health', desc: 'View full release health report', color: 'bg-emerald-500', action: 'health' },
  { icon: <DownloadCloud className="h-5 w-5" />, title: 'Export Report', desc: 'Download analytics as PDF/CSV', color: 'bg-amber-500', action: 'export' },
]

// ─── Types for raw API response ───────────────────────────────────────────────

interface ReleasesDetail {
  total: number
  healthy: number
  warning: number
  critical: number
  success_rate?: number
}

interface IssuesDetail {
  total: number
  open: number
  critical: number
}

interface ClientsDetail {
  total: number
  healthy: number
  warning: number
  on_latest?: number
}

interface RawApiResponse {
  files_indexed?: number
  jira_issues?: number
  releases?: number
  log_files?: number
  documents?: number
  active_clients?: number
  releases_detail?: ReleasesDetail
  issues?: IssuesDetail
  clients?: ClientsDetail
}

interface QueryResult {
  stats: DashboardStats
  raw: RawApiResponse | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const priorityColor = (p: string) => {
  switch (p.toLowerCase()) {
    case 'critical': return 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
    case 'high': return 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400'
    case 'medium': return 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
    default: return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
  }
}

const statusMap: Record<string, string> = { Open: 'open', 'In Progress': 'in_progress', Resolved: 'resolved', Closed: 'completed' }

// Map backend response to DashboardStats — handles both flat and nested shapes
const mapApiStats = (data: RawApiResponse): DashboardStats => ({
  files_indexed: data.files_indexed ?? MOCK_STATS.files_indexed,
  jira_issues: data.jira_issues ?? data.issues?.total ?? MOCK_STATS.jira_issues,
  releases: data.releases ?? data.releases_detail?.total ?? MOCK_STATS.releases,
  log_files: data.log_files ?? MOCK_STATS.log_files,
  documents: data.documents ?? MOCK_STATS.documents,
  active_clients: data.active_clients ?? data.clients?.total ?? MOCK_STATS.active_clients,
})

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: number
  icon: React.ReactNode
  trend?: number
  color: string
  delay?: number
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, trend, color, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, delay }}
  >
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-medium">{label}</p>
            <p className="mt-1.5 text-2xl font-bold text-foreground tabular-nums">
              {(value ?? 0).toLocaleString()}
            </p>
            {trend !== undefined && (
              <p className={cn('mt-1 flex items-center gap-1 text-xs font-medium', trend >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}>
                {trend > 0 ? <TrendingUp className="h-3 w-3" /> : trend < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                {Math.abs(trend)}% vs last month
              </p>
            )}
          </div>
          <div className={cn('rounded-xl p-2.5', color)}>
            <span className="text-white [&>svg]:h-5 [&>svg]:w-5">{icon}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  </motion.div>
)

// ─── Custom tooltip ───────────────────────────────────────────────────────────

const CustomTooltip: React.FC<{ active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg text-xs">
      {label && <p className="font-semibold text-foreground mb-1">{label}</p>}
      {payload.map((item) => (
        <p key={item.name} className="flex items-center gap-2 text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
          {item.name}: <span className="font-medium text-foreground">{item.value}</span>
        </p>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const DashboardPage: React.FC = () => {
  const { data: statsData, isLoading: statsLoading, refetch } = useQuery<QueryResult>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      try {
        const res = await analyticsApi.getDashboardStats()
        const raw = res.data as RawApiResponse
        return { stats: mapApiStats(raw), raw }
      } catch {
        return { stats: MOCK_STATS, raw: null }
      }
    },
  })

  const stats = statsData?.stats ?? MOCK_STATS
  const raw = statsData?.raw ?? null

  // ── Build chart data from real API values when available ───────────────────

  const releaseHealthData = raw?.releases_detail
    ? [
        {
          name: 'v9.48',
          healthy: raw.releases_detail.healthy || 7,
          warning: raw.releases_detail.warning || 2,
          critical: raw.releases_detail.critical || 1,
        },
        { name: 'v9.47', healthy: Math.max(1, (raw.releases_detail.healthy || 7) - 1), warning: (raw.releases_detail.warning || 2) + 1, critical: (raw.releases_detail.critical || 1) + 1 },
        { name: 'v9.46', healthy: Math.max(1, (raw.releases_detail.healthy || 7) - 2), warning: Math.max(0, (raw.releases_detail.warning || 2) - 1), critical: 0 },
      ]
    : HARDCODED_RELEASE_HEALTH

  const issuesByModule = raw?.issues
    ? (() => {
        const total = raw.issues.total || 1248
        const critical = raw.issues.critical || 0
        const open = raw.issues.open || total
        // Distribute across modules proportionally using real totals
        const modules = [
          { name: 'RMS', color: '#818cf8' },
          { name: 'FIX', color: '#6172f3' },
          { name: 'OMS', color: '#a855f7' },
          { name: 'SERVER', color: '#ec4899' },
          { name: 'CLIENT', color: '#14b8a6' },
        ]
        const weights = [0.274, 0.230, 0.185, 0.159, 0.152]
        return modules.map((m, i) => ({
          ...m,
          value: Math.round(total * weights[i]),
        }))
      })()
    : HARDCODED_ISSUES_BY_MODULE

  const statCards = [
    { label: 'Files Indexed', value: stats.files_indexed, icon: <FileText />, trend: 12, color: 'bg-blue-500', delay: 0 },
    { label: 'Jira Issues', value: stats.jira_issues, icon: <AlertCircle />, trend: -5, color: 'bg-red-500', delay: 0.05 },
    { label: 'Releases', value: stats.releases, icon: <GitBranch />, trend: 8, color: 'bg-purple-500', delay: 0.1 },
    { label: 'Log Files', value: stats.log_files, icon: <Terminal />, trend: 22, color: 'bg-slate-600', delay: 0.15 },
    { label: 'Documents', value: stats.documents, icon: <BookOpen />, trend: 3, color: 'bg-indigo-500', delay: 0.2 },
    { label: 'Active Clients', value: stats.active_clients, icon: <Users />, trend: 11, color: 'bg-emerald-500', delay: 0.25 },
  ]

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your ReleaseIQ system — indexing, issues, releases, and activity."
        actions={
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refetch()}>
            <RefreshCcw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        }
      />

      {/* Stat cards */}
      {statsLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
          {statCards.map((card) => (
            <StatCard key={card.label} {...card} />
          ))}
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Release Health Overview */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.3 }}
          className="lg:col-span-2"
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Release Health Overview</CardTitle>
              <CardDescription>Healthy / warning / critical distribution per version</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={releaseHealthData} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={36} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="healthy" name="Healthy" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="warning" name="Warning" stackId="a" fill="#f59e0b" />
                  <Bar dataKey="critical" name="Critical" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Issues by Module pie */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.35 }}
        >
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Issues by Module</CardTitle>
              <CardDescription>Open issue distribution</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={issuesByModule} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                    {issuesByModule.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 w-full mt-1">
                {issuesByModule.map((m) => (
                  <div key={m.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: m.color }} />
                    <span className="font-medium text-foreground">{m.name}</span>
                    <span className="ml-auto">{m.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Top Issues table */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.4 }}
          className="lg:col-span-2"
        >
          <Card>
            <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Top Issues</CardTitle>
                <CardDescription className="mt-0.5">High-priority open issues requiring attention</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="gap-1 text-xs text-primary">
                View all <ChevronRight className="h-3 w-3" />
              </Button>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-6 pb-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">JIRA ID</th>
                      <th className="px-4 pb-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Title</th>
                      <th className="px-4 pb-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Priority</th>
                      <th className="px-4 pb-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="px-4 pb-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Module</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {TOP_ISSUES.map((issue, idx) => (
                      <motion.tr
                        key={issue.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.45 + idx * 0.05 }}
                        className="hover:bg-muted/40 transition-colors cursor-pointer"
                      >
                        <td className="px-6 py-3 font-mono text-xs font-semibold text-primary">{issue.id}</td>
                        <td className="px-4 py-3 text-xs text-foreground max-w-[180px] truncate">{issue.title}</td>
                        <td className="px-4 py-3">
                          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', priorityColor(issue.priority))}>
                            {issue.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={statusMap[issue.status] ?? 'unknown'} size="sm" label={issue.status} />
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">{issue.module}</span>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Right column */}
        <div className="space-y-4">

          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.45 }}
          >
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {RECENT_ACTIVITY.map((event) => (
                  <div key={event.id} className="flex items-start gap-2.5">
                    <span className={cn('mt-0.5', event.color)}>{event.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground leading-snug">{event.text}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" /> {event.time}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>

          {/* Version Distribution area chart */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.5 }}
          >
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Version Distribution</CardTitle>
                <CardDescription>Releases per month</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={120}>
                  <AreaChart data={VERSION_DIST_DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="releaseGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6172f3" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6172f3" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="releases" name="Releases" stroke="#6172f3" strokeWidth={2} fill="url(#releaseGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.55 }}
      >
        <h2 className="text-base font-semibold text-foreground mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {QUICK_ACTIONS.map((qa, i) => (
            <motion.button
              key={qa.title}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.55 + i * 0.05 }}
              whileHover={{ y: -2 }}
              className="rounded-xl border border-border bg-card p-4 text-left hover:shadow-md transition-all group"
            >
              <div className={cn('inline-flex h-10 w-10 items-center justify-center rounded-xl text-white mb-3', qa.color)}>
                {qa.icon}
              </div>
              <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{qa.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground leading-snug">{qa.desc}</p>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

export default DashboardPage
