import React, { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  Terminal,
  Search,
  Filter,
  Eye,
  Brain,
  AlertTriangle,
  X,
  RefreshCcw,
  Download,
  Clock,
  HardDrive,
  FileText,
  Activity,
  ChevronDown,
  ChevronRight,
  Zap,
  CheckCircle2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/utils/cn'
import { logsApi } from '@/services/api'
import type { LogFile } from '@/types'

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_LOGS: LogFile[] = [
  { id: '1', filename: 'rms_trading_20250522.log', module: 'RMS', size_bytes: 52428800, indexed_at: '2025-05-22T10:00:00Z', log_type: 'rms', entry_count: 142500, error_count: 23 },
  { id: '2', filename: 'rms_risk_20250522.log', module: 'RMS', size_bytes: 31457280, indexed_at: '2025-05-22T10:00:00Z', log_type: 'rms', entry_count: 88200, error_count: 7 },
  { id: '3', filename: 'rms_preopen_20250522.log', module: 'RMS', size_bytes: 18874368, indexed_at: '2025-05-22T10:05:00Z', log_type: 'rms', entry_count: 43000, error_count: 412 },
  { id: '4', filename: 'fix_gateway_NSE_20250522.log', module: 'FIX', size_bytes: 67108864, indexed_at: '2025-05-22T09:55:00Z', log_type: 'fix', entry_count: 198400, error_count: 0 },
  { id: '5', filename: 'fix_gateway_BSE_20250522.log', module: 'FIX', size_bytes: 45088768, indexed_at: '2025-05-22T09:55:00Z', log_type: 'fix', entry_count: 134200, error_count: 3 },
  { id: '6', filename: 'fix_session_drop_20250521.log', module: 'FIX', size_bytes: 8388608, indexed_at: '2025-05-21T18:00:00Z', log_type: 'fix', entry_count: 22000, error_count: 156 },
  { id: '7', filename: 'oms_order_router_20250522.log', module: 'OMS', size_bytes: 58720256, indexed_at: '2025-05-22T10:10:00Z', log_type: 'oms', entry_count: 178000, error_count: 18 },
  { id: '8', filename: 'oms_cancelreplace_20250521.log', module: 'OMS', size_bytes: 25165824, indexed_at: '2025-05-21T20:00:00Z', log_type: 'oms', entry_count: 67200, error_count: 88 },
  { id: '9', filename: 'oms_memory_diag_20250521.log', module: 'OMS', size_bytes: 4194304, indexed_at: '2025-05-21T22:00:00Z', log_type: 'oms', entry_count: 8900, error_count: 3 },
  { id: '10', filename: 'server_main_20250522.log', module: 'SERVER', size_bytes: 41943040, indexed_at: '2025-05-22T09:50:00Z', log_type: 'server', entry_count: 122500, error_count: 0 },
  { id: '11', filename: 'server_nse_conn_20250522.log', module: 'SERVER', size_bytes: 15728640, indexed_at: '2025-05-22T09:52:00Z', log_type: 'server', entry_count: 42100, error_count: 2 },
  { id: '12', filename: 'server_bse_conn_20250521.log', module: 'SERVER', size_bytes: 13631488, indexed_at: '2025-05-21T18:30:00Z', log_type: 'server', entry_count: 38400, error_count: 0 },
  { id: '13', filename: 'client_session_20250522.log', module: 'CLIENT', size_bytes: 22020096, indexed_at: '2025-05-22T10:15:00Z', log_type: 'client', entry_count: 64800, error_count: 11 },
  { id: '14', filename: 'client_order_ui_20250522.log', module: 'CLIENT', size_bytes: 18874368, indexed_at: '2025-05-22T10:15:00Z', log_type: 'client', entry_count: 54200, error_count: 5 },
  { id: '15', filename: 'client_auth_20250521.log', module: 'CLIENT', size_bytes: 5242880, indexed_at: '2025-05-21T23:00:00Z', log_type: 'client', entry_count: 14100, error_count: 44 },
]

const LOG_CONTENT: Record<string, string> = {
  'rms_preopen_20250522.log': `[2025-05-22 09:00:01.112] INFO  RMS Pre-open session started for NSE
[2025-05-22 09:00:05.223] INFO  RMS Risk parameters loaded: 2,450 instruments
[2025-05-22 09:15:22.441] WARN  RMS SKIP_RISK_ON_MODIFY flag is set to 1 — null checks disabled
[2025-05-22 09:15:22.448] INFO  RMS Order 78430 MODIFY accepted (bypass active)
[2025-05-22 09:15:22.452] INFO  RMS Order 78431 MODIFY accepted (bypass active)
[2025-05-22 09:15:22.455] ERROR RMS NullPointerException at RiskManager.validateModification:412
  at RiskManager.java:412 validateModification()
  at OrderModifyHandler.java:88 handleModify()
  at PreOpenSession.java:203 processMessage()
[2025-05-22 09:15:22.456] ERROR RMS Order 78432 MODIFY_REJECTED: internal error
[2025-05-22 09:15:22.457] WARN  RMS Disabling pre-open modify queue due to repeated NPE
[2025-05-22 09:32:11.882] ERROR RMS Order 78499 MODIFY_REJECTED: pre-open queue disabled
[2025-05-22 09:32:11.883] INFO  RMS 410 orders rejected in pre-open window
[2025-05-22 09:45:00.001] INFO  RMS Pre-open session ended, normal market starting`,

  'fix_session_drop_20250521.log': `[2025-05-21 10:00:00.001] INFO  FIX Session CLIENT1 Established (QuickFIX/J 2.3.1)
[2025-05-21 10:00:00.100] INFO  FIX Heartbeat interval: 30s, ThreadPool: 32 threads (work-stealing)
[2025-05-21 10:12:34.221] INFO  FIX Message throughput: 12,400 msg/sec
[2025-05-21 10:13:01.445] INFO  FIX Message throughput: 14,800 msg/sec
[2025-05-21 10:13:12.889] WARN  FIX ThreadPool utilization: 28/32 (87.5%)
[2025-05-21 10:13:41.112] WARN  FIX ThreadPool utilization: 31/32 (96.9%)
[2025-05-21 10:13:58.334] ERROR FIX ThreadPool exhausted: 32/32 threads active — I/O thread queuing
[2025-05-21 10:14:28.554] ERROR FIX Heartbeat timeout for session CLIENT1 (missed 2 consecutive)
[2025-05-21 10:14:28.890] ERROR FIX SessionID=CLIENT1 Disconnected: HeartbeatTimeout
[2025-05-21 10:14:28.891] INFO  FIX Attempting reconnect for CLIENT1 ...
[2025-05-21 10:14:29.220] ERROR FIX Reconnect failed: remote closed connection
[2025-05-21 10:14:59.221] INFO  FIX CLIENT1 reconnected after 30s`,

  'oms_cancelreplace_20250521.log': `[2025-05-21 14:00:00.001] INFO  OMS Cancel-replace batching enabled (batch_size=50)
[2025-05-21 14:00:05.112] INFO  OMS Processing cancel-replace batch #1: 50 orders
[2025-05-21 14:15:33.441] INFO  OMS Heap usage: 62% (4.96 GB / 8 GB)
[2025-05-21 14:28:11.889] WARN  OMS Heap usage: 78% (6.24 GB / 8 GB) — GC pressure starting
[2025-05-21 14:32:55.220] WARN  OMS GC pause: 450ms (G1 GC full collection triggered)
[2025-05-21 14:35:01.334] ERROR OMS Heap usage: 94% (7.52 GB / 8 GB) — critical threshold
[2025-05-21 14:35:01.335] ERROR OMS Cancel-replace queue stalled: GC pause 2300ms
[2025-05-21 14:35:15.000] WARN  OMS Emergency GC triggered — trading paused 3.1s
[2025-05-21 14:40:00.001] INFO  OMS Heap usage stabilized at 71% after GC
[2025-05-21 14:40:00.002] WARN  OMS Order latency P99: 850ms (SLA: 200ms) during GC event`,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatBytes = (bytes: number): string => {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${bytes} B`
}

const formatCount = (n: number): string => {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`
  return String(n)
}

const MODULE_TABS = ['All', 'RMS', 'FIX', 'OMS', 'SERVER', 'CLIENT']

const MODULE_COLORS: Record<string, string> = {
  RMS: 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400',
  FIX: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
  OMS: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400',
  SERVER: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  CLIENT: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
}

// ─── Log viewer modal ─────────────────────────────────────────────────────────

interface LogViewerProps {
  log: LogFile | null
  onClose: () => void
}

const LogViewer: React.FC<LogViewerProps> = ({ log, onClose }) => {
  const content = log ? LOG_CONTENT[log.filename] ?? `[No preview available for ${log.filename}]\n\nThis file has ${log.entry_count.toLocaleString()} entries and ${log.error_count} errors.\nFile size: ${formatBytes(log.size_bytes)}\nIndexed at: ${new Date(log.indexed_at).toLocaleString()}` : ''

  const colorLine = (line: string) => {
    if (line.includes('ERROR') || line.includes('FATAL')) return 'text-red-500 dark:text-red-400'
    if (line.includes('WARN')) return 'text-amber-500 dark:text-amber-400'
    if (line.includes('INFO')) return 'text-emerald-500 dark:text-emerald-400'
    return 'text-muted-foreground'
  }

  return (
    <Dialog open={!!log} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-mono">
            <Terminal className="h-4 w-4 text-primary" />
            {log?.filename}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap gap-3 text-xs">
            {log && (
              <>
                <span className="flex items-center gap-1"><HardDrive className="h-3 w-3" /> {formatBytes(log.size_bytes)}</span>
                <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> {log.entry_count.toLocaleString()} entries</span>
                {log.error_count > 0 && (
                  <span className="flex items-center gap-1 text-red-500"><AlertTriangle className="h-3 w-3" /> {log.error_count} errors</span>
                )}
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Indexed {new Date(log.indexed_at).toLocaleString()}</span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 mt-2">
          <pre className="rounded-lg bg-slate-950 dark:bg-black p-4 text-xs leading-relaxed overflow-x-auto">
            {content.split('\n').map((line, i) => (
              <div key={i} className={cn('whitespace-pre font-mono', colorLine(line))}>
                <span className="select-none text-slate-600 mr-3 text-[10px]">{String(i + 1).padStart(3, ' ')}</span>
                {line}
              </div>
            ))}
          </pre>
        </ScrollArea>

        <div className="flex gap-2 pt-2 border-t border-border mt-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" /> Download
          </Button>
          <Button size="sm" className="gap-1.5 text-xs gradient-brand border-0 text-white hover:opacity-90">
            <Brain className="h-3.5 w-3.5" /> Analyze with AI
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Log file row ─────────────────────────────────────────────────────────────

interface LogFileRowProps {
  log: LogFile
  index: number
  onView: (log: LogFile) => void
  onAnalyze: (log: LogFile) => void
}

const LogFileRow: React.FC<LogFileRowProps> = ({ log, index, onView, onAnalyze }) => {
  return (
    <motion.tr
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.03 }}
      className="hover:bg-muted/30 transition-colors group"
    >
      <td className="px-6 py-3">
        <div className="flex items-center gap-2">
          <Terminal className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <span className="text-xs font-mono text-foreground">{log.filename}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium', MODULE_COLORS[log.module] ?? MODULE_COLORS.SERVER)}>
          {log.module}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
        {formatBytes(log.size_bytes)}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
        {new Date(log.indexed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
        <span className="ml-1 text-[10px] opacity-60">
          {new Date(log.indexed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap tabular-nums">
        {formatCount(log.entry_count)}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {log.error_count > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 px-2 py-0.5 text-[11px] font-semibold">
            <AlertTriangle className="h-3 w-3" />
            {log.error_count.toLocaleString()}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 text-[11px] font-medium">
            <CheckCircle2 className="h-3 w-3" />
            0
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => onView(log)}
          >
            <Eye className="h-3 w-3" /> View
          </Button>
          <Button
            size="sm"
            className="h-7 gap-1 text-xs gradient-brand border-0 text-white hover:opacity-90"
            onClick={() => onAnalyze(log)}
          >
            <Brain className="h-3 w-3" /> Analyze
          </Button>
        </div>
      </td>
    </motion.tr>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const LogsExplorerPage: React.FC = () => {
  const [activeModule, setActiveModule] = useState('All')
  const [search, setSearch] = useState('')
  const [viewingLog, setViewingLog] = useState<LogFile | null>(null)
  const [analyzingLog, setAnalyzingLog] = useState<LogFile | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['logs', 'files'],
    queryFn: async () => {
      try {
        const res = await logsApi.getFiles()
        const items: Array<{
          filename: string
          module: string
          size_bytes: number
          entry_count: number
          error_count: number
          indexed_at?: string
        }> = res.data?.items ?? res.data ?? []
        if (!items.length) return MOCK_LOGS
        return items.map((item) => ({
          id: item.filename,
          filename: item.filename,
          module: (item.module ?? '').toUpperCase(),
          size_bytes: item.size_bytes ?? 0,
          indexed_at: item.indexed_at ?? new Date().toISOString(),
          log_type: (item.module ?? 'server').toLowerCase() as LogFile['log_type'],
          entry_count: item.entry_count ?? 0,
          error_count: item.error_count ?? 0,
        })) as LogFile[]
      } catch {
        return MOCK_LOGS
      }
    },
  })

  const logs = data ?? MOCK_LOGS

  // Module stats
  const moduleStats = useMemo(() => {
    return MODULE_TABS.slice(1).map((mod) => {
      const modLogs = logs.filter((l) => l.module === mod)
      return {
        module: mod,
        count: modLogs.length,
        errors: modLogs.reduce((s, l) => s + l.error_count, 0),
        entries: modLogs.reduce((s, l) => s + l.entry_count, 0),
      }
    })
  }, [logs])

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      const matchModule = activeModule === 'All' || l.module === activeModule
      const q = search.toLowerCase()
      const matchSearch = !search || l.filename.toLowerCase().includes(q) || l.module.toLowerCase().includes(q)
      return matchModule && matchSearch
    })
  }, [logs, activeModule, search])

  const totalErrors = filtered.reduce((s, l) => s + l.error_count, 0)
  const totalEntries = filtered.reduce((s, l) => s + l.entry_count, 0)
  const totalSize = filtered.reduce((s, l) => s + l.size_bytes, 0)

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Logs Explorer"
        subtitle="Browse, search, and analyze indexed log files across all trading modules."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
            <Button size="sm" className="gap-1.5 gradient-brand border-0 text-white hover:opacity-90">
              <RefreshCcw className="h-3.5 w-3.5" /> Re-index
            </Button>
          </div>
        }
      />

      {/* Summary bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
      >
        {[
          { label: 'Total Files', value: logs.length.toString(), icon: <FileText className="h-4 w-4" />, color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Total Entries', value: formatCount(logs.reduce((s, l) => s + l.entry_count, 0)), icon: <Activity className="h-4 w-4" />, color: 'text-purple-600 dark:text-purple-400' },
          { label: 'Total Size', value: formatBytes(logs.reduce((s, l) => s + l.size_bytes, 0)), icon: <HardDrive className="h-4 w-4" />, color: 'text-indigo-600 dark:text-indigo-400' },
          { label: 'Total Errors', value: logs.reduce((s, l) => s + l.error_count, 0).toLocaleString(), icon: <AlertTriangle className="h-4 w-4" />, color: 'text-red-600 dark:text-red-400' },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <span className={s.color}>{s.icon}</span>
              <div>
                <p className={cn('text-xl font-bold tabular-nums', s.color)}>{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Module stats cards */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.08 }}
        className="grid grid-cols-2 sm:grid-cols-5 gap-3"
      >
        {moduleStats.map((ms) => (
          <button
            key={ms.module}
            onClick={() => setActiveModule(ms.module)}
            className={cn(
              'rounded-xl border p-3 text-left transition-all hover:shadow-md',
              activeModule === ms.module
                ? 'border-primary bg-primary/5 dark:bg-primary/10'
                : 'border-border bg-card hover:border-primary/40'
            )}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', MODULE_COLORS[ms.module] ?? MODULE_COLORS.SERVER)}>
                {ms.module}
              </span>
              {ms.errors > 0 && (
                <span className="text-[10px] font-semibold text-red-500">{ms.errors} err</span>
              )}
            </div>
            <p className="text-sm font-bold text-foreground tabular-nums">{ms.count} files</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{formatCount(ms.entries)} entries</p>
          </button>
        ))}
      </motion.div>

      {/* Module filter tabs + search */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25, delay: 0.15 }}
        className="flex flex-wrap gap-2 items-center"
      >
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {MODULE_TABS.map((mod) => (
            <button
              key={mod}
              onClick={() => setActiveModule(mod)}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-all',
                activeModule === mod
                  ? 'bg-background text-foreground shadow'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {mod}
              {mod !== 'All' && (
                <span className={cn(
                  'ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                  activeModule === mod ? 'bg-primary/10 text-primary' : 'bg-muted-foreground/10'
                )}>
                  {logs.filter((l) => l.module === mod).length}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[220px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search filename, module..."
            className="pl-8 h-9 text-sm"
          />
        </div>
        {search && (
          <Button variant="ghost" size="sm" className="h-9 gap-1 text-xs" onClick={() => setSearch('')}>
            <X className="h-3 w-3" /> Clear
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground hidden sm:block">
          {filtered.length} file{filtered.length !== 1 ? 's' : ''} · {formatCount(totalEntries)} entries · {formatBytes(totalSize)}
          {totalErrors > 0 && (
            <span className="ml-2 text-red-500 font-semibold">{totalErrors.toLocaleString()} errors</span>
          )}
        </span>
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={<Terminal />}
                title="No log files found"
                description="Try adjusting the module filter or search query."
                action={{ label: 'Show all', onClick: () => { setActiveModule('All'); setSearch('') } }}
                compact
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Filename</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Module</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Size</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Indexed</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Entries</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Errors</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <AnimatePresence initial={false}>
                      {filtered.map((log, idx) => (
                        <LogFileRow
                          key={log.id}
                          log={log}
                          index={idx}
                          onView={setViewingLog}
                          onAnalyze={setAnalyzingLog}
                        />
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Log viewer */}
      <LogViewer log={viewingLog} onClose={() => setViewingLog(null)} />

      {/* Analyze dialog */}
      <Dialog open={!!analyzingLog} onOpenChange={() => setAnalyzingLog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              AI Analysis — {analyzingLog?.filename}
            </DialogTitle>
            <DialogDescription>
              ReleaseIQ AI is analyzing this log file for errors, anomalies, and root causes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Scanning {analyzingLog?.entry_count.toLocaleString()} entries…</span>
                <span className="text-primary font-medium">78%</span>
              </div>
              <Progress value={78} className="h-1.5" />
            </div>
            <div className="space-y-2 text-xs">
              {[
                { label: 'Parsing log structure', done: true },
                { label: 'Identifying error patterns', done: true },
                { label: 'Correlating with JIRA issues', done: true },
                { label: 'Generating root cause summary', done: false },
              ].map((step) => (
                <div key={step.label} className="flex items-center gap-2">
                  {step.done
                    ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    : <motion.div
                        className="h-3.5 w-3.5 rounded-full border-2 border-primary border-t-transparent"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      />
                  }
                  <span className={step.done ? 'text-foreground' : 'text-muted-foreground'}>{step.label}</span>
                </div>
              ))}
            </div>
            <Button
              className="w-full gap-2 gradient-brand border-0 text-white hover:opacity-90"
              onClick={() => setAnalyzingLog(null)}
            >
              <Zap className="h-4 w-4" /> View Full Analysis in AI Chat
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default LogsExplorerPage
