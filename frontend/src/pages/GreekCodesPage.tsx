import React, { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  Search,
  X,
  Download,
  BookOpen,
  RefreshCcw,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { cn } from '@/utils/cn'
import { knowledgeApi } from '@/services/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface GreekCode {
  greek_code: string
  exchange: 'NSE' | 'BSE' | 'MCX' | 'ALL'
  product_type: string
  description: string
  segment: string
  series?: string
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_GREEK_CODES: GreekCode[] = [
  // NSE
  { greek_code: 'EQ', exchange: 'NSE', product_type: 'Equity', description: 'Equity Cash Segment — normal delivery shares', segment: 'Capital Market', series: 'EQ' },
  { greek_code: 'BE', exchange: 'NSE', product_type: 'Equity', description: 'Trade-for-Trade settlement segment (compulsory delivery)', segment: 'Capital Market', series: 'BE' },
  { greek_code: 'BL', exchange: 'NSE', product_type: 'Equity', description: 'Block Deal Session — large trades between institutions', segment: 'Capital Market', series: 'BL' },
  { greek_code: 'MF', exchange: 'NSE', product_type: 'Mutual Fund', description: 'Mutual Fund Units traded on exchange platform', segment: 'Capital Market', series: 'MF' },
  { greek_code: 'IL', exchange: 'NSE', product_type: 'Equity', description: 'Institutional Lot Series — higher minimum lot for FIIs', segment: 'Capital Market', series: 'IL' },
  { greek_code: 'FUTIDX', exchange: 'NSE', product_type: 'Futures', description: 'Index Futures — NIFTY 50, BANKNIFTY, etc.', segment: 'F&O', series: 'FUTIDX' },
  { greek_code: 'FUTSTK', exchange: 'NSE', product_type: 'Futures', description: 'Stock Futures — individual stock futures contracts', segment: 'F&O', series: 'FUTSTK' },
  { greek_code: 'OPTIDX', exchange: 'NSE', product_type: 'Options', description: 'Index Options — NIFTY and BANKNIFTY call/put options', segment: 'F&O', series: 'OPTIDX' },
  { greek_code: 'OPTSTK', exchange: 'NSE', product_type: 'Options', description: 'Stock Options — individual stock call/put options', segment: 'F&O', series: 'OPTSTK' },
  { greek_code: 'FUTIVX', exchange: 'NSE', product_type: 'Futures', description: 'India VIX Futures — volatility index futures', segment: 'F&O', series: 'FUTIVX' },
  { greek_code: 'CDS', exchange: 'NSE', product_type: 'Currency', description: 'Currency Derivatives Segment — USDINR, EURINR etc.', segment: 'Currency', series: 'CDS' },
  { greek_code: 'SLB', exchange: 'NSE', product_type: 'SLB', description: 'Securities Lending and Borrowing Mechanism', segment: 'SLB', series: 'SLB' },

  // BSE
  { greek_code: 'A', exchange: 'BSE', product_type: 'Equity', description: 'BSE Group A — large cap and liquid stocks', segment: 'Capital Market', series: 'A' },
  { greek_code: 'B', exchange: 'BSE', product_type: 'Equity', description: 'BSE Group B — mid cap stocks', segment: 'Capital Market', series: 'B' },
  { greek_code: 'T', exchange: 'BSE', product_type: 'Equity', description: 'BSE Group T — trade-for-trade segment', segment: 'Capital Market', series: 'T' },
  { greek_code: 'S', exchange: 'BSE', product_type: 'SME', description: 'BSE SME — Small and Medium Enterprise platform', segment: 'Capital Market', series: 'S' },
  { greek_code: 'Z', exchange: 'BSE', product_type: 'Equity', description: 'BSE Group Z — suspended or delisted companies', segment: 'Capital Market', series: 'Z' },
  { greek_code: 'BO_FUT', exchange: 'BSE', product_type: 'Futures', description: 'BSE Stock Futures contracts', segment: 'F&O', series: 'FUT' },
  { greek_code: 'BO_OPT', exchange: 'BSE', product_type: 'Options', description: 'BSE Stock and Index Options contracts', segment: 'F&O', series: 'OPT' },
  { greek_code: 'BSE_CDS', exchange: 'BSE', product_type: 'Currency', description: 'BSE Currency Derivatives — USDINR, GBPINR, EURINR', segment: 'Currency', series: 'CDS' },

  // MCX
  { greek_code: 'FUTCOM', exchange: 'MCX', product_type: 'Commodity Futures', description: 'MCX Commodity Futures — Gold, Silver, Crude Oil, Natural Gas', segment: 'Commodity', series: 'FUTCOM' },
  { greek_code: 'OPTFUT', exchange: 'MCX', product_type: 'Options on Futures', description: 'MCX Options on Commodity Futures — Gold Mini Options etc.', segment: 'Commodity', series: 'OPTFUT' },
  { greek_code: 'GOLD', exchange: 'MCX', product_type: 'Commodity', description: 'Gold Futures contract (10 grams, INR/10g)', segment: 'Commodity', series: 'GOLD' },
  { greek_code: 'GOLDM', exchange: 'MCX', product_type: 'Commodity', description: 'Gold Mini Futures — smaller contract size (100g)', segment: 'Commodity', series: 'GOLDM' },
  { greek_code: 'SILVERM', exchange: 'MCX', product_type: 'Commodity', description: 'Silver Mini Futures — 5kg contract', segment: 'Commodity', series: 'SILVERM' },
  { greek_code: 'CRUDEOIL', exchange: 'MCX', product_type: 'Commodity', description: 'Crude Oil Futures (100 barrels, INR/barrel)', segment: 'Energy', series: 'CRUDEOIL' },
  { greek_code: 'NATURALGAS', exchange: 'MCX', product_type: 'Commodity', description: 'Natural Gas Futures (1250 mmBtu)', segment: 'Energy', series: 'NATURALGAS' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EXCHANGE_CONFIG: Record<string, { bg: string; text: string; dot: string }> = {
  NSE: { bg: 'bg-blue-100 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-400', dot: 'bg-blue-500' },
  BSE: { bg: 'bg-red-100 dark:bg-red-950/40', text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500' },
  MCX: { bg: 'bg-amber-100 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
  ALL: { bg: 'bg-violet-100 dark:bg-violet-950/40', text: 'text-violet-700 dark:text-violet-400', dot: 'bg-violet-500' },
}

function downloadCsv(data: GreekCode[], filename: string) {
  const headers = ['Greek Code', 'Exchange', 'Product Type', 'Description', 'Segment', 'Series']
  const rows = data.map((g) => [g.greek_code, g.exchange, g.product_type, `"${g.description}"`, g.segment, g.series ?? ''])
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── Greek Code Row ───────────────────────────────────────────────────────────

const GreekCodeRow: React.FC<{ code: GreekCode; index: number }> = ({ code, index }) => {
  const exchCfg = EXCHANGE_CONFIG[code.exchange] ?? EXCHANGE_CONFIG.NSE

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.02 }}
      className="border-b border-border hover:bg-muted/30 transition-colors"
    >
      <td className="px-5 py-3">
        <code className="font-mono text-sm font-bold text-primary">{code.greek_code}</code>
      </td>
      <td className="px-5 py-3">
        <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold', exchCfg.bg, exchCfg.text)}>
          <span className={cn('h-1.5 w-1.5 rounded-full', exchCfg.dot)} />
          {code.exchange}
        </span>
      </td>
      <td className="px-5 py-3">
        <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
          {code.product_type}
        </span>
      </td>
      <td className="px-5 py-3 max-w-sm">
        <p className="text-xs text-muted-foreground leading-snug">{code.description}</p>
      </td>
      <td className="px-5 py-3">
        <span className="text-xs text-muted-foreground">{code.segment}</span>
      </td>
      <td className="px-5 py-3">
        <code className="font-mono text-xs text-muted-foreground">{code.series ?? '—'}</code>
      </td>
    </motion.tr>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const GreekCodesPage: React.FC = () => {
  const [search, setSearch] = useState('')
  const [exchangeTab, setExchangeTab] = useState('all')

  const { data, isLoading } = useQuery({
    queryKey: ['greek-codes'],
    queryFn: async () => {
      try {
        const res = await knowledgeApi.getGreekCodes()
        const items = (res.data?.items ?? res.data) as GreekCode[]
        if (Array.isArray(items) && items.length > 0) return items
        return MOCK_GREEK_CODES
      } catch {
        return MOCK_GREEK_CODES
      }
    },
  })

  const codes = data ?? MOCK_GREEK_CODES

  const filtered = useMemo(() => {
    return codes.filter((c) => {
      const q = search.toLowerCase()
      const matchSearch = !search
        || c.greek_code.toLowerCase().includes(q)
        || c.description.toLowerCase().includes(q)
        || c.product_type.toLowerCase().includes(q)
        || c.segment.toLowerCase().includes(q)
      const matchExchange = exchangeTab === 'all' || c.exchange === exchangeTab
      return matchSearch && matchExchange
    })
  }, [codes, search, exchangeTab])

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: codes.length }
    codes.forEach((c) => { counts[c.exchange] = (counts[c.exchange] ?? 0) + 1 })
    return counts
  }, [codes])

  const clearSearch = () => setSearch('')

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Greek Codes & Exchange Mappings"
        subtitle="Reference guide for exchange-specific instrument codes, segments, and product type mappings."
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => downloadCsv(filtered, `greek-codes-${exchangeTab}.csv`)}
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Codes', value: codes.length, color: 'text-foreground' },
          { label: 'NSE', value: codes.filter((c) => c.exchange === 'NSE').length, color: 'text-blue-600 dark:text-blue-400' },
          { label: 'BSE', value: codes.filter((c) => c.exchange === 'BSE').length, color: 'text-red-600 dark:text-red-400' },
          { label: 'MCX', value: codes.filter((c) => c.exchange === 'MCX').length, color: 'text-amber-600 dark:text-amber-400' },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardContent className="p-4 text-center">
              <p className={cn('text-2xl font-bold tabular-nums', color)}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Exchange Tabs + Search */}
      <Tabs value={exchangeTab} onValueChange={setExchangeTab}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            {['all', 'NSE', 'BSE', 'MCX'].map((exch) => {
              const cfg = exch !== 'all' ? EXCHANGE_CONFIG[exch] : null
              return (
                <TabsTrigger key={exch} value={exch} className="gap-1.5">
                  {cfg && <span className={cn('h-2 w-2 rounded-full', cfg.dot)} />}
                  {exch === 'all' ? 'All Exchanges' : exch}
                  <span className="ml-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                    {tabCounts[exch] ?? 0}
                  </span>
                </TabsTrigger>
              )
            })}
          </TabsList>

          {/* Search */}
          <div className="relative min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search code or description…"
              className="pl-8 h-9 text-sm"
            />
            {search && (
              <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={clearSearch}>
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <TabsContent value={exchangeTab} className="mt-4">
          <p className="text-xs text-muted-foreground mb-3">
            Showing <span className="font-medium text-foreground">{filtered.length}</span> code{filtered.length !== 1 ? 's' : ''}
          </p>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<BookOpen />}
              title="No codes found"
              description="Try adjusting your search or exchange filter."
              action={{ label: 'Clear search', onClick: clearSearch }}
              compact
            />
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          {['Greek Code', 'Exchange', 'Product Type', 'Description', 'Segment', 'Series'].map((h) => (
                            <th key={h} className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((code, i) => (
                          <GreekCodeRow key={`${code.greek_code}-${code.exchange}`} code={code} index={i} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default GreekCodesPage
