import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  Search,
  ChevronDown,
  ChevronRight,
  X,
  Filter,
  BookOpen,
  Lightbulb,
  Bug,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
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
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/utils/cn'
import { knowledgeApi } from '@/services/api'
import type { ErrorCode } from '@/types'

// ─── Mock data (fallback) ─────────────────────────────────────────────────────

const MOCK_ERROR_CODES: ErrorCode[] = [
  {
    code: '1001',
    description: 'Connection refused to exchange gateway',
    severity: 'critical',
    module: 'FIX',
    root_cause: 'TCP connection to the NSE FIX gateway was refused. Usually caused by incorrect IP/port configuration, firewall rules, or gateway maintenance window.',
    resolution: '1. Verify FIX gateway IP/port in fix.cfg (FIX_GATEWAY_HOST and FIX_GATEWAY_PORT)\n2. Check firewall rules: nc -zv <ip> <port>\n3. Confirm NSE gateway is not in maintenance window\n4. Restart FIX engine: service fix-engine restart\n5. Monitor reconnection attempts in fix_engine.log',
  },
  {
    code: '1002',
    description: 'FIX session heartbeat timeout',
    severity: 'high',
    module: 'FIX',
    root_cause: 'Heartbeat response not received within configured HeartBtInt seconds. Network congestion, gateway overload, or thread pool saturation.',
    resolution: '1. Check network latency: ping <gateway_ip>\n2. Review HeartBtInt setting in fix.cfg (default: 30s, consider reducing to 15s)\n3. Check CPU usage during timeout window\n4. Ensure FIX thread pool is not saturated (FIX_MAX_THREADS config)\n5. Review JIRA-1039 if using QuickFIX/J 2.3.1 — downgrade to 2.2.0',
  },
  {
    code: '1044',
    description: 'Risk check failed on order modification',
    severity: 'high',
    module: 'RMS',
    root_cause: 'RiskManager.validateModification() returns FAIL. In v9.47, NPE occurs when SKIP_RISK_ON_MODIFY flag is set due to uninitialized orderContext.',
    resolution: '1. Upgrade to v9.47.1 or v9.48 which fixes the NPE (JIRA-1042)\n2. Temporary workaround: Set SKIP_RISK_ON_MODIFY=false in rms.properties\n3. If 1044 appears without v9.47 NPE, check risk limit breaches:\n   - CLIENT_MAX_ORDER_VALUE exceeded\n   - SYMBOL_EXPOSURE_LIMIT exceeded\n4. Check rms_error.log for detailed validation failure reason',
  },
  {
    code: '1050',
    description: 'Order queue overflow',
    severity: 'high',
    module: 'OMS',
    root_cause: 'OMS order queue reached MAX_QUEUE_SIZE. Order rate exceeded processing capacity. Can occur during market open burst or under memory pressure.',
    resolution: '1. Check OMS_QUEUE_SIZE in oms.properties (default: 10000)\n2. Increase queue size if hardware allows: OMS_QUEUE_SIZE=20000\n3. Check order processing throughput: look for PROCESSED/s in oms_stats.log\n4. Investigate cancel-replace storms that exhaust queue slots\n5. Implement client-side rate limiting if specific client is causing bursts',
  },
  {
    code: '1100',
    description: 'Server disconnect — exchange not reachable',
    severity: 'critical',
    module: 'SERVER',
    root_cause: 'Exchange connectivity lost. Can be NSE/BSE/MCX network disconnect, gateway failover, or server NIC issue.',
    resolution: '1. Check exchange network status and NSE/BSE advisories\n2. Verify server NIC: ifconfig -a, ping default-gateway\n3. Check SERVER_RECONNECT_INTERVAL and SERVER_MAX_RETRIES in server.cfg\n4. Review server.log for last successful heartbeat timestamp\n5. If persistent, trigger failover: SERVER_FAILOVER_ENABLE=true',
  },
  {
    code: '2001',
    description: 'Authentication failure — invalid credentials',
    severity: 'medium',
    module: 'CLIENT',
    root_cause: 'Client login failed. Password incorrect, account locked, or session token expired.',
    resolution: '1. Verify credentials in users table\n2. Check if account is locked: SELECT is_locked FROM users WHERE username=?\n3. Reset password: POST /api/v1/users/{id}/reset-password\n4. Check SESSION_TIMEOUT in client.cfg (default: 480 minutes)\n5. Clear browser session and retry login',
  },
  {
    code: '2005',
    description: 'Client session timeout',
    severity: 'low',
    module: 'CLIENT',
    root_cause: 'Client WebSocket or HTTP session expired after configured idle timeout.',
    resolution: '1. Adjust SESSION_TIMEOUT in application settings\n2. Implement client-side keep-alive pings every 5 minutes\n3. Check for proxy timeout settings if behind nginx/Apache\n4. Review nginx proxy_read_timeout and proxy_send_timeout',
  },
  {
    code: '3001',
    description: 'Index build failure — source directory not found',
    severity: 'medium',
    module: 'INDEXER',
    root_cause: 'Configured ROOT_FOLDER path does not exist or is not accessible by the indexing process.',
    resolution: '1. Verify ROOT_FOLDER path in Settings > Indexing\n2. Check filesystem mount: df -h, ls -la <path>\n3. Verify file permissions: chmod 755 <path>\n4. Check indexer process user has read access\n5. Re-trigger indexing after fixing path',
  },
  {
    code: '3010',
    description: 'Document parsing error — corrupted file',
    severity: 'low',
    module: 'INDEXER',
    root_cause: 'Document file is corrupted or in an unsupported format variant. PDF with encryption, Excel with macros, or binary file misidentified.',
    resolution: '1. Re-upload the document from original source\n2. For encrypted PDFs: decrypt before upload\n3. For Excel with macros: save as .xlsx without VBA\n4. Check supported file types list in Settings > Indexing\n5. View failed indexing details in Documents > Status: Failed',
  },
  {
    code: '4001',
    description: 'AI model endpoint unreachable',
    severity: 'high',
    module: 'AI',
    root_cause: 'Ollama or configured AI endpoint is not responding. Service may be stopped or port changed.',
    resolution: '1. Check Ollama status: systemctl status ollama\n2. Verify endpoint URL in Settings > AI\n3. Test endpoint: curl http://localhost:11434/api/generate\n4. Restart Ollama: systemctl restart ollama\n5. Check available models: ollama list',
  },
  {
    code: '4010',
    description: 'AI model response timeout',
    severity: 'medium',
    module: 'AI',
    root_cause: 'LLM inference exceeded configured timeout. Large prompts, resource-constrained hardware, or model too large for available VRAM.',
    resolution: '1. Reduce context window: use smaller MAX_TOKENS in Settings > AI\n2. Switch to smaller/faster model (Mistral 7B vs Llama 70B)\n3. Check GPU/CPU utilization during inference\n4. Increase AI request timeout in system settings\n5. Enable streaming responses to prevent timeout on long answers',
  },
  {
    code: '5001',
    description: 'Database connection pool exhausted',
    severity: 'critical',
    module: 'SYSTEM',
    root_cause: 'All database connection pool slots are occupied. Long-running queries or connection leaks are exhausting the pool.',
    resolution: '1. Check active DB connections: SELECT count(*) FROM pg_stat_activity\n2. Kill long-running queries: SELECT pg_terminate_backend(pid)\n3. Increase DB_POOL_SIZE in application config\n4. Identify connection leaks in application code\n5. Add connection timeout: DB_CONNECT_TIMEOUT=30',
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Normalise severity values coming from the API (e.g. "Critical" → "critical")
function normaliseSeverity(raw: string): ErrorCode['severity'] {
  const lower = raw.toLowerCase()
  if (lower === 'critical') return 'critical'
  if (lower === 'high') return 'high'
  if (lower === 'medium') return 'medium'
  return 'low'
}

// Map a raw API item to the ErrorCode shape the page expects
function mapApiItem(item: Record<string, unknown>): ErrorCode {
  return {
    code: String(item.code ?? ''),
    description: String(item.description ?? ''),
    severity: normaliseSeverity(String(item.severity ?? 'low')),
    module: String(item.module ?? ''),
    root_cause: item.root_cause ? String(item.root_cause) : undefined,
    resolution: item.resolution ? String(item.resolution) : undefined,
  }
}

const SEVERITY_CONFIG = {
  critical: { bg: 'bg-red-100 dark:bg-red-950/40', text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500', label: 'Critical' },
  high: { bg: 'bg-orange-100 dark:bg-orange-950/40', text: 'text-orange-700 dark:text-orange-400', dot: 'bg-orange-500', label: 'High' },
  medium: { bg: 'bg-amber-100 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500', label: 'Medium' },
  low: { bg: 'bg-slate-100 dark:bg-slate-800/60', text: 'text-slate-600 dark:text-slate-400', dot: 'bg-slate-400', label: 'Low' },
}

const SeverityBadge: React.FC<{ severity: ErrorCode['severity'] }> = ({ severity }) => {
  const cfg = SEVERITY_CONFIG[severity]
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', cfg.bg, cfg.text)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  )
}

const MODULES = ['FIX', 'RMS', 'OMS', 'SERVER', 'CLIENT', 'INDEXER', 'AI', 'SYSTEM']

// ─── Error Code Row ───────────────────────────────────────────────────────────

const ErrorCodeRow: React.FC<{ code: ErrorCode; index: number }> = ({ code, index }) => {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <motion.tr
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: index * 0.03 }}
        className={cn('border-b border-border hover:bg-muted/30 transition-colors cursor-pointer', expanded && 'bg-muted/20')}
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="px-5 py-3">
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
            <code className="font-mono text-sm font-bold text-primary">{code.code}</code>
          </div>
        </td>
        <td className="px-5 py-3">
          <p className="text-sm text-foreground">{code.description}</p>
        </td>
        <td className="px-5 py-3">
          <SeverityBadge severity={code.severity} />
        </td>
        <td className="px-5 py-3">
          <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-foreground">{code.module}</span>
        </td>
        <td className="px-5 py-3">
          <span className={cn('text-xs truncate max-w-xs block text-muted-foreground', !expanded && 'line-clamp-1')}>
            {code.resolution?.split('\n')[0] ?? '—'}
          </span>
        </td>
      </motion.tr>
      <AnimatePresence>
        {expanded && (
          <tr>
            <td colSpan={5} className="border-b border-border">
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/10">
                  {code.root_cause && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Bug className="h-3.5 w-3.5 text-orange-500" />
                        <span className="text-xs font-semibold text-foreground">Root Cause</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{code.root_cause}</p>
                    </div>
                  )}
                  {code.resolution && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Lightbulb className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="text-xs font-semibold text-foreground">Resolution Steps</span>
                      </div>
                      <pre className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap font-sans">{code.resolution}</pre>
                    </div>
                  )}
                </div>
              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const ErrorCodesPage: React.FC = () => {
  const [search, setSearch] = useState('')
  const [moduleFilter, setModuleFilter] = useState('all')
  const [severityFilter, setSeverityFilter] = useState('all')

  // ── Fetch real error codes from the API ──────────────────────────────────────
  const { data: errorCodes, isLoading } = useQuery<ErrorCode[]>({
    queryKey: ['error-codes'],
    queryFn: async () => {
      try {
        const res = await knowledgeApi.getErrorCodes({ page_size: 100 })
        const items = (res.data?.items ?? []) as Record<string, unknown>[]
        if (items.length === 0) return MOCK_ERROR_CODES
        return items.map(mapApiItem)
      } catch {
        return MOCK_ERROR_CODES
      }
    },
  })

  const allCodes = errorCodes ?? MOCK_ERROR_CODES

  const filtered = useMemo(() =>
    allCodes.filter((ec) => {
      const matchSearch = !search || ec.code.includes(search) || ec.description.toLowerCase().includes(search.toLowerCase()) || ec.resolution?.toLowerCase().includes(search.toLowerCase())
      const matchModule = moduleFilter === 'all' || ec.module === moduleFilter
      const matchSeverity = severityFilter === 'all' || ec.severity === severityFilter
      return matchSearch && matchModule && matchSeverity
    }),
    [allCodes, search, moduleFilter, severityFilter]
  )

  const clearFilters = () => { setSearch(''); setModuleFilter('all'); setSeverityFilter('all') }
  const hasFilters = search || moduleFilter !== 'all' || severityFilter !== 'all'

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Error Codes"
        subtitle="Knowledge base of all known error codes with root cause analysis and resolution steps."
      />

      {/* Summary cards */}
      {isLoading ? (
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-12 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-4 gap-3">
          {[
            { label: 'Total Codes', value: allCodes.length, color: 'text-foreground' },
            { label: 'Critical', value: allCodes.filter((e) => e.severity === 'critical').length, color: 'text-red-600 dark:text-red-400' },
            { label: 'High', value: allCodes.filter((e) => e.severity === 'high').length, color: 'text-orange-600 dark:text-orange-400' },
            { label: 'Medium/Low', value: allCodes.filter((e) => e.severity === 'medium' || e.severity === 'low').length, color: 'text-amber-600 dark:text-amber-400' },
          ].map(({ label, value, color }) => (
            <Card key={label}>
              <CardContent className="p-4 text-center">
                <p className={cn('text-2xl font-bold tabular-nums', color)}>{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </CardContent>
            </Card>
          ))}
        </motion.div>
      )}

      {/* Filters */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search code, description, resolution…" className="pl-8 h-9 text-sm" />
          {search && <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setSearch('')}><X className="h-3.5 w-3.5" /></button>}
        </div>
        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className="w-32 h-9 text-sm"><SelectValue placeholder="Module" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All modules</SelectItem>
            {MODULES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-32 h-9 text-sm"><SelectValue placeholder="Severity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-9 gap-1 text-xs" onClick={clearFilters}>
            <X className="h-3 w-3" /> Clear
          </Button>
        )}
      </motion.div>

      <p className="text-xs text-muted-foreground">
        Showing <span className="font-medium text-foreground">{filtered.length}</span> error code{filtered.length !== 1 ? 's' : ''} — click any row to expand resolution details
      </p>

      {/* Table */}
      {isLoading ? (
        <Card><CardContent className="p-6 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
        </CardContent></Card>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<BookOpen />} title="No error codes found" description="Try adjusting your search or filters." compact />
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {['Code', 'Description', 'Severity', 'Module', 'Resolution Preview'].map((h) => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((ec, i) => (
                      <ErrorCodeRow key={ec.code} code={ec} index={i} />
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  )
}

export default ErrorCodesPage
