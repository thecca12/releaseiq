import React, { useState, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  FileText,
  FileSpreadsheet,
  File,
  FileJson,
  FileCode,
  Upload,
  Search,
  RefreshCcw,
  Trash2,
  Download,
  Eye,
  RotateCcw,
  X,
  CheckCircle2,
  Clock,
  AlertCircle,
  CloudUpload,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { cn } from '@/utils/cn'
import { documentsApi } from '@/services/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Document {
  id: string
  filename: string
  type: 'pdf' | 'excel' | 'word' | 'log' | 'text' | 'json' | 'other'
  size_bytes: number
  uploaded_at: string
  indexed_status: 'indexed' | 'pending' | 'failed'
  pages?: number
  description?: string
}

// ─── Knowledge-base files that always exist in the datasource ────────────────

const KNOWLEDGE_FILES: Document[] = [
  {
    id: 'kb-1',
    filename: 'rms_user_guide.txt',
    type: 'text',
    size_bytes: 18 * 1024,
    uploaded_at: '2025-01-01T00:00:00Z',
    indexed_status: 'indexed',
    description: 'Complete RMS trading guide with FAQ',
  },
  {
    id: 'kb-2',
    filename: 'fix_protocol_guide.txt',
    type: 'text',
    size_bytes: 15 * 1024,
    uploaded_at: '2025-01-01T00:00:00Z',
    indexed_status: 'indexed',
    description: 'FIX tags, message types, and troubleshooting',
  },
]

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_DOCUMENTS: Document[] = [
  { id: '1', filename: 'ReleaseNotes_v9.48.pdf', type: 'pdf', size_bytes: 1_245_000, uploaded_at: '2025-05-22T10:30:00Z', indexed_status: 'indexed', pages: 12, description: 'Full release notes for v9.48' },
  { id: '2', filename: 'ClientMatrix_May2025.xlsx', type: 'excel', size_bytes: 892_000, uploaded_at: '2025-05-20T14:15:00Z', indexed_status: 'indexed', description: 'Client version matrix' },
  { id: '3', filename: 'RCA_JIRA1042_FIX_Session.docx', type: 'word', size_bytes: 354_000, uploaded_at: '2025-05-19T09:00:00Z', indexed_status: 'indexed', pages: 8, description: 'RCA for FIX session drop' },
  { id: '4', filename: 'server_error_2025-05-18.log', type: 'log', size_bytes: 5_672_000, uploaded_at: '2025-05-18T22:00:00Z', indexed_status: 'indexed', description: 'Server error log' },
  { id: '5', filename: 'api_config.json', type: 'json', size_bytes: 12_000, uploaded_at: '2025-05-17T11:45:00Z', indexed_status: 'indexed', description: 'API configuration file' },
  { id: '6', filename: 'TRADING_FLAGS_GUIDE.txt', type: 'text', size_bytes: 48_000, uploaded_at: '2025-05-16T08:30:00Z', indexed_status: 'indexed', description: 'Trading flags reference' },
  { id: '7', filename: 'NSE_Circular_Apr2025.pdf', type: 'pdf', size_bytes: 678_000, uploaded_at: '2025-05-15T16:00:00Z', indexed_status: 'indexed', pages: 5, description: 'NSE circular compliance document' },
  { id: '8', filename: 'PatchNotes_v9.47.1.docx', type: 'word', size_bytes: 218_000, uploaded_at: '2025-05-14T10:00:00Z', indexed_status: 'indexed', pages: 4, description: 'Patch notes for v9.47.1' },
  { id: '9', filename: 'performance_metrics_Q1.xlsx', type: 'excel', size_bytes: 1_890_000, uploaded_at: '2025-05-12T14:30:00Z', indexed_status: 'failed', description: 'Q1 performance metrics' },
  { id: '10', filename: 'rms_error_trace_20250511.log', type: 'log', size_bytes: 8_234_000, uploaded_at: '2025-05-11T03:00:00Z', indexed_status: 'pending', description: 'RMS error trace log' },
  { id: '11', filename: 'oms_config_prod.json', type: 'json', size_bytes: 34_000, uploaded_at: '2025-05-10T09:15:00Z', indexed_status: 'indexed', description: 'OMS production config' },
  { id: '12', filename: 'TestCases_v9.48_Regression.txt', type: 'text', size_bytes: 124_000, uploaded_at: '2025-05-09T13:00:00Z', indexed_status: 'indexed', description: 'Regression test cases' },
]

const TYPE_FILTERS = ['all', 'pdf', 'excel', 'word', 'log', 'text', 'json'] as const
type TypeFilter = typeof TYPE_FILTERS[number]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })
}

function getTypeIcon(type: Document['type'], className = 'h-5 w-5') {
  switch (type) {
    case 'pdf': return <FileText className={cn(className, 'text-red-500')} />
    case 'excel': return <FileSpreadsheet className={cn(className, 'text-emerald-600')} />
    case 'word': return <FileText className={cn(className, 'text-blue-600')} />
    case 'log': return <FileCode className={cn(className, 'text-slate-500')} />
    case 'json': return <FileJson className={cn(className, 'text-amber-500')} />
    case 'text': return <File className={cn(className, 'text-purple-500')} />
    default: return <File className={cn(className, 'text-muted-foreground')} />
  }
}

function getTypeLabel(type: Document['type']) {
  const map: Record<Document['type'], string> = { pdf: 'PDF', excel: 'Excel', word: 'Word', log: 'Log', text: 'Text', json: 'JSON', other: 'Other' }
  return map[type] ?? 'Other'
}

function getTypeBg(type: Document['type']) {
  const map: Record<Document['type'], string> = {
    pdf: 'bg-red-50 dark:bg-red-950/30',
    excel: 'bg-emerald-50 dark:bg-emerald-950/30',
    word: 'bg-blue-50 dark:bg-blue-950/30',
    log: 'bg-slate-50 dark:bg-slate-800/50',
    json: 'bg-amber-50 dark:bg-amber-950/30',
    text: 'bg-purple-50 dark:bg-purple-950/30',
    other: 'bg-muted/40',
  }
  return map[type] ?? 'bg-muted/40'
}

// ─── Upload Zone ──────────────────────────────────────────────────────────────

const UploadZone: React.FC<{ onUpload: (files: FileList) => void }> = ({ onUpload }) => {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length) onUpload(e.dataTransfer.files)
  }, [onUpload])

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer',
        isDragging
          ? 'border-primary bg-primary/5 scale-[1.01]'
          : 'border-border hover:border-primary/50 hover:bg-muted/30'
      )}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => e.target.files && onUpload(e.target.files)} />
      <div className="flex flex-col items-center justify-center gap-3 py-8 px-6">
        <div className={cn('rounded-2xl p-4 transition-colors', isDragging ? 'bg-primary/10' : 'bg-muted/60')}>
          <CloudUpload className={cn('h-8 w-8 transition-colors', isDragging ? 'text-primary' : 'text-muted-foreground')} />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">Drop files here or click to browse</p>
          <p className="text-xs text-muted-foreground mt-1">Supported: PDF, Excel, Word, Log, Text, JSON — up to 50 MB each</p>
        </div>
        <div className="flex flex-wrap justify-center gap-1.5 mt-1">
          {['PDF', 'XLSX', 'DOCX', 'LOG', 'TXT', 'JSON'].map((ext) => (
            <span key={ext} className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">{ext}</span>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Document Card ─────────────────────────────────────────────────────────────

interface DocCardProps {
  doc: Document
  index: number
  onDelete: (id: string) => void
  onReindex: (id: string) => void
}

const DocCard: React.FC<DocCardProps> = ({ doc, index, onDelete, onReindex }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, x: -20 }}
    transition={{ duration: 0.25, delay: index * 0.03 }}
  >
    <Card className="hover:shadow-md transition-shadow group">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn('flex-shrink-0 rounded-xl p-2.5', getTypeBg(doc.type))}>
            {getTypeIcon(doc.type, 'h-5 w-5')}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{doc.filename}</p>
                {doc.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{doc.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {doc.indexed_status === 'indexed' && (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 rounded-full px-2 py-0.5">
                    <CheckCircle2 className="h-3 w-3" /> Indexed
                  </span>
                )}
                {doc.indexed_status === 'pending' && (
                  <span className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 rounded-full px-2 py-0.5">
                    <Clock className="h-3 w-3" /> Pending
                  </span>
                )}
                {doc.indexed_status === 'failed' && (
                  <span className="flex items-center gap-1 text-[10px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 rounded-full px-2 py-0.5">
                    <AlertCircle className="h-3 w-3" /> Failed
                  </span>
                )}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium">{getTypeLabel(doc.type)}</span>
              <span>{formatBytes(doc.size_bytes)}</span>
              {doc.pages && <span>{doc.pages} pages</span>}
              <span>{formatDate(doc.uploaded_at)}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" title="View">
              <Eye className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Download">
              <Download className="h-3.5 w-3.5" />
            </Button>
            {doc.indexed_status !== 'indexed' && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600" title="Reindex" onClick={() => onReindex(doc.id)}>
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" title="Delete" onClick={() => onDelete(doc.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  </motion.div>
)

// ─── Page ─────────────────────────────────────────────────────────────────────

const DocumentsPage: React.FC = () => {
  const [localDocs, setLocalDocs] = useState<Document[]>([])
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [isReindexing, setIsReindexing] = useState(false)

  const { data: apiDocs, isLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: async () => {
      try {
        const res = await documentsApi.list()
        const items: Array<Record<string, unknown>> = res.data?.items ?? res.data ?? []
        if (!items.length) return null
        return items.map((item) => {
          const ext = String(item.filename ?? '').split('.').pop()?.toLowerCase() ?? ''
          const typeMap: Record<string, Document['type']> = {
            pdf: 'pdf', xlsx: 'excel', xls: 'excel',
            docx: 'word', doc: 'word', log: 'log',
            txt: 'text', json: 'json',
          }
          return {
            id: String(item.id ?? item.filename),
            filename: String(item.filename ?? ''),
            type: (typeMap[ext] ?? 'other') as Document['type'],
            size_bytes: Number(item.size_bytes ?? item.size ?? 0),
            uploaded_at: String(item.uploaded_at ?? item.created_at ?? new Date().toISOString()),
            indexed_status: (item.indexed_status ?? 'indexed') as Document['indexed_status'],
            pages: item.pages ? Number(item.pages) : undefined,
            description: item.description ? String(item.description) : undefined,
          } satisfies Document
        })
      } catch {
        return null
      }
    },
  })

  // Merge: API docs (or fallback mock) + knowledge files (deduped by id)
  const docs = useMemo<Document[]>(() => {
    const base: Document[] = apiDocs ?? MOCK_DOCUMENTS
    const existingIds = new Set(base.map((d) => d.id))
    const extra = KNOWLEDGE_FILES.filter((kf) => !existingIds.has(kf.id))
    const combined = [...extra, ...base]
    // Merge in any locally-uploaded docs
    const localIds = new Set(localDocs.map((d) => d.id))
    return [...localDocs, ...combined.filter((d) => !localIds.has(d.id))]
  }, [apiDocs, localDocs])

  const filtered = useMemo(() =>
    docs.filter((d) => {
      const matchSearch = !search || d.filename.toLowerCase().includes(search.toLowerCase()) || d.description?.toLowerCase().includes(search.toLowerCase())
      const matchType = typeFilter === 'all' || d.type === typeFilter
      return matchSearch && matchType
    }),
    [docs, search, typeFilter]
  )

  const handleUpload = useCallback((files: FileList) => {
    const newDocs: Document[] = Array.from(files).map((f, i) => {
      const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
      const typeMap: Record<string, Document['type']> = { pdf: 'pdf', xlsx: 'excel', xls: 'excel', docx: 'word', doc: 'word', log: 'log', txt: 'text', json: 'json' }
      return {
        id: `new-${Date.now()}-${i}`,
        filename: f.name,
        type: typeMap[ext] ?? 'other',
        size_bytes: f.size,
        uploaded_at: new Date().toISOString(),
        indexed_status: 'pending',
      }
    })
    setLocalDocs((prev) => [...newDocs, ...prev])
  }, [])

  const handleDelete = useCallback((id: string) => {
    setLocalDocs((prev) => prev.filter((d) => d.id !== id))
  }, [])

  const handleReindex = useCallback((id: string) => {
    setLocalDocs((prev) => prev.map((d) => d.id === id ? { ...d, indexed_status: 'pending' } : d))
    setTimeout(() => {
      setLocalDocs((prev) => prev.map((d) => d.id === id ? { ...d, indexed_status: 'indexed' } : d))
    }, 2000)
  }, [])

  const handleBulkReindex = useCallback(() => {
    setIsReindexing(true)
    setTimeout(() => {
      setIsReindexing(false)
    }, 2500)
  }, [])

  const stats = useMemo(() => ({
    total: docs.length,
    indexed: docs.filter((d) => d.indexed_status === 'indexed').length,
    pending: docs.filter((d) => d.indexed_status === 'pending').length,
    failed: docs.filter((d) => d.indexed_status === 'failed').length,
  }), [docs])

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Documents"
        subtitle="Upload and manage your knowledge base documents. All files are indexed for AI-powered search."
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleBulkReindex}
              disabled={isReindexing}
            >
              <RefreshCcw className={cn('h-3.5 w-3.5', isReindexing && 'animate-spin')} />
              {isReindexing ? 'Reindexing…' : 'Reindex All'}
            </Button>
          </div>
        }
      />

      {/* Stats row */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="grid grid-cols-4 gap-3"
      >
        {[
          { label: 'Total Documents', value: stats.total, color: 'text-foreground', bg: 'bg-muted/40' },
          { label: 'Indexed', value: stats.indexed, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/20' },
          { label: 'Pending', value: stats.pending, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/20' },
          { label: 'Failed', value: stats.failed, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/20' },
        ].map((s) => (
          <Card key={s.label} className="overflow-hidden">
            <CardContent className={cn('p-4 text-center', s.bg)}>
              <p className={cn('text-2xl font-bold tabular-nums', s.color)}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Upload zone */}
      <UploadZone onUpload={handleUpload} />

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="flex flex-wrap gap-2 items-center"
      >
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents..."
            className="pl-8 h-9 text-sm"
          />
          {search && (
            <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setSearch('')}>
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors capitalize',
                typeFilter === t
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              )}
            >
              {t === 'all' ? 'All' : t.toUpperCase()}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Count */}
      <p className="text-xs text-muted-foreground">
        {isLoading ? 'Loading…' : (
          <>Showing <span className="font-medium text-foreground">{filtered.length}</span> document{filtered.length !== 1 ? 's' : ''}</>
        )}
      </p>

      {/* Document list */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FileText />}
          title="No documents found"
          description="Try adjusting your search or filters, or upload new documents."
          compact
        />
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {filtered.map((doc, i) => (
              <DocCard key={doc.id} doc={doc} index={i} onDelete={handleDelete} onReindex={handleReindex} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

export default DocumentsPage
