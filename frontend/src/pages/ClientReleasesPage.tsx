import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  Users,
  Search,
  X,
  Edit,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  History,
  RefreshCcw,
  Download,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { cn } from '@/utils/cn'
import { clientReleasesApi } from '@/services/api'
import type { Client } from '@/types'

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_CLIENTS: Client[] = [
  { id: '1', name: 'Kotak Securities', current_version: 'v9.48', previous_version: 'v9.47.1', deployment_date: '2025-05-22T02:15:00Z', environment: 'production', exchange: 'NSE, BSE', modules: ['RMS', 'FIX', 'OMS', 'SERVER', 'CLIENT'], owner: 'Rohit Kulkarni', health_status: 'healthy' },
  { id: '2', name: 'HDFC Securities', current_version: 'v9.48', previous_version: 'v9.47', deployment_date: '2025-05-23T01:30:00Z', environment: 'uat', exchange: 'NSE', modules: ['RMS', 'FIX', 'OMS'], owner: 'Priya Sharma', health_status: 'healthy' },
  { id: '3', name: 'Zerodha', current_version: 'v9.47.1', previous_version: 'v9.47', deployment_date: '2025-05-20T23:00:00Z', environment: 'production', exchange: 'NSE, BSE, MCX', modules: ['RMS', 'FIX', 'OMS', 'SERVER', 'CLIENT'], owner: 'Ajay Todkar', health_status: 'warning' },
  { id: '4', name: 'Axis Securities', current_version: 'v9.48', previous_version: 'v9.46', deployment_date: '2025-05-24T03:00:00Z', environment: 'production', exchange: 'NSE', modules: ['RMS', 'OMS', 'CLIENT'], owner: 'Neha Joshi', health_status: 'healthy' },
  { id: '5', name: 'ICICI Direct', current_version: 'v9.47', previous_version: 'v9.46', deployment_date: '2025-05-10T02:00:00Z', environment: 'production', exchange: 'NSE, BSE', modules: ['RMS', 'FIX', 'OMS', 'SERVER'], owner: 'Priya Sharma', health_status: 'warning' },
  { id: '6', name: 'Angel Broking', current_version: 'v9.46', previous_version: 'v9.45', deployment_date: '2025-04-28T01:00:00Z', environment: 'production', exchange: 'NSE', modules: ['RMS', 'OMS'], owner: 'Rohit Kulkarni', health_status: 'healthy' },
  { id: '7', name: 'Motilal Oswal', current_version: 'v9.48', previous_version: 'v9.47', deployment_date: '2025-05-25T02:30:00Z', environment: 'staging', exchange: 'NSE, BSE', modules: ['RMS', 'FIX', 'OMS'], owner: 'Ananya Iyer', health_status: 'healthy' },
  { id: '8', name: 'Sharekhan', current_version: 'v9.44', previous_version: 'v9.43', deployment_date: '2025-03-31T00:00:00Z', environment: 'production', exchange: 'NSE', modules: ['RMS', 'FIX'], owner: 'Vikram Nair', health_status: 'critical' },
  { id: '9', name: 'Upstox', current_version: 'v9.47.1', previous_version: 'v9.46', deployment_date: '2025-05-21T00:00:00Z', environment: 'uat', exchange: 'NSE', modules: ['RMS', 'OMS', 'CLIENT'], owner: 'Ananya Iyer', health_status: 'healthy' },
  { id: '10', name: 'Finvasia', current_version: 'v9.45', previous_version: 'v9.44', deployment_date: '2025-04-14T01:00:00Z', environment: 'production', exchange: 'NSE, MCX', modules: ['RMS', 'FIX', 'OMS'], owner: 'Neha Joshi', health_status: 'healthy' },
]

const AUDIT_TRAIL: Record<string, Array<{ date: string; action: string; by: string; detail: string }>> = {
  '3': [
    { date: '2025-05-28T09:00:00Z', action: 'Health Warning', by: 'System', detail: 'FIX session heartbeat timeout detected (error code 1002)' },
    { date: '2025-05-20T23:00:00Z', action: 'Deployment', by: 'Ajay Todkar', detail: 'Upgraded from v9.47 to v9.47.1' },
    { date: '2025-05-12T10:00:00Z', action: 'Support Ticket', by: 'Zerodha', detail: 'Raised ST-8821: Order rejection code 1044 on modify orders' },
  ],
  '8': [
    { date: '2025-05-15T08:00:00Z', action: 'Health Alert', by: 'System', detail: 'Critical health status — v9.44 FIX engine known issues' },
    { date: '2025-03-31T00:00:00Z', action: 'Deployment', by: 'Vikram Nair', detail: 'Upgraded from v9.43 to v9.44' },
  ],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })
}

const ENV_CONFIG: Record<Client['environment'], { label: string; bg: string; text: string }> = {
  production: { label: 'Production', bg: 'bg-blue-100 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-400' },
  uat: { label: 'UAT', bg: 'bg-purple-100 dark:bg-purple-950/40', text: 'text-purple-700 dark:text-purple-400' },
  staging: { label: 'Staging', bg: 'bg-amber-100 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-400' },
}

const HealthIcon: React.FC<{ status: Client['health_status'] }> = ({ status }) => {
  if (status === 'healthy') return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
  if (status === 'warning') return <AlertTriangle className="h-4 w-4 text-amber-500" />
  return <XCircle className="h-4 w-4 text-red-500" />
}

// ─── Edit Dialog ──────────────────────────────────────────────────────────────

const EditDialog: React.FC<{
  client: Client | null
  onClose: () => void
  onSave: (updated: Client) => void
}> = ({ client, onClose, onSave }) => {
  const [form, setForm] = useState<Partial<Client>>(client ?? {})

  React.useEffect(() => {
    if (client) setForm({ ...client })
  }, [client])

  if (!client) return null

  return (
    <Dialog open={!!client} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Edit className="h-4 w-4" /> Edit Deployment — {client.name}</DialogTitle>
          <DialogDescription>Update deployment details for this client.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Current Version</Label>
              <Input value={form.current_version ?? ''} onChange={(e) => setForm((p) => ({ ...p, current_version: e.target.value }))} className="h-9 font-mono text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Previous Version</Label>
              <Input value={form.previous_version ?? ''} onChange={(e) => setForm((p) => ({ ...p, previous_version: e.target.value }))} className="h-9 font-mono text-xs" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Environment</Label>
              <Select value={form.environment} onValueChange={(v) => setForm((p) => ({ ...p, environment: v as Client['environment'] }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="production">Production</SelectItem>
                  <SelectItem value="uat">UAT</SelectItem>
                  <SelectItem value="staging">Staging</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Health Status</Label>
              <Select value={form.health_status} onValueChange={(v) => setForm((p) => ({ ...p, health_status: v as Client['health_status'] }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="healthy">Healthy</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Exchange</Label>
            <Input value={form.exchange ?? ''} onChange={(e) => setForm((p) => ({ ...p, exchange: e.target.value }))} className="h-9" placeholder="e.g. NSE, BSE, MCX" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Owner</Label>
            <Input value={form.owner ?? ''} onChange={(e) => setForm((p) => ({ ...p, owner: e.target.value }))} className="h-9" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => { onSave(form as Client); onClose() }}>Save Changes</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Client Row ───────────────────────────────────────────────────────────────

const ClientRow: React.FC<{
  client: Client
  index: number
  onEdit: (c: Client) => void
}> = ({ client, index, onEdit }) => {
  const [auditOpen, setAuditOpen] = useState(false)
  const envCfg = ENV_CONFIG[client.environment]
  const audit = AUDIT_TRAIL[client.id] ?? []

  return (
    <>
      <motion.tr
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: index * 0.03 }}
        className="border-b border-border hover:bg-muted/30 transition-colors group"
      >
        <td className="px-5 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">{client.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{client.owner}</p>
          </div>
        </td>
        <td className="px-5 py-3">
          <code className="font-mono text-sm font-bold text-primary">{client.current_version}</code>
        </td>
        <td className="px-5 py-3">
          <code className="font-mono text-xs text-muted-foreground">{client.previous_version ?? '—'}</code>
        </td>
        <td className="px-5 py-3">
          <div>
            <p className="text-xs text-foreground">{formatDate(client.deployment_date)}</p>
          </div>
        </td>
        <td className="px-5 py-3">
          <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium', envCfg.bg, envCfg.text)}>
            {envCfg.label}
          </span>
        </td>
        <td className="px-5 py-3">
          <p className="text-xs text-muted-foreground">{client.exchange}</p>
        </td>
        <td className="px-5 py-3">
          <div className="flex items-center gap-1.5">
            <HealthIcon status={client.health_status} />
            <StatusBadge status={client.health_status} size="sm" />
          </div>
        </td>
        <td className="px-5 py-3">
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit" onClick={() => onEdit(client)}>
              <Edit className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Audit trail"
              onClick={() => setAuditOpen((v) => !v)}
              disabled={audit.length === 0}
            >
              <History className={cn('h-3.5 w-3.5', audit.length > 0 ? 'text-indigo-500' : 'text-muted-foreground')} />
            </Button>
          </div>
        </td>
      </motion.tr>

      {/* Audit trail row */}
      <AnimatePresence>
        {auditOpen && audit.length > 0 && (
          <tr>
            <td colSpan={8} className="border-b border-border">
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="px-6 py-3 bg-indigo-50/50 dark:bg-indigo-950/10">
                  <div className="flex items-center gap-1.5 mb-2">
                    <History className="h-3.5 w-3.5 text-indigo-500" />
                    <span className="text-xs font-semibold text-foreground">Audit Trail</span>
                  </div>
                  <div className="space-y-1.5">
                    {audit.map((entry, i) => (
                      <div key={i} className="flex items-start gap-3 text-xs">
                        <span className="text-muted-foreground font-mono flex-shrink-0">{formatDate(entry.date)}</span>
                        <span className={cn(
                          'rounded-full px-1.5 py-0.5 text-[10px] font-medium flex-shrink-0',
                          entry.action === 'Deployment' ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400' :
                          entry.action === 'Health Alert' || entry.action === 'Health Warning' ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400' :
                          'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400'
                        )}>
                          {entry.action}
                        </span>
                        <span className="text-muted-foreground flex-1">{entry.detail}</span>
                        <span className="text-muted-foreground flex-shrink-0">by {entry.by}</span>
                      </div>
                    ))}
                  </div>
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

const ClientReleasesPage: React.FC = () => {
  const [localClients, setLocalClients] = useState<Client[] | null>(null)
  const [search, setSearch] = useState('')

  const { data: apiData } = useQuery({
    queryKey: ['client-releases'],
    queryFn: async () => {
      try {
        const res = await clientReleasesApi.list()
        const raw = res.data?.items ?? res.data
        if (Array.isArray(raw) && raw.length > 0) {
          return raw.map((item: Record<string, unknown>, idx: number) => {
            const rawHealth = String(item.health_status ?? 'healthy').toLowerCase()
            const health_status: Client['health_status'] = rawHealth === 'critical' ? 'critical' : rawHealth === 'warning' ? 'warning' : 'healthy'
            const rawEnv = String(item.environment ?? 'production').toLowerCase()
            const environment: Client['environment'] = rawEnv === 'uat' ? 'uat' : rawEnv === 'staging' ? 'staging' : 'production'
            const modulesRaw = item.modules
            const modules: string[] = Array.isArray(modulesRaw)
              ? (modulesRaw as string[])
              : String(modulesRaw ?? 'RMS').split(',').map((m: string) => m.trim())
            const exchangesRaw = item.exchanges
            const exchange: string = Array.isArray(exchangesRaw)
              ? (exchangesRaw as string[]).join(', ')
              : String(exchangesRaw ?? item.exchange ?? 'NSE')
            return {
              id: String(item.client_id ?? item.id ?? idx + 1),
              name: String(item.client_name ?? item.name ?? `Client ${idx + 1}`),
              current_version: String(item.current_version ?? 'v9.48'),
              previous_version: item.previous_version ? String(item.previous_version) : undefined,
              deployment_date: String(item.deployment_date ?? new Date().toISOString()),
              environment,
              exchange,
              modules,
              owner: item.owner ? String(item.owner) : undefined,
              health_status,
            } as Client
          })
        }
        return null
      } catch {
        return null
      }
    },
  })

  const clients = localClients ?? apiData ?? MOCK_CLIENTS
  const [envFilter, setEnvFilter] = useState('all')
  const [healthFilter, setHealthFilter] = useState('all')
  const [versionFilter, setVersionFilter] = useState('all')
  const [editClient, setEditClient] = useState<Client | null>(null)

  const versions = useMemo(() => [...new Set(clients.map((c) => c.current_version))].sort().reverse(), [clients])

  const filtered = useMemo(() =>
    clients.filter((c) => {
      const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.exchange.toLowerCase().includes(search.toLowerCase())
      const matchEnv = envFilter === 'all' || c.environment === envFilter
      const matchHealth = healthFilter === 'all' || c.health_status === healthFilter
      const matchVersion = versionFilter === 'all' || c.current_version === versionFilter
      return matchSearch && matchEnv && matchHealth && matchVersion
    }),
    [clients, search, envFilter, healthFilter, versionFilter]
  )

  const handleSave = (updated: Client) => {
    setLocalClients((prev) => {
      const base = prev ?? clients
      return base.map((c) => c.id === updated.id ? updated : c)
    })
  }

  const clearFilters = () => { setSearch(''); setEnvFilter('all'); setHealthFilter('all'); setVersionFilter('all') }
  const hasFilters = search || envFilter !== 'all' || healthFilter !== 'all' || versionFilter !== 'all'

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Client Releases"
        subtitle="Track client-specific deployments, versions, environments, and health status."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5">
              <RefreshCcw className="h-3.5 w-3.5" /> Sync
            </Button>
          </div>
        }
      />

      {/* Summary stats */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Clients', value: clients.length, color: 'text-foreground' },
          { label: 'Healthy', value: clients.filter((c) => c.health_status === 'healthy').length, color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Warning', value: clients.filter((c) => c.health_status === 'warning').length, color: 'text-amber-600 dark:text-amber-400' },
          { label: 'Critical', value: clients.filter((c) => c.health_status === 'critical').length, color: 'text-red-600 dark:text-red-400' },
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
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clients or exchanges…" className="pl-8 h-9 text-sm" />
          {search && <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setSearch('')}><X className="h-3.5 w-3.5" /></button>}
        </div>
        <Select value={envFilter} onValueChange={setEnvFilter}>
          <SelectTrigger className="w-36 h-9 text-sm"><SelectValue placeholder="Environment" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All environments</SelectItem>
            <SelectItem value="production">Production</SelectItem>
            <SelectItem value="uat">UAT</SelectItem>
            <SelectItem value="staging">Staging</SelectItem>
          </SelectContent>
        </Select>
        <Select value={healthFilter} onValueChange={setHealthFilter}>
          <SelectTrigger className="w-32 h-9 text-sm"><SelectValue placeholder="Health" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All health</SelectItem>
            <SelectItem value="healthy">Healthy</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
        <Select value={versionFilter} onValueChange={setVersionFilter}>
          <SelectTrigger className="w-32 h-9 text-sm"><SelectValue placeholder="Version" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All versions</SelectItem>
            {versions.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-9 gap-1 text-xs" onClick={clearFilters}>
            <X className="h-3 w-3" /> Clear
          </Button>
        )}
      </motion.div>

      <p className="text-xs text-muted-foreground">
        Showing <span className="font-medium text-foreground">{filtered.length}</span> client{filtered.length !== 1 ? 's' : ''} — click the history icon to view audit trail
      </p>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState icon={<Users />} title="No clients found" description="Try adjusting your filters." compact />
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {['Client', 'Current Version', 'Previous Version', 'Deployment Date', 'Environment', 'Exchange', 'Health', 'Actions'].map((h) => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence initial={false}>
                      {filtered.map((client, i) => (
                        <ClientRow key={client.id} client={client} index={i} onEdit={setEditClient} />
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <EditDialog client={editClient} onClose={() => setEditClient(null)} onSave={handleSave} />
    </div>
  )
}

export default ClientReleasesPage
