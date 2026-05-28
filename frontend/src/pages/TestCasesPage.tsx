import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  TestTube2, Search, X, ChevronDown, ChevronRight,
  User, Eye, RefreshCcw, Download,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { cn } from '@/utils/cn'
import { knowledgeApi } from '@/services/api'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface TestCase {
  test_id: string
  test_name: string
  module: string
  sub_module?: string
  sheet?: string
  tester?: string
  type: string
  steps?: string
  created_by?: string
  reviewed_by?: string
  expected_result?: string
  status: string
  priority: string
  automation: string
}

// ─── Row component ─────────────────────────────────────────────────────────────

const TestCaseRow: React.FC<{ tc: TestCase; index: number }> = ({ tc, index }) => {
  const [expanded, setExpanded] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.015 }}
      className="border-b border-border last:border-0"
    >
      {/* Main row */}
      <div
        className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Expand icon */}
        <span className="mt-0.5 text-muted-foreground flex-shrink-0">
          {expanded
            ? <ChevronDown className="h-3.5 w-3.5" />
            : <ChevronRight className="h-3.5 w-3.5" />
          }
        </span>

        {/* ID */}
        <span className="w-28 flex-shrink-0 text-xs font-mono text-primary truncate" title={tc.test_id}>
          {tc.test_id}
        </span>

        {/* Description */}
        <span className="flex-1 text-sm text-foreground leading-snug min-w-0 truncate" title={tc.test_name}>
          {tc.test_name}
        </span>

        {/* Sub-module */}
        <span className="w-32 flex-shrink-0 text-xs text-muted-foreground truncate hidden md:block" title={tc.sub_module}>
          {tc.sub_module || tc.module}
        </span>

        {/* Tester */}
        {tc.tester && (
          <span className="w-28 flex-shrink-0 text-xs text-muted-foreground truncate hidden lg:flex items-center gap-1">
            <User className="h-3 w-3" />
            {tc.tester}
          </span>
        )}

        {/* Reviewed by */}
        {tc.reviewed_by && (
          <span className="w-24 flex-shrink-0 text-xs text-muted-foreground truncate hidden xl:flex items-center gap-1">
            <Eye className="h-3 w-3" />
            {tc.reviewed_by}
          </span>
        )}

        {/* Type badge */}
        <span className="flex-shrink-0">
          <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
            {tc.type || 'Functional'}
          </Badge>
        </span>
      </div>

      {/* Expanded detail */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="bg-muted/20 px-4 py-3 ml-7 border-l-2 border-primary/30 space-y-2">
              {tc.steps && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    Test Steps
                  </p>
                  <pre className="text-xs text-foreground/80 whitespace-pre-wrap font-sans leading-relaxed bg-background rounded-md p-3 border border-border">
                    {tc.steps}
                  </pre>
                </div>
              )}
              {tc.expected_result && tc.expected_result !== 'Pass' && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    Expected Result
                  </p>
                  <p className="text-xs text-foreground/80 bg-background rounded-md p-2 border border-border">
                    {tc.expected_result}
                  </p>
                </div>
              )}
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                {tc.created_by && <span><strong>Created by:</strong> {tc.created_by}</span>}
                {tc.reviewed_by && <span><strong>Reviewed by:</strong> {tc.reviewed_by}</span>}
                {tc.sheet && <span><strong>Sheet:</strong> {tc.sheet}</span>}
                {tc.tester && <span><strong>Tester:</strong> {tc.tester}</span>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

const TestCasesPage: React.FC = () => {
  const [search, setSearch] = useState('')
  const [activeModule, setActiveModule] = useState('All')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 50

  // Fetch all test cases from real datasource
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['test-cases'],
    queryFn: async () => {
      try {
        const res = await knowledgeApi.getTestCases({ page_size: 3000 })
        const items = res.data?.items ?? res.data ?? []
        return Array.isArray(items) && items.length > 0 ? items as TestCase[] : []
      } catch {
        return [] as TestCase[]
      }
    },
  })

  const allCases: TestCase[] = data ?? []

  // Build sorted module list from real data
  const modules = useMemo(() => {
    const counts: Record<string, number> = {}
    allCases.forEach((c) => {
      const mod = c.module || 'General'
      counts[mod] = (counts[mod] || 0) + 1
    })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }))
  }, [allCases])

  // Filter by module + search
  const filtered = useMemo(() => {
    let items = allCases
    if (activeModule !== 'All') {
      items = items.filter((c) => c.module === activeModule)
    }
    if (search) {
      const q = search.toLowerCase()
      items = items.filter((c) =>
        c.test_name?.toLowerCase().includes(q) ||
        c.test_id?.toLowerCase().includes(q) ||
        c.module?.toLowerCase().includes(q) ||
        c.sub_module?.toLowerCase().includes(q) ||
        c.steps?.toLowerCase().includes(q) ||
        c.tester?.toLowerCase().includes(q)
      )
    }
    return items
  }, [allCases, activeModule, search])

  // Pagination
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleModuleChange = (mod: string) => {
    setActiveModule(mod)
    setPage(1)
  }

  const handleSearch = (val: string) => {
    setSearch(val)
    setPage(1)
  }

  // Stats
  const totalCases = allCases.length
  const totalModules = modules.length

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Test Cases"
        subtitle={`${totalCases.toLocaleString()} test cases across ${totalModules} modules — from Ajay_Team_Test_Cases_.xlsx`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refetch()}>
              <RefreshCcw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </div>
        }
      />

      {/* Stats row */}
      {!isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Cases',   value: totalCases.toLocaleString(),    color: 'text-primary' },
            { label: 'Modules',       value: totalModules.toString(),         color: 'text-blue-600' },
            { label: 'Showing',       value: filtered.length.toLocaleString(), color: 'text-emerald-600' },
            { label: 'Active Module', value: activeModule === 'All' ? 'All' : activeModule.slice(0,16), color: 'text-amber-600' },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={cn('text-xl font-bold', s.color)}>{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Main content */}
      <div className="flex gap-4 h-[calc(100vh-340px)] min-h-[400px]">

        {/* Left: module list */}
        <Card className="w-56 flex-shrink-0 flex flex-col overflow-hidden">
          <CardHeader className="py-3 px-3 border-b border-border flex-shrink-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Modules ({totalModules})
            </CardTitle>
          </CardHeader>
          <ScrollArea className="flex-1">
            <div className="p-1.5 space-y-0.5">
              {/* All modules button */}
              <button
                onClick={() => handleModuleChange('All')}
                className={cn(
                  'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                  activeModule === 'All'
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                )}
              >
                <span>All Modules</span>
                <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                  activeModule === 'All' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                )}>
                  {totalCases}
                </span>
              </button>

              {/* Per-module buttons */}
              {isLoading
                ? Array.from({ length: 12 }).map((_, i) => (
                    <Skeleton key={i} className="h-7 w-full rounded-lg" />
                  ))
                : modules.map(({ name, count }) => (
                    <button
                      key={name}
                      onClick={() => handleModuleChange(name)}
                      className={cn(
                        'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all',
                        activeModule === name
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                      )}
                    >
                      <span className="truncate flex-1 text-left" title={name}>{name}</span>
                      <span className={cn('ml-1 rounded-full px-1.5 py-0.5 text-[10px] flex-shrink-0',
                        activeModule === name ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                      )}>
                        {count}
                      </span>
                    </button>
                  ))
              }
            </div>
          </ScrollArea>
        </Card>

        {/* Right: test cases table */}
        <Card className="flex-1 flex flex-col overflow-hidden">
          {/* Search bar */}
          <div className="px-4 py-2.5 border-b border-border flex-shrink-0 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search test cases, steps, tester..."
                className="pl-8 h-8 text-xs"
              />
              {search && (
                <button onClick={() => handleSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
            <span className="text-xs text-muted-foreground flex-shrink-0 whitespace-nowrap">
              {filtered.length.toLocaleString()} cases
            </span>
          </div>

          {/* Column headers */}
          <div className="flex items-center gap-3 px-4 py-2 bg-muted/30 border-b border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex-shrink-0">
            <span className="w-4 flex-shrink-0" />
            <span className="w-28 flex-shrink-0">ID</span>
            <span className="flex-1">Description</span>
            <span className="w-32 flex-shrink-0 hidden md:block">Sub Module</span>
            <span className="w-28 flex-shrink-0 hidden lg:block">Tester</span>
            <span className="w-24 flex-shrink-0 hidden xl:block">Reviewed By</span>
            <span className="w-20 flex-shrink-0">Type</span>
          </div>

          {/* Test case rows */}
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : paged.length === 0 ? (
              <EmptyState
                icon={<TestTube2 className="h-10 w-10" />}
                title="No test cases found"
                description={search ? 'Try a different search term' : 'Select a module from the left panel'}
              />
            ) : (
              <div>
                {paged.map((tc, i) => (
                  <TestCaseRow key={`${tc.test_id}-${i}`} tc={tc} index={i} />
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Pagination footer */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-2 border-t border-border flex-shrink-0">
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages} · {filtered.length} total
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline" size="sm" className="h-7 px-2 text-xs"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Prev
                </Button>
                {/* Page number pills */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = Math.max(1, Math.min(page - 2 + i, totalPages - 4 + i))
                  return (
                    <Button
                      key={pageNum}
                      variant={pageNum === page ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 w-7 text-xs p-0"
                      onClick={() => setPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  )
                })}
                <Button
                  variant="outline" size="sm" className="h-7 px-2 text-xs"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

export default TestCasesPage
