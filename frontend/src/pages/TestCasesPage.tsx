import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  TestTube2,
  Search,
  X,
  ChevronRight,
  ChevronDown,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCcw,
  Download,
  Zap,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { cn } from '@/utils/cn'
import { knowledgeApi } from '@/services/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TestCase {
  id: string
  test_id: string
  name: string
  module: 'RMS' | 'FIX' | 'OMS' | 'SERVER' | 'CLIENT'
  type: 'Regression' | 'Smoke' | 'Performance' | 'Integration'
  status: 'Pass' | 'Fail' | 'Pending'
  priority: 'High' | 'Medium' | 'Low'
  last_run: string
  automated: boolean
  steps?: string
  expected_result?: string
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_TEST_CASES: TestCase[] = [
  { id: '1', test_id: 'TC-001', name: 'FIX Session Establishment — NSE Gateway', module: 'FIX', type: 'Smoke', status: 'Pass', priority: 'High', last_run: '2025-05-22T08:00:00Z', automated: true, steps: '1. Start FIX engine\n2. Initiate session with NSE gateway IP:Port\n3. Verify Logon(35=A) sent and received\n4. Verify HeartBeat(35=0) exchange within 15s', expected_result: 'FIX session established, heartbeat exchanged, session state = LOGGED_ON' },
  { id: '2', test_id: 'TC-002', name: 'FIX Session Drop Recovery at > 15k msg/sec', module: 'FIX', type: 'Performance', status: 'Pass', priority: 'High', last_run: '2025-05-22T08:15:00Z', automated: true, steps: '1. Establish FIX session\n2. Ramp load to 16,000 msg/sec over 60 seconds\n3. Sustain for 120 seconds\n4. Monitor session state', expected_result: 'Session maintained. No drops. Heartbeat success rate > 99.9%' },
  { id: '3', test_id: 'TC-003', name: 'RMS Order Rejection on Risk Limit Breach', module: 'RMS', type: 'Regression', status: 'Pass', priority: 'High', last_run: '2025-05-22T09:00:00Z', automated: true, steps: '1. Set CLIENT_MAX_ORDER_VALUE = ₹50L\n2. Place order for ₹60L\n3. Verify order rejected with error 1044\n4. Check rms_error.log', expected_result: 'Order rejected with code 1044. Risk breach logged. No NPE.' },
  { id: '4', test_id: 'TC-004', name: 'RMS SKIP_RISK_ON_MODIFY NPE Fix (JIRA-1042)', module: 'RMS', type: 'Regression', status: 'Pass', priority: 'High', last_run: '2025-05-22T09:20:00Z', automated: true, steps: '1. Set SKIP_RISK_ON_MODIFY=true\n2. Place original order\n3. Send order modification request\n4. Monitor for NPE in RiskManager.validateModification()', expected_result: 'Order modified successfully. No NPE. Error 1044 not thrown incorrectly.' },
  { id: '5', test_id: 'TC-005', name: 'OMS Cancel-Replace Batch Memory Stability', module: 'OMS', type: 'Performance', status: 'Pass', priority: 'High', last_run: '2025-05-22T10:00:00Z', automated: true, steps: '1. Place 1000 orders\n2. Issue 1000 cancel-replace requests in batch\n3. Monitor JVM heap usage over 10 minutes\n4. Check for heap > 85%', expected_result: 'Heap usage stabilizes below 70%. No GC storm. Memory leak resolved.' },
  { id: '6', test_id: 'TC-006', name: 'OMS IOC Order Expiry', module: 'OMS', type: 'Regression', status: 'Pass', priority: 'Medium', last_run: '2025-05-22T10:30:00Z', automated: true, steps: '1. Place IOC (Immediate-Or-Cancel) order\n2. Wait for partial fill or no fill\n3. Verify remaining quantity cancelled immediately', expected_result: 'IOC order partially filled, remaining quantity auto-cancelled within 1 tick' },
  { id: '7', test_id: 'TC-007', name: 'NSE AMO Order Type Code Mapping', module: 'OMS', type: 'Integration', status: 'Pass', priority: 'High', last_run: '2025-05-22T11:00:00Z', automated: true, steps: '1. Enable AMO_ORDER_ENABLE=true\n2. Place After Market Order\n3. Verify FIX tag 40 value = 7 in outbound FIX message\n4. Verify NSE gateway accepts order', expected_result: 'AMO order accepted by NSE. FIX tag 40 = 7 confirmed in fix_engine.log' },
  { id: '8', test_id: 'TC-008', name: 'GTD Order Type Code Mapping', module: 'OMS', type: 'Integration', status: 'Fail', priority: 'High', last_run: '2025-05-21T14:00:00Z', automated: true, steps: '1. Enable GTD_ORDER_ENABLE=true\n2. Place Good-Till-Date order with future date\n3. Verify FIX tag 40 value = 8\n4. Verify NSE accepts and confirms order', expected_result: 'GTD order accepted. FIX tag 40 = 8. Order active until specified date.', },
  { id: '9', test_id: 'TC-009', name: 'SERVER NSE Failover Reconnection', module: 'SERVER', type: 'Integration', status: 'Pass', priority: 'High', last_run: '2025-05-22T11:30:00Z', automated: false, steps: '1. Establish active connection to NSE primary gateway\n2. Simulate primary gateway disconnect\n3. Verify server reconnects to secondary\n4. Verify trading resumes within 30 seconds', expected_result: 'Auto-reconnect to secondary gateway in < 30s. No process crash. Trading resumes.' },
  { id: '10', test_id: 'TC-010', name: 'Client Session Timeout and Re-login', module: 'CLIENT', type: 'Regression', status: 'Pending', priority: 'Medium', last_run: '2025-05-20T16:00:00Z', automated: false, steps: '1. Login as client user\n2. Set idle timer to trigger in 2 minutes (test config)\n3. Wait for idle timeout\n4. Attempt any action\n5. Verify redirect to login page', expected_result: 'Session expired gracefully. Client redirected to login. No data loss.' },
  { id: '11', test_id: 'TC-011', name: 'BSE Basket Order Routing', module: 'OMS', type: 'Regression', status: 'Pending', priority: 'Medium', last_run: '2025-05-19T10:00:00Z', automated: false, steps: '1. Enable BASKET_ORDER_ENABLE=true\n2. Create basket with 5 BSE orders\n3. Submit basket\n4. Verify each order routed to BSE correctly', expected_result: 'All 5 orders placed on BSE. Order IDs returned. No rejection errors.' },
  { id: '12', test_id: 'TC-012', name: 'RMS Dynamic Risk Param Reload', module: 'RMS', type: 'Integration', status: 'Pass', priority: 'Medium', last_run: '2025-05-22T12:00:00Z', automated: true, steps: '1. Check current risk limits\n2. Call POST /api/rms/reload-risk-params with new limits\n3. Verify new limits active within 2 seconds\n4. Place test order against new limits', expected_result: 'New risk parameters loaded without restart. Propagated to all risk threads in < 2s.' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })
}

const STATUS_CONFIG = {
  Pass: { bg: 'bg-emerald-100 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-400', icon: CheckCircle2 },
  Fail: { bg: 'bg-red-100 dark:bg-red-950/40', text: 'text-red-700 dark:text-red-400', icon: XCircle },
  Pending: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400', icon: Clock },
}

const MODULE_CONFIG: Record<string, { bg: string; text: string }> = {
  RMS: { bg: 'bg-violet-100 dark:bg-violet-950/40', text: 'text-violet-700 dark:text-violet-400' },
  FIX: { bg: 'bg-blue-100 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-400' },
  OMS: { bg: 'bg-indigo-100 dark:bg-indigo-950/40', text: 'text-indigo-700 dark:text-indigo-400' },
  SERVER: { bg: 'bg-amber-100 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-400' },
  CLIENT: { bg: 'bg-emerald-100 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-400' },
}

const TYPE_CONFIG: Record<string, { bg: string; text: string }> = {
  Regression: { bg: 'bg-red-50 dark:bg-red-950/30', text: 'text-red-600 dark:text-red-400' },
  Smoke: { bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-600 dark:text-blue-400' },
  Performance: { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-600 dark:text-amber-400' },
  Integration: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-600 dark:text-emerald-400' },
}

// ─── Test Case Row ────────────────────────────────────────────────────────────

const TestCaseRow: React.FC<{ tc: TestCase; index: number; running: boolean }> = ({ tc, index, running }) => {
  const [expanded, setExpanded] = useState(false)
  const statusCfg = STATUS_CONFIG[tc.status]
  const StatusIcon = statusCfg.icon
  const moduleCfg = MODULE_CONFIG[tc.module] ?? { bg: 'bg-muted', text: 'text-muted-foreground' }
  const typeCfg = TYPE_CONFIG[tc.type] ?? { bg: 'bg-muted', text: 'text-muted-foreground' }

  const displayStatus = running ? 'Pending' : tc.status
  const displayCfg = running ? STATUS_CONFIG.Pending : statusCfg
  const DisplayIcon = running ? Clock : StatusIcon

  return (
    <>
      <motion.tr
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: index * 0.02 }}
        className={cn('border-b border-border hover:bg-muted/30 transition-colors cursor-pointer', expanded && 'bg-muted/10')}
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="px-5 py-3 w-8">
          {expanded
            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          }
        </td>
        <td className="px-4 py-3">
          <code className="font-mono text-xs font-semibold text-primary">{tc.test_id}</code>
        </td>
        <td className="px-4 py-3 max-w-[240px]">
          <p className="text-xs text-foreground font-medium line-clamp-2 leading-snug">{tc.name}</p>
        </td>
        <td className="px-4 py-3">
          <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-semibold', moduleCfg.bg, moduleCfg.text)}>
            {tc.module}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-medium', typeCfg.bg, typeCfg.text)}>
            {tc.type}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', displayCfg.bg, displayCfg.text)}>
            <DisplayIcon className={cn('h-3 w-3', running && 'animate-spin')} />
            {displayStatus}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className={cn('text-[11px] font-medium',
            tc.priority === 'High' ? 'text-red-600 dark:text-red-400' :
            tc.priority === 'Medium' ? 'text-amber-600 dark:text-amber-400' :
            'text-slate-500 dark:text-slate-400'
          )}>
            {tc.priority}
          </span>
        </td>
        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
          {formatDate(tc.last_run)}
        </td>
        <td className="px-4 py-3">
          <span className={cn(
            'rounded-full px-2 py-0.5 text-[10px] font-medium',
            tc.automated
              ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
          )}>
            {tc.automated ? 'Auto' : 'Manual'}
          </span>
        </td>
      </motion.tr>

      <AnimatePresence>
        {expanded && (
          <tr>
            <td colSpan={9} className="border-b border-border">
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-6 py-4 bg-muted/10 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {tc.steps && (
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Test Steps</p>
                      <pre className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap font-sans">{tc.steps}</pre>
                    </div>
                  )}
                  {tc.expected_result && (
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Expected Result</p>
                      <div className="rounded-lg bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-200/60 dark:border-emerald-800/30 p-3 text-xs text-foreground/80 leading-relaxed">
                        {tc.expected_result}
                      </div>
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

const TestCasesPage: React.FC = () => {
  const [search, setSearch] = useState('')
  const [moduleTab, setModuleTab] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [running, setRunning] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['test-cases'],
    queryFn: async () => {
      try {
        const res = await knowledgeApi.getTestCases()
        const items = (res.data?.items ?? res.data) as TestCase[]
        if (Array.isArray(items) && items.length > 0) return items
        return MOCK_TEST_CASES
      } catch {
        return MOCK_TEST_CASES
      }
    },
  })

  const testCases = data ?? MOCK_TEST_CASES

  const filtered = useMemo(() => {
    return testCases.filter((tc) => {
      const q = search.toLowerCase()
      const matchSearch = !search
        || tc.test_id.toLowerCase().includes(q)
        || tc.name.toLowerCase().includes(q)
      const matchModule = moduleTab === 'all' || tc.module === moduleTab
      const matchStatus = statusFilter === 'all' || tc.status === statusFilter
      const matchType = typeFilter === 'all' || tc.type === typeFilter
      return matchSearch && matchModule && matchStatus && matchType
    })
  }, [testCases, search, moduleTab, statusFilter, typeFilter])

  const stats = useMemo(() => {
    const pass = testCases.filter((t) => t.status === 'Pass').length
    const fail = testCases.filter((t) => t.status === 'Fail').length
    const automated = testCases.filter((t) => t.automated).length
    return {
      total: testCases.length,
      pass,
      fail,
      pending: testCases.filter((t) => t.status === 'Pending').length,
      automationPct: testCases.length > 0 ? Math.round((automated / testCases.length) * 100) : 0,
      passPct: testCases.length > 0 ? Math.round((pass / testCases.length) * 100) : 0,
    }
  }, [testCases])

  const handleRunTests = () => {
    setRunning(true)
    setTimeout(() => setRunning(false), 4000)
  }

  const clearFilters = () => { setSearch(''); setStatusFilter('all'); setTypeFilter('all') }
  const hasFilters = search || statusFilter !== 'all' || typeFilter !== 'all'

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Test Cases"
        subtitle="Browse and run automated and manual test cases across all modules and test types."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
            <Button
              size="sm"
              className="gap-1.5 gradient-brand border-0 text-white hover:opacity-90"
              onClick={handleRunTests}
              disabled={running}
            >
              {running
                ? <><RefreshCcw className="h-3.5 w-3.5 animate-spin" /> Running…</>
                : <><Play className="h-3.5 w-3.5" /> Run Tests</>
              }
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-foreground' },
          { label: 'Pass', value: stats.pass, color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Fail', value: stats.fail, color: 'text-red-600 dark:text-red-400' },
          { label: 'Automation %', value: `${stats.automationPct}%`, color: 'text-violet-600 dark:text-violet-400' },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardContent className="p-4 text-center">
              <p className={cn('text-2xl font-bold tabular-nums', color)}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Pass rate progress */}
      <div className="flex items-center gap-3">
        <p className="text-xs text-muted-foreground whitespace-nowrap">Pass rate</p>
        <Progress value={stats.passPct} className="h-2 flex-1 max-w-xs" />
        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{stats.passPct}%</span>
      </div>

      {/* Module Tabs */}
      <Tabs value={moduleTab} onValueChange={setModuleTab}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            {['all', 'RMS', 'FIX', 'OMS', 'SERVER', 'CLIENT'].map((m) => (
              <TabsTrigger key={m} value={m} className="text-xs">
                {m === 'all' ? 'All' : m}
                {m !== 'all' && (
                  <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                    {testCases.filter((t) => t.module === m).length}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search test ID, name…" className="pl-8 h-9 text-sm" />
              {search && <button className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setSearch('')}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>}
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32 h-9 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="Pass">Pass</SelectItem>
                <SelectItem value="Fail">Fail</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-36 h-9 text-sm"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="Regression">Regression</SelectItem>
                <SelectItem value="Smoke">Smoke</SelectItem>
                <SelectItem value="Performance">Performance</SelectItem>
                <SelectItem value="Integration">Integration</SelectItem>
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="ghost" size="sm" className="h-9 gap-1 text-xs" onClick={clearFilters}>
                <X className="h-3 w-3" /> Clear
              </Button>
            )}
          </div>
        </div>

        <TabsContent value={moduleTab} className="mt-4">
          {running && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-3 flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 px-4 py-2.5"
            >
              <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400 animate-pulse" />
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                Test execution in progress… Running {filtered.filter((t) => t.automated).length} automated test cases
              </p>
            </motion.div>
          )}

          <p className="text-xs text-muted-foreground mb-3">
            Showing <span className="font-medium text-foreground">{filtered.length}</span> test case{filtered.length !== 1 ? 's' : ''} — click to expand steps
          </p>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<TestTube2 />}
              title="No test cases found"
              description="Try adjusting your filters."
              action={{ label: 'Clear filters', onClick: clearFilters }}
              compact
            />
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="px-5 py-3 w-8" />
                        {['Test ID', 'Name', 'Module', 'Type', 'Status', 'Priority', 'Last Run', 'Automation'].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence initial={false}>
                        {filtered.map((tc, i) => (
                          <TestCaseRow key={tc.id} tc={tc} index={i} running={running && tc.automated} />
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default TestCasesPage
