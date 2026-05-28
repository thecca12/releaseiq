import React, { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Flag,
  Search,
  X,
  Settings2,
  Zap,
  SlidersHorizontal,
  Globe,
  Copy,
  CheckCircle2,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
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
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/utils/cn'
import { knowledgeApi } from '@/services/api'
import type { FlagDetail } from '@/types'

// ─── Mock data (fallback) ─────────────────────────────────────────────────────

const MOCK_FLAGS: FlagDetail[] = [
  // Trading Style Flags
  { id: '1', name: 'SKIP_RISK_ON_MODIFY', value: 'false', type: 'trading_style', module: 'RMS', description: 'Bypass risk validation on order modification requests. CAUTION: Known NPE in v9.47 when set to true (JIRA-1042).', default_value: 'false' },
  { id: '2', name: 'ENABLE_IOC_ORDERS', value: 'true', type: 'trading_style', module: 'OMS', description: 'Enable Immediate-Or-Cancel order type in the OMS routing engine.', default_value: 'true' },
  { id: '3', name: 'PRE_OPEN_MODIFICATIONS', value: 'true', type: 'trading_style', module: 'OMS', description: 'Allow order modifications during pre-open session (9:00–9:15 AM).', default_value: 'false' },
  { id: '4', name: 'BASKET_ORDER_ENABLE', value: 'true', type: 'trading_style', module: 'OMS', description: 'Enable basket/portfolio order placement for approved clients.', default_value: 'false' },
  { id: '5', name: 'AMO_ORDER_ENABLE', value: 'true', type: 'trading_style', module: 'OMS', description: 'Enable After Market Order (AMO) placement (order type code 7).', default_value: 'true' },
  { id: '6', name: 'GTD_ORDER_ENABLE', value: 'true', type: 'trading_style', module: 'OMS', description: 'Enable Good-Till-Date (GTD) order type (order type code 8).', default_value: 'true' },
  { id: '7', name: 'MIS_AUTO_SQUAREOFF', value: 'false', type: 'trading_style', module: 'RMS', description: 'Automatically square off MIS positions at 3:15 PM if not done manually.', default_value: 'false' },

  // INI Config Flags
  { id: '8', name: 'FIX_MAX_THREADS', value: '16', type: 'ini_config', module: 'FIX', description: 'Maximum thread pool size for the FIX engine session processor.', default_value: '8' },
  { id: '9', name: 'FIX_HEARTBT_INT', value: '15', type: 'ini_config', module: 'FIX', description: 'FIX heartbeat interval in seconds. Reduced from 30 for NSE compliance NSEIT/CMPT/2025/031.', default_value: '30' },
  { id: '10', name: 'OMS_QUEUE_SIZE', value: '15000', type: 'ini_config', module: 'OMS', description: 'Maximum pending order queue depth. Increase for high-volume clients.', default_value: '10000' },
  { id: '11', name: 'RMS_MAX_ORDER_VALUE', value: '50000000', type: 'ini_config', module: 'RMS', description: 'Maximum single order value in INR (₹5 Crores default).', default_value: '10000000' },
  { id: '12', name: 'SERVER_RECONNECT_INTERVAL', value: '5', type: 'ini_config', module: 'SERVER', description: 'Seconds to wait between exchange reconnection attempts.', default_value: '10' },
  { id: '13', name: 'SESSION_TIMEOUT_MINUTES', value: '480', type: 'ini_config', module: 'CLIENT', description: 'Client session inactivity timeout in minutes.', default_value: '240' },
  { id: '14', name: 'LOG_LEVEL', value: 'INFO', type: 'ini_config', module: 'SYSTEM', description: 'Application log level. Set to DEBUG for verbose troubleshooting.', default_value: 'INFO' },

  // Runtime Flags
  { id: '15', name: 'MAINTENANCE_MODE', value: 'false', type: 'runtime', module: 'SYSTEM', description: 'Enable maintenance mode — blocks all new client connections.', default_value: 'false' },
  { id: '16', name: 'CIRCUIT_BREAKER_ACTIVE', value: 'false', type: 'runtime', module: 'RMS', description: 'Activate global circuit breaker to halt all order placement.', default_value: 'false' },
  { id: '17', name: 'FIX_SESSION_ACTIVE', value: 'true', type: 'runtime', module: 'FIX', description: 'FIX session active/inactive state. Toggle without restart.', default_value: 'true' },
  { id: '18', name: 'INDEXING_PAUSED', value: 'false', type: 'runtime', module: 'INDEXER', description: 'Pause background file indexing. Useful during heavy IO operations.', default_value: 'false' },
  { id: '19', name: 'AI_CHAT_ENABLED', value: 'true', type: 'runtime', module: 'AI', description: 'Enable or disable the AI chat/query feature system-wide.', default_value: 'true' },

  // Exchange Flags
  { id: '20', name: 'NSE_EQUITY_ENABLED', value: 'true', type: 'exchange', module: 'NSE', description: 'Enable NSE equity segment (Capital Market).', default_value: 'true' },
  { id: '21', name: 'NSE_DERIVATIVE_ENABLED', value: 'true', type: 'exchange', module: 'NSE', description: 'Enable NSE derivatives segment (F&O).', default_value: 'true' },
  { id: '22', name: 'BSE_EQUITY_ENABLED', value: 'true', type: 'exchange', module: 'BSE', description: 'Enable BSE equity segment.', default_value: 'false' },
  { id: '23', name: 'MCX_COMMODITY_ENABLED', value: 'false', type: 'exchange', module: 'MCX', description: 'Enable MCX commodity trading. Planned for v9.49.', default_value: 'false' },
  { id: '24', name: 'NSE_SLBM_ENABLED', value: 'false', type: 'exchange', module: 'NSE', description: 'Enable NSE Securities Lending and Borrowing Mechanism.', default_value: 'false' },
  { id: '25', name: 'SEBI_CIRCULAR_COMPLIANCE_MODE', value: 'true', type: 'exchange', module: 'SEBI', description: 'Enable strict SEBI circular compliance validation on all orders.', default_value: 'true' },
]

// ─── Tab / module config ──────────────────────────────────────────────────────

const TAB_CONFIG = [
  { value: 'trading_style', label: 'Trading Style', icon: SlidersHorizontal, color: 'text-blue-600 dark:text-blue-400' },
  { value: 'ini_config', label: 'INI Config', icon: Settings2, color: 'text-purple-600 dark:text-purple-400' },
  { value: 'runtime', label: 'Runtime', icon: Zap, color: 'text-amber-600 dark:text-amber-400' },
  { value: 'exchange', label: 'Exchange', icon: Globe, color: 'text-emerald-600 dark:text-emerald-400' },
]

const MODULES_BY_TYPE: Record<FlagDetail['type'], string[]> = {
  trading_style: ['RMS', 'OMS', 'FIX'],
  ini_config: ['FIX', 'OMS', 'RMS', 'SERVER', 'CLIENT', 'SYSTEM'],
  runtime: ['SYSTEM', 'RMS', 'FIX', 'INDEXER', 'AI'],
  exchange: ['NSE', 'BSE', 'MCX', 'SEBI'],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Normalise type field values from the API to the FlagDetail type union
function normaliseType(raw: string): FlagDetail['type'] {
  const lower = raw.toLowerCase()
  if (lower === 'trading_style' || lower === 'trading') return 'trading_style'
  if (lower === 'ini_config' || lower === 'ini' || lower === 'config') return 'ini_config'
  if (lower === 'runtime') return 'runtime'
  if (lower === 'exchange') return 'exchange'
  return 'ini_config'
}

// Map a raw API item to FlagDetail
function mapApiFlag(item: Record<string, unknown>, index: number): FlagDetail {
  // Extract module from section name: "RMS_FLAGS" → "RMS", "EXCHANGE_FLAGS" → "EXCHANGE"
  const rawSection = String(item.section ?? item.module ?? '')
  const module = rawSection.replace(/_FLAGS$/i, '').replace(/_CONFIG$/i, '').toUpperCase() || 'SYSTEM'
  // Determine type: exchange section → exchange, else use type field
  const isExchangeSection = ['NSE', 'BSE', 'MCX', 'SEBI', 'EXCHANGE'].includes(module)
  const rawType = isExchangeSection ? 'exchange' : String(item.type ?? 'ini_config')
  return {
    id: item.id ? String(item.id) : String(index),
    name: String(item.name ?? ''),
    value: String(item.value ?? ''),
    type: normaliseType(rawType),
    module,
    description: item.description ? String(item.description) : undefined,
    default_value: item.default_value ? String(item.default_value) : undefined,
  }
}

function getValueStyle(value: string) {
  const lower = value.toLowerCase()
  if (lower === 'true') return 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
  if (lower === 'false') return 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400'
  if (!isNaN(Number(value))) return 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400'
  return 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400'
}

// ─── Flag Row ─────────────────────────────────────────────────────────────────

const FlagRow: React.FC<{ flag: FlagDetail; index: number }> = ({ flag, index }) => {
  const [copied, setCopied] = useState(false)
  const isModified = flag.value !== flag.default_value

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(`${flag.name}=${flag.value}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.02 }}
      className="border-b border-border hover:bg-muted/30 transition-colors group"
    >
      <td className="px-5 py-3">
        <div className="flex items-center gap-2">
          <code className="font-mono text-xs font-semibold text-foreground">{flag.name}</code>
          {isModified && (
            <span className="text-[9px] rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 font-medium">Modified</span>
          )}
        </div>
      </td>
      <td className="px-5 py-3">
        <code className={cn('rounded-md px-2 py-0.5 text-xs font-mono font-semibold', getValueStyle(flag.value))}>
          {flag.value}
        </code>
      </td>
      <td className="px-5 py-3">
        <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-foreground">{flag.module}</span>
      </td>
      <td className="px-5 py-3 max-w-sm">
        <p className="text-xs text-muted-foreground leading-snug">{flag.description}</p>
      </td>
      <td className="px-5 py-3">
        <code className="text-xs text-muted-foreground font-mono">{flag.default_value}</code>
      </td>
      <td className="px-5 py-3">
        <button
          onClick={handleCopy}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          title="Copy flag"
        >
          {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />}
        </button>
      </td>
    </motion.tr>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const FlagsPage: React.FC = () => {
  const [search, setSearch] = useState('')
  const [moduleFilter, setModuleFilter] = useState('all')
  const [activeTab, setActiveTab] = useState<FlagDetail['type']>('ini_config')

  // ── Fetch real flags from the API ────────────────────────────────────────────
  const { data: flags, isLoading } = useQuery<FlagDetail[]>({
    queryKey: ['flags'],
    queryFn: async () => {
      try {
        const res = await knowledgeApi.getFlags()
        const items = (res.data?.items ?? []) as Record<string, unknown>[]
        if (items.length === 0) return MOCK_FLAGS
        return items.map((item, i) => mapApiFlag(item, i))
      } catch {
        return MOCK_FLAGS
      }
    },
  })

  const allFlags = flags ?? MOCK_FLAGS
  const currentModules = MODULES_BY_TYPE[activeTab]

  const filtered = useMemo(() =>
    allFlags.filter((f) => {
      const matchType = f.type === activeTab
      const matchSearch = !search || f.name.toLowerCase().includes(search.toLowerCase()) || f.description?.toLowerCase().includes(search.toLowerCase())
      const matchModule = moduleFilter === 'all' || f.module === moduleFilter
      return matchType && matchSearch && matchModule
    }),
    [allFlags, search, moduleFilter, activeTab]
  )

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    allFlags.forEach((f) => {
      counts[f.type] = (counts[f.type] ?? 0) + 1
    })
    return counts
  }, [allFlags])

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Trading Flags"
        subtitle="View and reference all trading style, INI configuration, runtime, and exchange flags."
      />

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as FlagDetail['type']); setModuleFilter('all') }}>
        <TabsList className="w-full sm:w-auto">
          {TAB_CONFIG.map(({ value, label, icon: Icon, color }) => (
            <TabsTrigger key={value} value={value} className="gap-1.5">
              <Icon className={cn('h-3.5 w-3.5', color)} />
              {label}
              <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {isLoading ? '…' : (tabCounts[value] ?? 0)}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {TAB_CONFIG.map(({ value }) => (
          <TabsContent key={value} value={value} className="mt-4">
            {/* Filters */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap gap-2 mb-4">
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search flag name or description…" className="pl-8 h-9 text-sm" />
                {search && <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setSearch('')}><X className="h-3.5 w-3.5" /></button>}
              </div>
              <Select value={moduleFilter} onValueChange={setModuleFilter}>
                <SelectTrigger className="w-32 h-9 text-sm"><SelectValue placeholder="Module" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All modules</SelectItem>
                  {currentModules.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </motion.div>

            {isLoading ? (
              <Card><CardContent className="p-6 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
              </CardContent></Card>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-3">
                  Showing <span className="font-medium text-foreground">{filtered.length}</span> flag{filtered.length !== 1 ? 's' : ''}
                  {filtered.filter((f) => f.value !== f.default_value).length > 0 && (
                    <span className="ml-2 text-amber-600 dark:text-amber-400">
                      · {filtered.filter((f) => f.value !== f.default_value).length} modified from default
                    </span>
                  )}
                </p>

                {filtered.length === 0 ? (
                  <EmptyState icon={<Flag />} title="No flags found" description="Try adjusting your search or module filter." compact />
                ) : (
                  <Card>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border">
                              {['Flag Name', 'Value', 'Module', 'Description', 'Default', ''].map((h, i) => (
                                <th key={i} className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.map((flag, i) => (
                              <FlagRow key={flag.id} flag={flag} index={i} />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

export default FlagsPage
