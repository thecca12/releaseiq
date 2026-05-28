import React, { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  Search,
  X,
  Download,
  FileCode2,
  Terminal,
  FileText,
  File,
  Info,
  HardDrive,
  Calendar,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { cn } from '@/utils/cn'
import { utilitiesApi } from '@/services/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Utility {
  name: string
  filename: string
  size_bytes: number
  extension: string
  description: string
  upload_date: string
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_UTILITIES: Utility[] = [
  {
    name: 'FIX Log Parser',
    filename: 'fix_log_parser.py',
    size_bytes: 18432,
    extension: 'py',
    description: 'Parses raw FIX engine logs and extracts order flow, message counts, and session events. Outputs structured CSV for analysis.',
    upload_date: '2025-05-15T10:30:00Z',
  },
  {
    name: 'RMS Health Check',
    filename: 'rms_health_check.sh',
    size_bytes: 4096,
    extension: 'sh',
    description: 'Shell script to verify RMS process health: checks PID, port binding, log tail for errors, and risk parameter file integrity.',
    upload_date: '2025-05-12T08:00:00Z',
  },
  {
    name: 'Order Reconciliation Tool',
    filename: 'order_reconciliation.py',
    size_bytes: 32768,
    extension: 'py',
    description: 'Reconciles OMS order book against exchange acknowledge files. Identifies missing ACKs, duplicate entries, and sequence gaps.',
    upload_date: '2025-05-10T14:15:00Z',
  },
  {
    name: 'Deployment Checklist',
    filename: 'deployment_checklist.txt',
    size_bytes: 2048,
    extension: 'txt',
    description: 'Standard deployment checklist for production releases. Covers pre-deployment verification, deployment steps, post-deployment health checks, and rollback procedure.',
    upload_date: '2025-05-08T09:00:00Z',
  },
  {
    name: 'NSE Gateway Config Template',
    filename: 'nse_gateway_config.sh',
    size_bytes: 6144,
    extension: 'sh',
    description: 'Bash script template for NSE gateway configuration. Sets FIX session parameters, heartbeat intervals, and failover endpoints per NSEIT specifications.',
    upload_date: '2025-05-05T11:00:00Z',
  },
  {
    name: 'Log Size Analyzer',
    filename: 'log_size_analyzer.py',
    size_bytes: 8192,
    extension: 'py',
    description: 'Analyzes log file growth trends over time. Alerts on files exceeding size thresholds and generates rotation recommendations.',
    upload_date: '2025-04-28T16:30:00Z',
  },
  {
    name: 'Database Backup Script',
    filename: 'db_backup.sh',
    size_bytes: 3072,
    extension: 'sh',
    description: 'Automated PostgreSQL backup script for ReleaseIQ database. Supports full and incremental backups with configurable retention period.',
    upload_date: '2025-04-20T07:00:00Z',
  },
  {
    name: 'Exchange Connectivity Test',
    filename: 'exchange_connectivity_test.py',
    size_bytes: 12288,
    extension: 'py',
    description: 'Tests TCP connectivity to NSE, BSE, and MCX gateway endpoints. Validates SSL certificates, measures latency, and verifies FIX session handshake.',
    upload_date: '2025-04-15T13:00:00Z',
  },
  {
    name: 'Release Notes Template',
    filename: 'release_notes_template.txt',
    size_bytes: 1536,
    extension: 'txt',
    description: 'Standard template for QA and LIVE release notes documentation. Includes sections for changes, known issues, deployment steps, and rollback plan.',
    upload_date: '2025-04-10T10:00:00Z',
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })
}

function getIcon(ext: string) {
  switch (ext.toLowerCase()) {
    case 'py': return FileCode2
    case 'sh': return Terminal
    case 'txt': return FileText
    default: return File
  }
}

function getExtColor(ext: string): string {
  switch (ext.toLowerCase()) {
    case 'py': return 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400'
    case 'sh': return 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400'
    case 'txt': return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
    default: return 'bg-muted text-muted-foreground'
  }
}

function getIconBg(ext: string): string {
  switch (ext.toLowerCase()) {
    case 'py': return 'bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
    case 'sh': return 'bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
    case 'txt': return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
    default: return 'bg-muted text-muted-foreground'
  }
}

// ─── Utility Card ─────────────────────────────────────────────────────────────

const UtilityCard: React.FC<{
  utility: Utility
  index: number
  onViewDetails: (u: Utility) => void
  onDownload: (u: Utility) => void
}> = ({ utility, index, onViewDetails, onDownload }) => {
  const Icon = getIcon(utility.extension)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
    >
      <Card className="hover:shadow-md transition-shadow h-full">
        <CardContent className="p-5 flex flex-col h-full">
          {/* Icon + extension */}
          <div className="flex items-start justify-between mb-3">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0', getIconBg(utility.extension))}>
              <Icon className="h-5 w-5" />
            </div>
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase', getExtColor(utility.extension))}>
              .{utility.extension}
            </span>
          </div>

          {/* Name + description */}
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground leading-snug mb-1">{utility.name}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{utility.description}</p>
          </div>

          {/* Metadata */}
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <HardDrive className="h-3 w-3" />
              {formatBytes(utility.size_bytes)}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(utility.upload_date)}
            </span>
          </div>

          {/* Filename */}
          <p className="mt-1.5 font-mono text-[11px] text-muted-foreground truncate">{utility.filename}</p>

          {/* Actions */}
          <div className="mt-3 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-8 gap-1.5 text-xs"
              onClick={() => onViewDetails(utility)}
            >
              <Info className="h-3.5 w-3.5" /> Details
            </Button>
            <Button
              size="sm"
              className="flex-1 h-8 gap-1.5 text-xs gradient-brand border-0 text-white hover:opacity-90"
              onClick={() => onDownload(utility)}
            >
              <Download className="h-3.5 w-3.5" /> Download
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ─── Detail Dialog ────────────────────────────────────────────────────────────

const DetailsDialog: React.FC<{
  utility: Utility | null
  onClose: () => void
  onDownload: (u: Utility) => void
}> = ({ utility, onClose, onDownload }) => {
  if (!utility) return null
  const Icon = getIcon(utility.extension)

  return (
    <Dialog open={!!utility} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0', getIconBg(utility.extension))}>
              <Icon className="h-4 w-4" />
            </div>
            {utility.name}
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">{utility.filename}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Description</p>
            <p className="text-sm text-foreground/80 leading-relaxed">{utility.description}</p>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-muted-foreground font-medium mb-0.5">File Size</p>
              <p className="text-foreground font-semibold">{formatBytes(utility.size_bytes)}</p>
            </div>
            <div>
              <p className="text-muted-foreground font-medium mb-0.5">Extension</p>
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase', getExtColor(utility.extension))}>
                .{utility.extension}
              </span>
            </div>
            <div>
              <p className="text-muted-foreground font-medium mb-0.5">Upload Date</p>
              <p className="text-foreground">{formatDate(utility.upload_date)}</p>
            </div>
          </div>

          <Button
            className="w-full gap-2 gradient-brand border-0 text-white hover:opacity-90"
            onClick={() => { onDownload(utility); onClose() }}
          >
            <Download className="h-4 w-4" /> Download {utility.filename}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const UtilitiesPage: React.FC = () => {
  const [search, setSearch] = useState('')
  const [extFilter, setExtFilter] = useState('all')
  const [selectedUtility, setSelectedUtility] = useState<Utility | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['utilities'],
    queryFn: async () => {
      try {
        const res = await utilitiesApi.list()
        const items = (res.data?.items ?? res.data) as Utility[]
        if (Array.isArray(items) && items.length > 0) return items
        return MOCK_UTILITIES
      } catch {
        return MOCK_UTILITIES
      }
    },
  })

  const utilities = data ?? MOCK_UTILITIES

  const handleDownload = async (utility: Utility) => {
    try {
      const res = await utilitiesApi.download(utility.filename)
      const blob = new Blob([res.data])
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = utility.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      // Fallback: create a mock text blob for demo
      const blob = new Blob([`# ${utility.name}\n# ${utility.filename}\n\n${utility.description}`], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = utility.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }

  const filtered = useMemo(() => {
    return utilities.filter((u) => {
      const q = search.toLowerCase()
      const matchSearch = !search
        || u.name.toLowerCase().includes(q)
        || u.filename.toLowerCase().includes(q)
        || u.description.toLowerCase().includes(q)
      const matchExt = extFilter === 'all' || u.extension.toLowerCase() === extFilter
      return matchSearch && matchExt
    })
  }, [utilities, search, extFilter])

  const hasFilters = search || extFilter !== 'all'
  const clearFilters = () => { setSearch(''); setExtFilter('all') }

  const totalSize = utilities.reduce((sum, u) => sum + u.size_bytes, 0)

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Utilities"
        subtitle="Developer and operational utilities — scripts, tools, and templates for deployment and troubleshooting."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> Download All
            </Button>
          </div>
        }
      />

      {/* Stats bar */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Files', value: utilities.length, color: 'text-foreground' },
          { label: 'Python Scripts', value: utilities.filter((u) => u.extension === 'py').length, color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Shell Scripts', value: utilities.filter((u) => u.extension === 'sh').length, color: 'text-amber-600 dark:text-amber-400' },
          { label: 'Total Size', value: formatBytes(totalSize), color: 'text-violet-600 dark:text-violet-400' },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardContent className="p-4 text-center">
              <p className={cn('text-2xl font-bold tabular-nums', color)}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Filters */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search utilities, scripts…"
            className="pl-8 h-9 text-sm"
          />
          {search && (
            <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setSearch('')}>
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex gap-1.5">
          {['all', 'py', 'sh', 'txt'].map((ext) => (
            <button
              key={ext}
              onClick={() => setExtFilter(ext)}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                extFilter === ext
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {ext === 'all' ? 'All Types' : `.${ext}`}
            </button>
          ))}
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-9 gap-1 text-xs" onClick={clearFilters}>
            <X className="h-3 w-3" /> Clear
          </Button>
        )}
      </motion.div>

      <p className="text-xs text-muted-foreground">
        Showing <span className="font-medium text-foreground">{filtered.length}</span> utilit{filtered.length !== 1 ? 'ies' : 'y'}
      </p>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="h-40 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<File />}
          title="No utilities found"
          description="Try adjusting your search or filter."
          action={{ label: 'Clear filters', onClick: clearFilters }}
          compact
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((utility, i) => (
            <UtilityCard
              key={utility.filename}
              utility={utility}
              index={i}
              onViewDetails={setSelectedUtility}
              onDownload={handleDownload}
            />
          ))}
        </div>
      )}

      <DetailsDialog
        utility={selectedUtility}
        onClose={() => setSelectedUtility(null)}
        onDownload={handleDownload}
      />
    </div>
  )
}

export default UtilitiesPage
