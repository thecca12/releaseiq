import React, { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  HardDriveDownload,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Users,
  Package,
  Bug,
  History,
  FileText,
  ScrollText,
  Shield,
  Clock,
  Trash2,
  Database,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/shared/PageHeader'
import { cn } from '@/utils/cn'
import { backupApi } from '@/services/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BackupRecord {
  id: string
  filename: string
  timestamp: string
  sizeBytes: number
  totalRecords: number
  tables: Record<string, number>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatRelative(iso: string): string {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

const STORAGE_KEY = 'releaseiq_backup_history'

function loadHistory(): BackupRecord[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function saveHistory(records: BackupRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, 20)))
}

// ─── Data table config ────────────────────────────────────────────────────────

const TABLE_CONFIG = [
  { key: 'users',              label: 'Users & Roles',       icon: Users,    color: 'text-violet-500' },
  { key: 'releases',           label: 'Releases',            icon: Package,  color: 'text-blue-500' },
  { key: 'jira_issues',        label: 'Jira Issues',         icon: Bug,      color: 'text-amber-500' },
  { key: 'client_releases',    label: 'Client Releases',     icon: FileText, color: 'text-emerald-500' },
  { key: 'deployment_history', label: 'Deployment History',  icon: History,  color: 'text-pink-500' },
  { key: 'audit_logs',         label: 'Audit Logs',          icon: ScrollText, color: 'text-slate-500' },
]

// ─── Stat card ────────────────────────────────────────────────────────────────

const StatCard: React.FC<{ label: string; value: string | number; sub?: string; icon: React.ElementType; color?: string }> = ({
  label, value, sub, icon: Icon, color = 'text-primary',
}) => (
  <Card>
    <CardContent className="p-4 flex items-center gap-3">
      <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl bg-muted flex-shrink-0', color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold text-foreground tabular-nums leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</p>}
      </div>
    </CardContent>
  </Card>
)

// ─── Page ─────────────────────────────────────────────────────────────────────

const BackupPage: React.FC = () => {
  const [stats, setStats] = useState<Record<string, number> | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<BackupRecord[]>(loadHistory)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [lastSuccess, setLastSuccess] = useState<string | null>(null)

  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    setError(null)
    try {
      const res = await backupApi.stats()
      setStats(res.data.record_counts)
    } catch {
      setError('Could not reach backup service. Ensure the backend is running.')
    } finally {
      setStatsLoading(false)
    }
  }, [])

  useEffect(() => { loadStats() }, [loadStats])

  const handleDownload = async () => {
    setDownloading(true)
    setError(null)
    try {
      const res = await backupApi.download()
      const blob = new Blob([res.data], { type: 'application/json' })
      const sizeBytes = blob.size
      const now = new Date()
      const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const filename = `releaseiq_backup_${ts}.json`

      // Trigger browser download
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      // Save to history
      const record: BackupRecord = {
        id: `bk-${Date.now()}`,
        filename,
        timestamp: now.toISOString(),
        sizeBytes,
        totalRecords: stats ? Object.values(stats).reduce((a, b) => a + b, 0) : 0,
        tables: stats ?? {},
      }
      const updated = [record, ...history]
      setHistory(updated)
      saveHistory(updated)
      setLastSuccess(filename)
    } catch {
      setError('Backup download failed. Please try again or check your permissions.')
    } finally {
      setDownloading(false)
    }
  }

  const deleteRecord = (id: string) => {
    const updated = history.filter((r) => r.id !== id)
    setHistory(updated)
    saveHistory(updated)
  }

  const totalRecords = stats ? Object.values(stats).reduce((a, b) => a + b, 0) : 0

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Project Backup"
        subtitle="Generate and download a full snapshot of all application data as a structured JSON archive."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={loadStats} disabled={statsLoading}>
              <RefreshCw className={cn('h-3.5 w-3.5', statsLoading && 'animate-spin')} />
              Refresh
            </Button>
            <Button size="sm" className="gap-1.5" onClick={handleDownload} disabled={downloading || statsLoading}>
              {downloading
                ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Generating…</>
                : <><Download className="h-3.5 w-3.5" /> Download Backup</>}
            </Button>
          </div>
        }
      />

      {/* ── Summary stats ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Records" value={statsLoading ? '…' : totalRecords.toLocaleString()} icon={Database} color="text-primary" />
        <StatCard label="Data Tables" value={TABLE_CONFIG.length} icon={HardDriveDownload} color="text-blue-500" />
        <StatCard label="Backups Taken" value={history.length} icon={Clock} color="text-emerald-500" />
        <StatCard
          label="Last Backup"
          value={history.length ? formatRelative(history[0].timestamp) : 'Never'}
          sub={history.length ? formatBytes(history[0].sizeBytes) : undefined}
          icon={CheckCircle2}
          color={history.length ? 'text-emerald-500' : 'text-muted-foreground'}
        />
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── Left: data scope ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="lg:col-span-2 space-y-5">

          {/* Data tables card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" /> Backup Scope
              </CardTitle>
              <CardDescription>All tables below are included in every backup.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {TABLE_CONFIG.map(({ key, label, icon: Icon, color }) => (
                  <div key={key} className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg bg-muted', color)}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-sm font-medium text-foreground">{label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-semibold text-foreground tabular-nums">
                        {statsLoading ? <span className="text-muted-foreground">…</span> : (stats?.[key] ?? 0).toLocaleString()}
                      </span>
                      <span className="text-[10px] text-muted-foreground">records</span>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Backup history */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <History className="h-4 w-4 text-primary" /> Backup History
                  </CardTitle>
                  <CardDescription className="mt-0.5">Last 20 backups taken in this browser session.</CardDescription>
                </div>
                {history.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground gap-1"
                    onClick={() => { setHistory([]); saveHistory([]) }}
                  >
                    <Trash2 className="h-3 w-3" /> Clear all
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {history.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                  No backups yet. Click <strong>Download Backup</strong> to create one.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  <AnimatePresence initial={false}>
                    {history.map((record) => (
                      <motion.div key={record.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                        <div className="px-5 py-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/40 flex-shrink-0 mt-0.5">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-mono text-foreground truncate">{record.filename}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[11px] text-muted-foreground">{formatRelative(record.timestamp)}</span>
                                  <span className="text-muted-foreground/40">·</span>
                                  <span className="text-[11px] text-muted-foreground">{formatBytes(record.sizeBytes)}</span>
                                  <span className="text-muted-foreground/40">·</span>
                                  <span className="text-[11px] text-muted-foreground">{record.totalRecords.toLocaleString()} records</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                className="flex items-center justify-center h-6 w-6 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                onClick={() => setExpandedId(expandedId === record.id ? null : record.id)}
                                title="Show table breakdown"
                              >
                                {expandedId === record.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                              </button>
                              <button
                                className="flex items-center justify-center h-6 w-6 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                onClick={() => deleteRecord(record.id)}
                                title="Remove from history"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Expanded table breakdown */}
                          <AnimatePresence>
                            {expandedId === record.id && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-3 ml-10 overflow-hidden"
                              >
                                <div className="rounded-lg border border-border bg-muted/20 divide-y divide-border">
                                  {TABLE_CONFIG.map(({ key, label, icon: Icon, color }) => (
                                    <div key={key} className="flex items-center justify-between px-3 py-2">
                                      <div className="flex items-center gap-2">
                                        <Icon className={cn('h-3 w-3', color)} />
                                        <span className="text-xs text-muted-foreground">{label}</span>
                                      </div>
                                      <span className="text-xs font-mono font-semibold text-foreground tabular-nums">
                                        {(record.tables[key] ?? 0).toLocaleString()}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Right: info panel + action ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="space-y-4">

          {/* Format info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" /> Backup Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {[
                { label: 'Format', value: 'JSON (UTF-8)' },
                { label: 'Compression', value: 'None (plain text)' },
                { label: 'Includes', value: '6 data tables' },
                { label: 'Access', value: 'Admin only' },
                { label: 'Delivery', value: 'Browser download' },
                { label: 'Retention', value: 'Manual (no auto-purge)' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground text-xs">{label}</span>
                  <span className="text-xs font-medium text-foreground text-right">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Filename pattern */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Filename Pattern</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-muted px-3 py-2.5 font-mono text-[11px] text-muted-foreground leading-relaxed break-all">
                releaseiq_backup_<br />YYYYMMDD_HHmmss.json
              </div>
              <p className="text-[11px] text-muted-foreground mt-2 leading-snug">
                Timestamp is derived from your local clock at the moment of generation.
              </p>
            </CardContent>
          </Card>

          {/* Access notice */}
          <Card className="border-purple-200 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-950/20">
            <CardContent className="p-4 flex items-start gap-3">
              <Shield className="h-4 w-4 text-purple-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-purple-700 dark:text-purple-400">Admin access required</p>
                <p className="text-[11px] text-purple-600/80 dark:text-purple-500/80 mt-0.5 leading-snug">
                  Only users with the <strong>Admin</strong> role can generate backups. Passwords are stored as hashed values — never in plain text.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <Card className="border-destructive/30 bg-destructive/5">
                  <CardContent className="p-4 flex items-start gap-3">
                    <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-destructive leading-snug">{error}</p>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Success */}
          <AnimatePresence>
            {lastSuccess && !downloading && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
                  <CardContent className="p-4 flex items-start gap-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Backup downloaded</p>
                      <p className="text-[11px] text-emerald-600/80 dark:text-emerald-500/80 mt-0.5 font-mono break-all">{lastSuccess}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main download CTA */}
          <Button
            className="w-full gap-2 h-10"
            size="lg"
            onClick={handleDownload}
            disabled={downloading || statsLoading}
          >
            {downloading ? (
              <><RefreshCw className="h-4 w-4 animate-spin" /> Generating Backup…</>
            ) : (
              <><HardDriveDownload className="h-4 w-4" /> Download Full Backup</>
            )}
          </Button>
        </motion.div>
      </div>
    </div>
  )
}

export default BackupPage
