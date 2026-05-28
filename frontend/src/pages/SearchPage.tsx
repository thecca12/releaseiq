import React, { useState, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  FileText,
  Terminal,
  GitBranch,
  BookOpen,
  Mail,
  Video,
  Clock,
  ExternalLink,
  Brain,
  X,
  Sparkles,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { cn } from '@/utils/cn'
import type { SearchResult } from '@/types'
import { searchApi } from '@/services/api'

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_RESULTS: SearchResult[] = [
  {
    id: 'j1', type: 'jira', title: 'JIRA-1039: FIX session drops under load',
    snippet: 'QuickFIX/J 2.3.1 work-stealing thread pool caused TCP session drops during peak order volume (>15k/min). Reverted to 2.2.0 in v9.47.1.',
    relevance_score: 0.97,
    metadata: { module: 'FIX', priority: 'High', status: 'In Progress', version: 'v9.47' },
  },
  {
    id: 'j2', type: 'jira', title: 'JIRA-1042: Order rejection in RMS v9.47',
    snippet: 'NPE in RiskManager.validateModification() when SKIP_RISK_ON_MODIFY flag is set. Fix available in v9.47.1.',
    relevance_score: 0.94,
    metadata: { module: 'RMS', priority: 'Critical', status: 'Open', version: 'v9.47' },
  },
  {
    id: 'l1', type: 'log', title: 'fix_engine_20250528.log — Session DROP events',
    snippet: '[09:32:11.445] WARN QuickFIXJ - Session DROP: SENDERCOMPID=KOTAK heartbeat timeout after 30s. Reconnection failed: max_retries=3 exceeded.',
    relevance_score: 0.91,
    metadata: { module: 'FIX', date: '2025-05-28', errors: '14', client: 'Kotak' },
  },
  {
    id: 'r1', type: 'release', title: 'Release v9.47.1 — Patch Notes',
    snippet: 'Fixed NPE in RiskManager.validateModification (JIRA-1042). Reverted FIX engine to QuickFIX/J 2.2.0 (JIRA-1039 partially fixed). OMS memory leak deferred to v9.48.',
    relevance_score: 0.89,
    metadata: { version: 'v9.47.1', date: '2025-05-20', type: 'QA Patch' },
  },
  {
    id: 'd1', type: 'document', title: 'RCA_JIRA1039_FIX_Session.docx',
    snippet: 'Root cause: Thread pool executor (work-stealing) in QuickFIX/J 2.3.1 caused non-deterministic session scheduling under high load. Resolution: Revert + adaptive config.',
    relevance_score: 0.88,
    metadata: { type: 'DOCX', pages: '8', uploaded: '2025-05-19' },
  },
  {
    id: 'l2', type: 'log', title: 'rms_error_20250519.log — NPE stack trace',
    snippet: 'java.lang.NullPointerException at com.greeksoft.rms.RiskManager.validateModification(RiskManager.java:342). Called from OrderProcessor.processModify().',
    relevance_score: 0.86,
    metadata: { module: 'RMS', date: '2025-05-19', errors: '3' },
  },
  {
    id: 'e1', type: 'email', title: 'URGENT: FIX Session Drop on NSE — JIRA-1039',
    snippet: 'We are observing frequent FIX session drops on our NSE trading gateway since upgrading to v9.47 yesterday... P1 escalation from Kotak Securities.',
    relevance_score: 0.84,
    metadata: { from: 'kotak-it@kotak.com', type: 'Escalation', date: '2025-05-28' },
  },
  {
    id: 'm1', type: 'meeting', title: 'JIRA-1039 FIX Session Drop — RCA Meeting',
    snippet: 'Root cause identified: QuickFIX/J 2.3.1 work-stealing thread pool caused session drops under high load. Action: Revert to 2.2.0, add adaptive thread pool config.',
    relevance_score: 0.82,
    metadata: { date: '2025-05-27', duration: '90 min', status: 'Completed' },
  },
]

const RECENT_SEARCHES = ['FIX session drop', 'JIRA-1039', 'OMS memory leak', 'v9.48 release notes', 'NSE circular 2025']

const SAMPLE_QUERIES = [
  'What caused the FIX session drops in v9.47?',
  'Show all critical issues in RMS module',
  'List clients upgraded to v9.48',
  'What is the resolution for JIRA-1042?',
  'Compare v9.47 and v9.48 health scores',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SOURCE_CONFIG: Record<SearchResult['type'], { label: string; icon: React.ReactNode; bg: string; text: string }> = {
  jira: { label: 'Jira', icon: <FileText className="h-3.5 w-3.5" />, bg: 'bg-blue-100 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-400' },
  log: { label: 'Logs', icon: <Terminal className="h-3.5 w-3.5" />, bg: 'bg-slate-100 dark:bg-slate-800/60', text: 'text-slate-600 dark:text-slate-400' },
  release: { label: 'Release', icon: <GitBranch className="h-3.5 w-3.5" />, bg: 'bg-emerald-100 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-400' },
  document: { label: 'Document', icon: <BookOpen className="h-3.5 w-3.5" />, bg: 'bg-purple-100 dark:bg-purple-950/40', text: 'text-purple-700 dark:text-purple-400' },
  email: { label: 'Email', icon: <Mail className="h-3.5 w-3.5" />, bg: 'bg-amber-100 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-400' },
  meeting: { label: 'Meeting', icon: <Video className="h-3.5 w-3.5" />, bg: 'bg-indigo-100 dark:bg-indigo-950/40', text: 'text-indigo-700 dark:text-indigo-400' },
}

type SourceFilter = 'all' | SearchResult['type']

// ─── Result Item ──────────────────────────────────────────────────────────────

const ResultItem: React.FC<{ result: SearchResult; index: number }> = ({ result, index }) => {
  const cfg = SOURCE_CONFIG[result.type]
  const scorePercent = Math.round(result.relevance_score * 100)
  const scoreColor = scorePercent >= 90 ? 'text-emerald-600 dark:text-emerald-400' : scorePercent >= 75 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.04 }}
    >
      <Card className="hover:shadow-md transition-shadow group">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className={cn('flex-shrink-0 rounded-lg p-2', cfg.bg)}>
              <span className={cfg.text}>{cfg.icon}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-foreground truncate">{result.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{result.snippet}</p>
                </div>
                <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                  <span className={cn('text-xs font-semibold tabular-nums', scoreColor)}>{scorePercent}%</span>
                  <span className="text-[9px] text-muted-foreground">relevance</span>
                </div>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', cfg.bg, cfg.text)}>
                  {cfg.icon} {cfg.label}
                </span>
                {Object.entries(result.metadata).map(([k, v]) => (
                  <span key={k} className="text-[10px] text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5">
                    <span className="font-medium text-foreground/70">{k}:</span> {v}
                  </span>
                ))}
                <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5">
                  <Button variant="ghost" size="sm" className="h-6 gap-1 text-[10px]">
                    <Brain className="h-3 w-3" /> Ask AI
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

// ─── Type mapping helpers ─────────────────────────────────────────────────────

type ApiResultType = 'jira' | 'log' | 'release' | 'document' | 'email' | 'meeting' | 'patch_note' | 'error_code'

function normalizeResultType(t: string): SearchResult['type'] {
  const map: Record<string, SearchResult['type']> = {
    jira: 'jira', log: 'log', logs: 'log',
    release: 'release', releases: 'release',
    document: 'document', documents: 'document',
    email: 'email', emails: 'email',
    meeting: 'meeting', meetings: 'meeting',
    patch_note: 'document', patch_notes: 'document',
    error_code: 'document', error_codes: 'document',
  }
  return map[t] ?? 'document'
}

function apiResultToSearchResult(item: Record<string, unknown>, idx: number): SearchResult {
  return {
    id: String(item.id ?? item.url ?? `result-${idx}`),
    type: normalizeResultType(String(item.type ?? 'document')),
    title: String(item.title ?? ''),
    snippet: String(item.snippet ?? item.description ?? ''),
    relevance_score: Number(item.relevance_score ?? item.score ?? 0.5),
    metadata: (item.metadata ?? {}) as Record<string, string>,
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const SearchPage: React.FC = () => {
  const [query, setQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [hasSearched, setHasSearched] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [groupByType, setGroupByType] = useState(false)
  const [apiResults, setApiResults] = useState<SearchResult[]>([])
  const [recentSearches, setRecentSearches] = useState<string[]>(RECENT_SEARCHES)
  const abortRef = useRef<AbortController | null>(null)

  const handleSearch = useCallback(async (q?: string) => {
    const searchQuery = (q ?? query).trim()
    if (!searchQuery) return

    setSubmittedQuery(searchQuery)
    setQuery(searchQuery)
    setIsSearching(true)
    setHasSearched(false)
    setApiResults([])

    // Track recent searches
    setRecentSearches((prev) => {
      const updated = [searchQuery, ...prev.filter((s) => s !== searchQuery)].slice(0, 8)
      return updated
    })

    // Cancel any in-flight request
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()

    try {
      const res = await searchApi.global(searchQuery)
      const data = res.data ?? {}
      const rawResults: Array<Record<string, unknown>> = data.results ?? []
      const mapped = rawResults.map((item, idx) => apiResultToSearchResult(item, idx))
      setApiResults(mapped.length ? mapped : MOCK_RESULTS)
    } catch {
      // On error, fall back to mock results so the UI always shows something
      setApiResults(MOCK_RESULTS)
    } finally {
      setIsSearching(false)
      setHasSearched(true)
    }
  }, [query])

  const results = useMemo(() => {
    if (!hasSearched) return []
    return apiResults.filter((r) => sourceFilter === 'all' || r.type === sourceFilter)
  }, [hasSearched, apiResults, sourceFilter])

  const grouped = useMemo(() => {
    if (!groupByType) return null
    const groups: Record<string, SearchResult[]> = {}
    results.forEach((r) => {
      if (!groups[r.type]) groups[r.type] = []
      groups[r.type].push(r)
    })
    return groups
  }, [results, groupByType])

  const SOURCES: SourceFilter[] = ['all', 'jira', 'log', 'release', 'document', 'email', 'meeting']

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Search"
        subtitle="Search across all indexed data — Jira issues, logs, releases, documents, emails, and meetings."
      />

      {/* Search input */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl"
      >
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search across Jira, logs, releases, documents, emails…"
            className="w-full h-12 pl-12 pr-24 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring shadow-sm"
          />
          {query && (
            <button className="absolute right-16 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => { setQuery(''); setHasSearched(false) }}>
              <X className="h-4 w-4" />
            </button>
          )}
          <Button size="sm" className="absolute right-2 top-1/2 -translate-y-1/2 h-8 px-3" onClick={() => handleSearch()}>
            Search
          </Button>
        </div>

        {/* Sample queries */}
        {!hasSearched && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {SAMPLE_QUERIES.map((q) => (
              <button
                key={q}
                onClick={() => handleSearch(q)}
                className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </motion.div>

      {/* Recent searches (only before first search) */}
      {!hasSearched && !isSearching && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Recent Searches</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSearch(s)}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:bg-muted/40 transition-colors"
                >
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  {s}
                </button>
              ))}
            </div>
          </div>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">AI-Powered Search</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Search understands natural language. Try asking "What broke in v9.47?" or "Show me all RMS errors from last week" — the AI will find relevant Jira issues, logs, documents, and releases.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Loading */}
      {isSearching && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 py-8">
          <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-sm text-muted-foreground">Searching across all sources…</span>
        </motion.div>
      )}

      {/* Results */}
      {hasSearched && !isSearching && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {/* Result controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{results.length}</span> results for{' '}
                <span className="font-medium text-foreground">"{submittedQuery}"</span>
              </p>
            </div>

            {/* Source filters */}
            <div className="flex flex-wrap gap-1.5">
              {SOURCES.map((s) => (
                <button
                  key={s}
                  onClick={() => setSourceFilter(s)}
                  className={cn(
                    'flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors capitalize',
                    sourceFilter === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
                  )}
                >
                  {s !== 'all' && <span className={SOURCE_CONFIG[s as SearchResult['type']].text}>{SOURCE_CONFIG[s as SearchResult['type']].icon}</span>}
                  {s === 'all' ? 'All' : SOURCE_CONFIG[s as SearchResult['type']].label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setGroupByType((v) => !v)}
              className={cn('text-xs px-2.5 py-1 rounded-full border border-border transition-colors', groupByType ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground')}
            >
              Group by type
            </button>
          </div>

          {results.length === 0 ? (
            <EmptyState icon={<Search />} title="No results found" description={`No matches for "${submittedQuery}" in the selected source.`} compact />
          ) : groupByType && grouped ? (
            Object.entries(grouped).map(([type, items]) => {
              const cfg = SOURCE_CONFIG[type as SearchResult['type']]
              return (
                <div key={type} className="space-y-2">
                  <div className={cn('flex items-center gap-2 px-1')}>
                    <span className={cn(cfg.text)}>{cfg.icon}</span>
                    <span className="text-xs font-semibold text-foreground uppercase tracking-wide">{cfg.label}</span>
                    <span className="text-xs text-muted-foreground">({items.length})</span>
                  </div>
                  <div className="space-y-2">
                    {items.map((r, i) => <ResultItem key={r.id} result={r} index={i} />)}
                  </div>
                </div>
              )
            })
          ) : (
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {results.map((r, i) => <ResultItem key={r.id} result={r} index={i} />)}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}

export default SearchPage
