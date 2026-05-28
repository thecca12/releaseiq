import React, { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  Globe, Search, FileText, Calendar, HardDrive,
  ExternalLink, ChevronDown, ChevronUp, RefreshCcw, X,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { cn } from '@/utils/cn'
import { knowledgeApi } from '@/services/api'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Circular {
  id: string
  filename: string
  exchange: string
  circular_no: string
  date: string
  subject: string
  body: string
  num_pages: number
  file_size_kb: number
  file_type: string
  // legacy fields
  issued_by?: string
  title?: string
  summary?: string
}

// ─── Exchange config ───────────────────────────────────────────────────────────

const EXCHANGE_CONFIG: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  NSE:  { bg: 'bg-blue-100 dark:bg-blue-950/40',   text: 'text-blue-700 dark:text-blue-400',   border: 'border-blue-200 dark:border-blue-800/60', dot: 'bg-blue-500' },
  BSE:  { bg: 'bg-orange-100 dark:bg-orange-950/40', text: 'text-orange-700 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800/60', dot: 'bg-orange-500' },
  MCX:  { bg: 'bg-emerald-100 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800/60', dot: 'bg-emerald-500' },
  SEBI: { bg: 'bg-red-100 dark:bg-red-950/40',      text: 'text-red-700 dark:text-red-400',     border: 'border-red-200 dark:border-red-800/60', dot: 'bg-red-500' },
}

const getExchangeConfig = (exchange: string) =>
  EXCHANGE_CONFIG[exchange?.toUpperCase()] ?? {
    bg: 'bg-slate-100 dark:bg-slate-800/40', text: 'text-slate-700 dark:text-slate-400',
    border: 'border-slate-200 dark:border-slate-700', dot: 'bg-slate-500',
  }

// ─── Circular card ─────────────────────────────────────────────────────────────

const CircularCard: React.FC<{ circular: Circular; index: number }> = ({ circular, index }) => {
  const [expanded, setExpanded] = useState(false)
  const cfg = getExchangeConfig(circular.exchange || circular.issued_by || '')
  const exchange = circular.exchange || circular.issued_by || 'EXCHANGE'

  // Pick best title
  const subject = circular.subject || circular.title || circular.filename || 'Exchange Circular'
  const circularNo = circular.circular_no || circular.id || ''
  const date = circular.date || ''
  const body = circular.body || circular.summary || ''
  const sizeKb = circular.file_size_kb || 0
  const pages = circular.num_pages || 0
  const fileType = (circular.file_type || 'pdf').toUpperCase()

  // Clean body for display — remove artifact lines
  const bodyLines = body.split('\n').filter(l => l.trim().length > 4)
  const previewText = bodyLines.slice(0, 5).join('\n')
  const fullText = bodyLines.join('\n')

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card className={cn('hover:shadow-md transition-all border', cfg.border)}>
        <CardContent className="p-0">
          {/* Header */}
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              {/* Left: icon + content */}
              <div className="flex items-start gap-3 min-w-0 flex-1">
                {/* Exchange badge block */}
                <div className={cn('flex flex-col items-center justify-center rounded-xl px-2.5 py-2 flex-shrink-0 min-w-[52px] border', cfg.bg, cfg.border)}>
                  <span className={cn('text-[10px] font-black tracking-widest', cfg.text)}>{exchange}</span>
                  <span className={cn('mt-0.5 text-[9px] font-medium uppercase', cfg.text)}>{fileType}</span>
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  {/* Subject */}
                  <h3 className="text-sm font-semibold text-foreground leading-snug mb-1.5 line-clamp-2">
                    {subject}
                  </h3>

                  {/* Meta row */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {circularNo && (
                      <span className="flex items-center gap-1 font-mono font-medium text-primary">
                        #{circularNo}
                      </span>
                    )}
                    {date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {date}
                      </span>
                    )}
                    {sizeKb > 0 && (
                      <span className="flex items-center gap-1">
                        <HardDrive className="h-3 w-3" />
                        {sizeKb > 1024 ? `${(sizeKb/1024).toFixed(1)} MB` : `${sizeKb} KB`}
                      </span>
                    )}
                    {pages > 0 && (
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {pages} page{pages !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => setExpanded(v => !v)}
                  className="p-1.5 rounded-lg hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
                  title={expanded ? 'Collapse' : 'Read content'}
                >
                  {expanded
                    ? <ChevronUp className="h-4 w-4" />
                    : <ChevronDown className="h-4 w-4" />
                  }
                </button>
              </div>
            </div>

            {/* Body preview (collapsed) */}
            {!expanded && previewText && (
              <div className="mt-3 pl-[64px]">
                <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                  {previewText}
                </p>
                <button
                  onClick={() => setExpanded(true)}
                  className="text-[11px] text-primary hover:underline mt-1"
                >
                  Read more
                </button>
              </div>
            )}
          </div>

          {/* Expanded body */}
          {expanded && fullText && (
            <div className={cn('mx-4 mb-4 rounded-xl border p-4', cfg.bg, cfg.border)}>
              <div className="flex items-center justify-between mb-2">
                <span className={cn('text-[10px] font-semibold uppercase tracking-wide', cfg.text)}>
                  Circular Content
                </span>
                <button onClick={() => setExpanded(false)} className="text-muted-foreground hover:text-foreground">
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto">
                <pre className="text-xs text-foreground/80 whitespace-pre-wrap font-sans leading-relaxed">
                  {fullText}
                </pre>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

const EXCHANGE_TABS = ['All', 'NSE', 'BSE', 'MCX', 'SEBI']

const CircularsPage: React.FC = () => {
  const [activeExchange, setActiveExchange] = useState('All')
  const [search, setSearch] = useState('')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['circulars'],
    queryFn: async () => {
      try {
        const res = await knowledgeApi.getCirculars()
        const raw = (res.data?.items ?? res.data ?? []) as Record<string, unknown>[]
        if (!raw.length) return []
        // Map API fields → Circular interface (handles both old and new field names)
        return raw.map((c): Circular => ({
          id:           String(c.id ?? ''),
          filename:     String(c.filename ?? ''),
          exchange:     String(c.exchange ?? c.issued_by ?? '').toUpperCase(),
          circular_no:  String(c.circular_no ?? c.circular_number ?? c.id ?? ''),
          date:         String(c.date ?? ''),
          subject:      String(c.subject ?? c.title ?? ''),
          body:         String(c.body ?? c.summary ?? ''),
          num_pages:    Number(c.num_pages ?? 0),
          file_size_kb: Number(c.file_size_kb ?? 0),
          file_type:    String(c.file_type ?? 'pdf'),
        }))
      } catch {
        return []
      }
    },
  })

  const circulars: Circular[] = data ?? []

  // Count per exchange
  const exchangeCounts = useMemo(() => {
    const counts: Record<string, number> = { All: circulars.length }
    circulars.forEach(c => {
      const ex = c.exchange || 'OTHER'
      counts[ex] = (counts[ex] || 0) + 1
    })
    return counts
  }, [circulars])

  const filtered = useMemo(() => {
    let items = circulars
    if (activeExchange !== 'All') {
      items = items.filter(c => c.exchange === activeExchange)
    }
    if (search) {
      const q = search.toLowerCase()
      items = items.filter(c =>
        c.subject?.toLowerCase().includes(q) ||
        c.circular_no?.toLowerCase().includes(q) ||
        c.body?.toLowerCase().includes(q) ||
        c.exchange?.toLowerCase().includes(q)
      )
    }
    return items
  }, [circulars, activeExchange, search])

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Exchange Circulars"
        subtitle="NSE, BSE, MCX & SEBI regulatory circulars and compliance notices"
        actions={
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refetch()}>
            <RefreshCcw className="h-3.5 w-3.5" /> Refresh
          </Button>
        }
      />

      {/* Stats row */}
      {!isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Total', value: circulars.length, color: 'text-foreground' },
            { label: 'NSE',   value: exchangeCounts.NSE  || 0, color: 'text-blue-600' },
            { label: 'BSE',   value: exchangeCounts.BSE  || 0, color: 'text-orange-600' },
            { label: 'MCX',   value: exchangeCounts.MCX  || 0, color: 'text-emerald-600' },
            { label: 'SEBI',  value: exchangeCounts.SEBI || 0, color: 'text-red-600' },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="p-4 text-center">
                <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Exchange tabs */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {EXCHANGE_TABS.map(ex => {
            const count = exchangeCounts[ex] ?? 0
            const cfg = ex === 'All' ? null : getExchangeConfig(ex)
            return (
              <button
                key={ex}
                onClick={() => setActiveExchange(ex)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-all',
                  activeExchange === ex
                    ? cfg
                      ? cn(cfg.bg, cfg.text, cfg.border, 'shadow-sm')
                      : 'bg-primary/10 text-primary border-primary/30'
                    : 'bg-background text-muted-foreground border-border hover:bg-muted/50'
                )}
              >
                {cfg && (
                  <span className={cn('h-2 w-2 rounded-full flex-shrink-0', cfg.dot)} />
                )}
                {ex}
                {(count > 0 || ex === 'All') && (
                  <span className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                    activeExchange === ex ? 'bg-white/30' : 'bg-muted text-muted-foreground'
                  )}>
                    {ex === 'All' ? circulars.length : count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-md sm:ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by subject or circular number..."
            className="pl-8 h-9 text-xs"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Count info */}
      {!isLoading && (
        <p className="text-xs text-muted-foreground">
          Showing <span className="font-medium text-foreground">{filtered.length}</span> circular{filtered.length !== 1 ? 's' : ''}
          {activeExchange !== 'All' && <> from <span className="font-medium text-foreground">{activeExchange}</span></>}
        </p>
      )}

      {/* Circular cards */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Globe className="h-10 w-10" />}
          title="No circulars found"
          description={search ? 'Try a different search term' : 'No circulars available for this exchange'}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((c, i) => (
            <CircularCard key={c.id} circular={c} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}

export default CircularsPage
