import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  Search,
  ChevronDown,
  ChevronUp,
  Zap,
  FileText,
  CalendarDays,
  X,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { cn } from '@/utils/cn'
import { knowledgeApi } from '@/services/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Circular {
  id?: string
  exchange: 'NSE' | 'BSE' | 'MCX' | 'SEBI' | string
  circular_no: string
  date: string
  subject: string
  body: string
  filename?: string
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_CIRCULARS: Circular[] = [
  {
    exchange: 'NSE',
    circular_no: 'NSE/TECH/48832',
    date: '2025-03-28',
    subject: 'Introduction of new order type codes for AMO and GTD orders',
    body: 'All trading members are informed about new order type codes effective from April 7, 2025. The new codes — 38 (AMO) and 39 (GTD) — must be used in the OrdType field of FIX messages. Members are advised to update their trading systems accordingly before the cutover date.',
  },
  {
    exchange: 'BSE',
    circular_no: 'BSE/2025/0142',
    date: '2025-04-05',
    subject: 'Margin framework update for equity derivatives',
    body: 'Exchange has revised margin calculation methodology for equity derivatives. SPAN margin for index options will be computed using updated volatility parameters. Members must ensure their RMS systems support the new margin file format (v3.2) by April 14, 2025.',
  },
  {
    exchange: 'MCX',
    circular_no: 'MCX/TRD/261/2025',
    date: '2025-04-10',
    subject: 'Introduction of commodity options on crude oil futures',
    body: 'MCX introduces European-style options on crude oil futures contracts. New OrdType codes 40–42 added for commodity options. Trading members need to configure their OMS/RMS to handle the new contract specification and margin requirements effective May 1, 2025.',
  },
  {
    exchange: 'SEBI',
    circular_no: 'SEBI/HO/MRD/DRMNP/P/CIR/2025/38',
    date: '2025-03-15',
    subject: 'Framework for algorithmic trading and co-location facility',
    body: 'SEBI issues updated framework for algorithmic trading including mandatory registration of algos, latency monitoring requirements, and enhanced audit trail mandates. All brokers providing algo trading services must comply by July 1, 2025.',
  },
  {
    exchange: 'NSE',
    circular_no: 'NSE/COMP/48901',
    date: '2025-04-20',
    subject: 'Mandatory implementation of enhanced FIX session security',
    body: 'From June 1, 2025, all co-location and NEAT-on-web members must support TLS 1.3 for FIX gateway connections. Legacy TLS 1.2 sessions will be terminated. Members using QuickFIX/J must upgrade to version 2.3.x or higher.',
  },
  {
    exchange: 'BSE',
    circular_no: 'BSE/2025/0189',
    date: '2025-05-02',
    subject: 'T+1 settlement rollout for additional scrips',
    body: 'BSE extends T+1 settlement cycle to an additional 500 scrips from June 2025. Members must update their back-office and settlement systems to handle T+1 timelines for the expanded scrip universe. Test environment available from May 20, 2025.',
  },
]

// ─── Exchange config ──────────────────────────────────────────────────────────

const EXCHANGE_CONFIG: Record<string, { bg: string; text: string; border: string }> = {
  NSE: {
    bg: 'bg-blue-100 dark:bg-blue-950/40',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800',
  },
  BSE: {
    bg: 'bg-orange-100 dark:bg-orange-950/40',
    text: 'text-orange-700 dark:text-orange-400',
    border: 'border-orange-200 dark:border-orange-800',
  },
  MCX: {
    bg: 'bg-green-100 dark:bg-green-950/40',
    text: 'text-green-700 dark:text-green-400',
    border: 'border-green-200 dark:border-green-800',
  },
  SEBI: {
    bg: 'bg-red-100 dark:bg-red-950/40',
    text: 'text-red-700 dark:text-red-400',
    border: 'border-red-200 dark:border-red-800',
  },
}

function getExchangeConfig(exchange: string) {
  return EXCHANGE_CONFIG[exchange.toUpperCase()] ?? {
    bg: 'bg-muted/40',
    text: 'text-muted-foreground',
    border: 'border-border',
  }
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return dateStr
  }
}

// ─── Circular Card ────────────────────────────────────────────────────────────

interface CircularCardProps {
  circular: Circular
  index: number
}

const CircularCard: React.FC<CircularCardProps> = ({ circular, index }) => {
  const [expanded, setExpanded] = useState(false)
  const [showImpact, setShowImpact] = useState(false)
  const cfg = getExchangeConfig(circular.exchange)

  const impactText = useMemo(() => {
    const ex = circular.exchange.toUpperCase()
    const subj = circular.subject.toLowerCase()
    if (subj.includes('fix') || subj.includes('session') || subj.includes('gateway')) {
      return `FIX engine upgrade required. Verify QuickFIX/J version compatibility and test session establishment in UAT before go-live.`
    }
    if (subj.includes('margin') || subj.includes('rms') || subj.includes('risk')) {
      return `RMS margin engine update needed. Coordinate with ${ex} for updated margin files and validate against current risk parameters.`
    }
    if (subj.includes('algo') || subj.includes('algorithmic')) {
      return `Algo registration and audit trail implementation required. Compliance team must review and submit registration forms before deadline.`
    }
    if (subj.includes('settlement') || subj.includes('t+1')) {
      return `Back-office settlement cycle update needed for ${ex} T+1 rollout. Test with sandbox environment before production cutover.`
    }
    if (subj.includes('order type') || subj.includes('ordtype')) {
      return `OMS/FIX adapter update required to support new order type codes. Regression test against all existing order flows before deployment.`
    }
    return `Review circular and assess impact on trading systems. Coordinate with IT and compliance teams for timely implementation.`
  }, [circular.subject, circular.exchange])

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
    >
      <Card className={cn('hover:shadow-md transition-shadow border-l-4', cfg.border)}>
        <CardContent className="p-4">
          {/* Header row */}
          <div className="flex flex-wrap items-start gap-3 mb-2">
            <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold flex-shrink-0', cfg.bg, cfg.text)}>
              {circular.exchange}
            </span>
            <span className="text-xs font-mono text-muted-foreground">{circular.circular_no}</span>
            <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto flex-shrink-0">
              <CalendarDays className="h-3 w-3" />
              {formatDate(circular.date)}
            </div>
          </div>

          {/* Subject */}
          <p className="text-sm font-semibold text-foreground leading-snug mb-2">{circular.subject}</p>

          {/* Body preview / full */}
          <p className={cn('text-xs text-muted-foreground leading-relaxed', !expanded && 'line-clamp-3')}>
            {circular.body}
          </p>

          {/* Expand/collapse body */}
          <button
            className="mt-1.5 flex items-center gap-1 text-xs text-primary hover:underline"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <><ChevronUp className="h-3 w-3" /> Show less</> : <><ChevronDown className="h-3 w-3" /> Read more</>}
          </button>

          {/* Impact analysis panel */}
          <AnimatePresence>
            {showImpact && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-3 rounded-lg bg-primary/5 border border-primary/20 p-3"
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold text-primary">Impact Analysis</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{impactText}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actions + Tags */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => setShowImpact((v) => !v)}
            >
              <Zap className="h-3 w-3 text-primary" />
              {showImpact ? 'Hide Impact' : 'Impact Analysis'}
            </Button>
            <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium', cfg.bg, cfg.text)}>
              {circular.exchange}
            </span>
            {circular.filename && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] bg-muted/60 text-muted-foreground">
                <FileText className="h-3 w-3" /> {circular.filename}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const EXCHANGE_TABS = ['All', 'NSE', 'BSE', 'MCX', 'SEBI']

const CircularsPage: React.FC = () => {
  const [activeExchange, setActiveExchange] = useState('All')
  const [search, setSearch] = useState('')

  const { data: apiData, isLoading } = useQuery({
    queryKey: ['circulars'],
    queryFn: async () => {
      try {
        const res = await knowledgeApi.getCirculars()
        const raw: Record<string, unknown>[] = res.data?.items ?? res.data ?? []
        if (!raw.length) return null
        // Map API field names → Circular interface field names
        return raw.map((c, i): Circular => ({
          id: String(c.id ?? i),
          // API returns "issued_by" for exchange name
          exchange: String(c.exchange ?? c.issued_by ?? 'NSE').toUpperCase() as Circular['exchange'],
          // API returns "circular_number" for circular number
          circular_no: String(c.circular_no ?? c.circular_number ?? ''),
          date: String(c.date ?? c.issued_date ?? ''),
          subject: String(c.subject ?? c.title ?? ''),
          // API returns "summary" for body text
          body: String(c.body ?? c.summary ?? c.full_content ?? ''),
        }))
      } catch {
        return null
      }
    },
  })

  const circulars: Circular[] = apiData ?? MOCK_CIRCULARS

  const filtered = useMemo(() => {
    return circulars.filter((c) => {
      const matchExchange = activeExchange === 'All' || c.exchange.toUpperCase() === activeExchange
      const q = search.toLowerCase()
      const matchSearch =
        !search ||
        c.subject.toLowerCase().includes(q) ||
        c.circular_no.toLowerCase().includes(q) ||
        c.body.toLowerCase().includes(q)
      return matchExchange && matchSearch
    })
  }, [circulars, activeExchange, search])

  // Stats per exchange
  const exchangeStats = useMemo(() => {
    return EXCHANGE_TABS.slice(1).map((ex) => ({
      exchange: ex,
      count: circulars.filter((c) => c.exchange.toUpperCase() === ex).length,
    }))
  }, [circulars])

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Exchange Circulars"
        subtitle="NSE, BSE, MCX regulatory notices and compliance updates"
      />

      {/* Stats bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="grid grid-cols-2 sm:grid-cols-5 gap-3"
      >
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold tabular-nums text-foreground">{circulars.length}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        {exchangeStats.map((es) => {
          const cfg = getExchangeConfig(es.exchange)
          return (
            <Card key={es.exchange}>
              <CardContent className="p-3 text-center">
                <p className={cn('text-xl font-bold tabular-nums', cfg.text)}>{es.count}</p>
                <p className="text-xs text-muted-foreground">{es.exchange}</p>
              </CardContent>
            </Card>
          )
        })}
      </motion.div>

      {/* Filter tabs + search */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25, delay: 0.1 }}
        className="flex flex-wrap gap-2 items-center"
      >
        {/* Exchange tabs */}
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {EXCHANGE_TABS.map((ex) => {
            const cfg = ex !== 'All' ? getExchangeConfig(ex) : null
            return (
              <button
                key={ex}
                onClick={() => setActiveExchange(ex)}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium transition-all flex items-center gap-1.5',
                  activeExchange === ex
                    ? 'bg-background text-foreground shadow'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {cfg && (
                  <span className={cn('inline-block h-2 w-2 rounded-full', cfg.bg, cfg.text, 'opacity-80')} />
                )}
                {ex}
                {ex !== 'All' && (
                  <span className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                    activeExchange === ex ? 'bg-primary/10 text-primary' : 'bg-muted-foreground/10'
                  )}>
                    {circulars.filter((c) => c.exchange.toUpperCase() === ex).length}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Search bar */}
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by subject or circular number..."
            className="pl-8 h-9 text-sm"
          />
        </div>
        {search && (
          <Button variant="ghost" size="sm" className="h-9 gap-1 text-xs" onClick={() => setSearch('')}>
            <X className="h-3 w-3" /> Clear
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground hidden sm:block">
          {filtered.length} circular{filtered.length !== 1 ? 's' : ''}
        </span>
      </motion.div>

      {/* Circular cards */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FileText />}
          title="No circulars found"
          description="Try adjusting the exchange filter or search query."
          action={{ label: 'Show all', onClick: () => { setActiveExchange('All'); setSearch('') } }}
          compact
        />
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {filtered.map((c, idx) => (
              <CircularCard
                key={c.id ?? c.circular_no}
                circular={c}
                index={idx}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

export default CircularsPage
