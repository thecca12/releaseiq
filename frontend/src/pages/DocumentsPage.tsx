import React, { useState, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
  BookOpen,
  FolderOpen,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { cn } from '@/utils/cn'
import { documentsApi } from '@/services/api'

// ─── Types ────────────────────────────────────────────────────────────────────

type DocType = 'pdf' | 'excel' | 'word' | 'log' | 'text' | 'json' | 'csv' | 'markdown' | 'other'
type IndexStatus = 'indexed' | 'pending' | 'failed'

interface Document {
  id: string
  filename: string
  type: DocType
  size_bytes: number
  uploaded_at: string
  indexed_status: IndexStatus
  pages?: number
  description?: string
  source: 'knowledge' | 'uploaded'
}

const TYPE_FILTERS = ['all', 'pdf', 'excel', 'word', 'text', 'csv', 'markdown', 'json', 'log'] as const
type TypeFilter = typeof TYPE_FILTERS[number]

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EXT_TO_TYPE: Record<string, DocType> = {
  pdf: 'pdf',
  xlsx: 'excel', xls: 'excel',
  docx: 'word', doc: 'word',
  log: 'log',
  txt: 'text',
  json: 'json',
  csv: 'csv',
  md: 'markdown',
  yaml: 'text', yml: 'text', xml: 'text',
}

function extToType(filename: string): DocType {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return EXT_TO_TYPE[ext] ?? 'other'
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })
}

function getTypeIcon(type: DocType, className = 'h-5 w-5') {
  switch (type) {
    case 'pdf':      return <FileText className={cn(className, 'text-red-500')} />
    case 'excel':    return <FileSpreadsheet className={cn(className, 'text-emerald-600')} />
    case 'word':     return <FileText className={cn(className, 'text-blue-600')} />
    case 'log':      return <FileCode className={cn(className, 'text-slate-500')} />
    case 'json':     return <FileJson className={cn(className, 'text-amber-500')} />
    case 'csv':      return <FileSpreadsheet className={cn(className, 'text-teal-500')} />
    case 'markdown': return <FileText className={cn(className, 'text-indigo-500')} />
    case 'text':     return <File className={cn(className, 'text-purple-500')} />
    default:         return <File className={cn(className, 'text-muted-foreground')} />
  }
}

function getTypeBg(type: DocType) {
  const map: Record<DocType, string> = {
    pdf:      'bg-red-50 dark:bg-red-950/30',
    excel:    'bg-emerald-50 dark:bg-emerald-950/30',
    word:     'bg-blue-50 dark:bg-blue-950/30',
    log:      'bg-slate-50 dark:bg-slate-800/50',
    json:     'bg-amber-50 dark:bg-amber-950/30',
    csv:      'bg-teal-50 dark:bg-teal-950/30',
    markdown: 'bg-indigo-50 dark:bg-indigo-950/30',
    text:     'bg-purple-50 dark:bg-purple-950/30',
    other:    'bg-muted/40',
  }
  return map[type] ?? 'bg-muted/40'
}

function getTypeLabel(type: DocType) {
  const map: Record<DocType, string> = {
    pdf: 'PDF', excel: 'Excel', word: 'Word', log: 'Log',
    text: 'Text', json: 'JSON', csv: 'CSV', markdown: 'MD', other: 'File',
  }
  return map[type]
}

const IndexBadge: React.FC<{ status: IndexStatus }> = ({ status }) => {
  if (status === 'indexed') return (
    <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 rounded-full px-2 py-0.5 whitespace-nowrap">
      <CheckCircle2 className="h-3 w-3" /> Indexed
    </span>
  )
  if (status === 'pending') return (
    <span className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 rounded-full px-2 py-0.5 whitespace-nowrap">
      <Clock className="h-3 w-3" /> Pending
    </span>
  )
  return (
    <span className="flex items-center gap-1 text-[10px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 rounded-full px-2 py-0.5 whitespace-nowrap">
      <AlertCircle className="h-3 w-3" /> Failed
    </span>
  )
}

// ─── Upload Zone ──────────────────────────────────────────────────────────────

const UploadZone: React.FC<{ onUpload: (files: FileList) => void }> = ({ onUpload }) => {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer',
        isDragging ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border hover:border-primary/50 hover:bg-muted/30'
      )}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files.length) onUpload(e.dataTransfer.files) }}
      onClick={() => inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => e.target.files && onUpload(e.target.files)} />
      <div className="flex flex-col items-center justify-center gap-3 py-7 px-6">
        <div className={cn('rounded-2xl p-3.5 transition-colors', isDragging ? 'bg-primary/10' : 'bg-muted/60')}>
          <CloudUpload className={cn('h-7 w-7 transition-colors', isDragging ? 'text-primary' : 'text-muted-foreground')} />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">Drop files here or click to browse</p>
          <p className="text-xs text-muted-foreground mt-1">PDF, Excel, Word, Log, Text, JSON, CSV, Markdown — up to 50 MB each</p>
        </div>
        <div className="flex flex-wrap justify-center gap-1.5">
          {['PDF', 'XLSX', 'DOCX', 'LOG', 'TXT', 'JSON', 'CSV', 'MD'].map((ext) => (
            <span key={ext} className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">{ext}</span>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Document Row ─────────────────────────────────────────────────────────────

const DocRow: React.FC<{
  doc: Document
  index: number
  onDelete?: (id: string) => void
  onReindex?: (id: string) => void
}> = ({ doc, index, onDelete, onReindex }) => (
  <motion.div
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, x: -20 }}
    transition={{ duration: 0.2, delay: index * 0.02 }}
    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors group border-b border-border last:border-0"
  >
    <div className={cn('flex-shrink-0 rounded-lg p-2', getTypeBg(doc.type))}>
      {getTypeIcon(doc.type, 'h-4 w-4')}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-foreground truncate">{doc.filename}</p>
      {doc.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{doc.description}</p>}
      <div className="flex flex-wrap items-center gap-2 mt-1">
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{getTypeLabel(doc.type)}</span>
        <span className="text-[11px] text-muted-foreground">{formatBytes(doc.size_bytes)}</span>
        {doc.pages && <span className="text-[11px] text-muted-foreground">{doc.pages} pages</span>}
        <span className="text-[11px] text-muted-foreground">{formatDate(doc.uploaded_at)}</span>
      </div>
    </div>
    <div className="flex items-center gap-2 flex-shrink-0">
      <IndexBadge status={doc.indexed_status} />
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Preview"><Eye className="h-3.5 w-3.5" /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Download"><Download className="h-3.5 w-3.5" /></Button>
        {doc.indexed_status !== 'indexed' && onReindex && (
          <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600" title="Re-index" onClick={() => onReindex(doc.id)}>
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        )}
        {onDelete && (
          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" title="Delete" onClick={() => onDelete(doc.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  </motion.div>
)

// ─── Section header ───────────────────────────────────────────────────────────

const SectionHeader: React.FC<{ icon: React.ReactNode; title: string; count: number; subtitle: string }> = ({ icon, title, count, subtitle }) => (
  <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b border-border">
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-xs font-semibold text-foreground uppercase tracking-wide">{title}</span>
      <span className="rounded-full bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5 tabular-nums">{count}</span>
    </div>
    <span className="text-[10px] text-muted-foreground">{subtitle}</span>
  </div>
)

// ─── Page ─────────────────────────────────────────────────────────────────────

const DocumentsPage: React.FC = () => {
  const queryClient = useQueryClient()
  const [localDocs, setLocalDocs] = useState<Document[]>([])
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [isReindexing, setIsReindexing] = useState(false)

  // Fetch knowledge-base files from Product_knowledge folder
  const { data: kbData, isLoading: kbLoading } = useQuery({
    queryKey: ['documents-knowledge-base'],
    queryFn: async () => {
      const res = await documentsApi.knowledgeBase()
      const items: Array<Record<string, unknown>> = res.data?.items ?? []
      return items.map((item): Document => ({
        id: String(item.id),
        filename: String(item.filename),
        type: extToType(String(item.filename)),
        size_bytes: Number(item.size_bytes ?? 0),
        uploaded_at: String(item.modified_at ?? new Date().toISOString()),
        indexed_status: (item.indexed_status ?? 'indexed') as IndexStatus,
        description: item.description ? String(item.description) : undefined,
        source: 'knowledge',
      }))
    },
    staleTime: 2 * 60 * 1000,
  })

  // Fetch uploaded documents
  const { data: uploadedData } = useQuery({
    queryKey: ['documents-uploaded'],
    queryFn: async () => {
      try {
        const res = await documentsApi.list()
        const items: Array<Record<string, unknown>> = res.data?.items ?? []
        return items.map((item): Document => ({
          id: String(item.id ?? item.filename),
          filename: String(item.original_name ?? item.filename ?? ''),
          type: extToType(String(item.original_name ?? item.filename ?? '')),
          size_bytes: Number(item.size_bytes ?? 0),
          uploaded_at: String(item.created_at ?? new Date().toISOString()),
          indexed_status: (item.indexed ? 'indexed' : 'pending') as IndexStatus,
          description: item.description ? String(item.description) : undefined,
          source: 'uploaded',
        }))
      } catch {
        return []
      }
    },
    staleTime: 30_000,
  })

  const knowledgeDocs = kbData ?? []
  const uploadedDocs = [...localDocs, ...(uploadedData ?? [])]
  const allDocs = [...knowledgeDocs, ...uploadedDocs]

  const applyFilter = (docs: Document[]) =>
    docs.filter((d) => {
      const matchSearch = !search || d.filename.toLowerCase().includes(search.toLowerCase()) || d.description?.toLowerCase().includes(search.toLowerCase())
      const matchType = typeFilter === 'all' || d.type === typeFilter
      return matchSearch && matchType
    })

  const filteredKb = applyFilter(knowledgeDocs)
  const filteredUploaded = applyFilter(uploadedDocs)

  const stats = useMemo(() => ({
    total: allDocs.length,
    indexed: allDocs.filter((d) => d.indexed_status === 'indexed').length,
    pending: allDocs.filter((d) => d.indexed_status === 'pending').length,
    failed: allDocs.filter((d) => d.indexed_status === 'failed').length,
  }), [allDocs])

  const handleUpload = useCallback((files: FileList) => {
    const newDocs: Document[] = Array.from(files).map((f, i) => ({
      id: `new-${Date.now()}-${i}`,
      filename: f.name,
      type: extToType(f.name),
      size_bytes: f.size,
      uploaded_at: new Date().toISOString(),
      indexed_status: 'pending',
      source: 'uploaded',
    }))
    setLocalDocs((prev) => [...newDocs, ...prev])
    // Simulate indexing after 2s
    setTimeout(() => {
      setLocalDocs((prev) => prev.map((d) =>
        newDocs.some((n) => n.id === d.id) ? { ...d, indexed_status: 'indexed' } : d
      ))
    }, 2000)
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
      queryClient.invalidateQueries({ queryKey: ['documents-knowledge-base'] })
      queryClient.invalidateQueries({ queryKey: ['documents-uploaded'] })
      setIsReindexing(false)
    }, 2000)
  }, [queryClient])

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Documents"
        subtitle="Knowledge base files and uploaded documents — all indexed for AI-powered search."
        actions={
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleBulkReindex} disabled={isReindexing}>
            <RefreshCcw className={cn('h-3.5 w-3.5', isReindexing && 'animate-spin')} />
            {isReindexing ? 'Reindexing…' : 'Reindex All'}
          </Button>
        }
      />

      {/* Stats */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-4 gap-3">
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
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search documents…" className="pl-8 h-9 text-sm" />
          {search && <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setSearch('')}><X className="h-3.5 w-3.5" /></button>}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {TYPE_FILTERS.map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)} className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors capitalize',
              typeFilter === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
            )}>
              {t === 'all' ? 'All' : t.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing <span className="font-medium text-foreground">{filteredKb.length + filteredUploaded.length}</span> document{filteredKb.length + filteredUploaded.length !== 1 ? 's' : ''}
      </p>

      {/* Document lists */}
      <div className="space-y-4">
        {/* Knowledge Base section */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="overflow-hidden">
            <SectionHeader
              icon={<BookOpen className="h-3.5 w-3.5 text-indigo-500" />}
              title="Knowledge Base"
              count={filteredKb.length}
              subtitle="Datasource / Product_knowledge"
            />
            {kbLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
              </div>
            ) : filteredKb.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                {search || typeFilter !== 'all' ? 'No knowledge base files match the current filter.' : 'No files found in the knowledge base folder.'}
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {filteredKb.map((doc, i) => (
                  <DocRow key={doc.id} doc={doc} index={i} />
                ))}
              </AnimatePresence>
            )}
          </Card>
        </motion.div>

        {/* Uploaded documents section */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="overflow-hidden">
            <SectionHeader
              icon={<FolderOpen className="h-3.5 w-3.5 text-blue-500" />}
              title="Uploaded Documents"
              count={filteredUploaded.length}
              subtitle="Manually uploaded files"
            />
            {filteredUploaded.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                {search || typeFilter !== 'all' ? 'No uploaded files match the current filter.' : 'No files uploaded yet. Use the drop zone above to add documents.'}
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {filteredUploaded.map((doc, i) => (
                  <DocRow
                    key={doc.id}
                    doc={doc}
                    index={i}
                    onDelete={localDocs.some((l) => l.id === doc.id) ? handleDelete : undefined}
                    onReindex={doc.indexed_status !== 'indexed' ? handleReindex : undefined}
                  />
                ))}
              </AnimatePresence>
            )}
          </Card>
        </motion.div>
      </div>
    </div>
  )
}

export default DocumentsPage
