import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar,
  Clock,
  Users,
  Plus,
  FileText,
  CheckSquare,
  Video,
  List,
  CalendarDays,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Search,
  X,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import type { Meeting } from '@/types'

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_MEETINGS: Meeting[] = [
  {
    id: '1',
    title: 'v9.48 Post-Release Review',
    scheduled_at: '2025-05-28T11:00:00Z',
    duration_minutes: 60,
    attendees: ['Ajay Todkar', 'Priya Sharma', 'Rohit Kulkarni', 'Neha Joshi'],
    type: 'release',
    status: 'scheduled',
    notes: 'Review deployment outcomes for v9.48 across all clients.',
    action_items: ['Verify Kotak FIX stability', 'Send deployment report to HDFC', 'Update release notes wiki'],
    mom_generated: false,
  },
  {
    id: '2',
    title: 'JIRA-1039 FIX Session Drop — RCA Meeting',
    scheduled_at: '2025-05-27T14:00:00Z',
    duration_minutes: 90,
    attendees: ['Ajay Todkar', 'Rohit Kulkarni', 'Vikram Nair'],
    type: 'rca',
    status: 'completed',
    notes: 'Root cause identified: QuickFIX/J 2.3.1 work-stealing thread pool caused session drops under high load. Reverted to 2.2.0.',
    action_items: ['Revert FIX to 2.2.0 in v9.47.1', 'Add adaptive thread pool config', 'Performance test before v9.48 release'],
    mom_generated: true,
  },
  {
    id: '3',
    title: 'Kotak Securities — Q2 Technical Review',
    scheduled_at: '2025-05-26T10:00:00Z',
    duration_minutes: 120,
    attendees: ['Ajay Todkar', 'Priya Sharma', 'Kotak IT Team', 'Ananya Iyer'],
    type: 'client',
    status: 'completed',
    notes: 'Discussed upgrade plan to v9.48, NSE circular compliance timeline, and new feature requests for v9.49.',
    action_items: ['Schedule UAT deployment for June 1', 'Share compliance checklist for NSEIT/CMPT/2025/031', 'MCX feature scope document'],
    mom_generated: false,
  },
  {
    id: '4',
    title: 'Sprint 47 QA Closure Review',
    scheduled_at: '2025-05-23T15:30:00Z',
    duration_minutes: 45,
    attendees: ['Priya Sharma', 'Neha Joshi', 'Suresh Patil'],
    type: 'qa',
    status: 'completed',
    notes: 'All 48 test cases passed. 3 edge cases deferred to Sprint 48. Performance benchmarks within SLA.',
    action_items: ['Document deferred test cases', 'Performance regression suite for OMS', 'Update QA sign-off tracker'],
    mom_generated: true,
  },
  {
    id: '5',
    title: 'Emergency: OMS Memory Leak War Room',
    scheduled_at: '2025-05-15T08:00:00Z',
    duration_minutes: 180,
    attendees: ['Ajay Todkar', 'Rohit Kulkarni', 'Vikram Nair', 'Neha Joshi'],
    type: 'rca',
    status: 'completed',
    notes: 'War room to address OMS memory leak found in production. Identified PendingOrderMap not being cleared on order finalization.',
    action_items: ['Fix CancelReplaceOrderProcessor.java line 342', 'Run 24-hour soak test', 'Hotfix to all affected clients'],
    mom_generated: true,
  },
  {
    id: '6',
    title: 'v9.49 Planning — Feature Roadmap',
    scheduled_at: '2025-06-02T10:00:00Z',
    duration_minutes: 90,
    attendees: ['Ajay Todkar', 'Priya Sharma', 'Ananya Iyer', 'Product Team'],
    type: 'general',
    status: 'scheduled',
    notes: '',
    action_items: [],
    mom_generated: false,
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<Meeting['type'], { label: string; bg: string; text: string; icon: React.ReactNode }> = {
  release: { label: 'Release', bg: 'bg-blue-100 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-400', icon: <Calendar className="h-3 w-3" /> },
  rca: { label: 'RCA', bg: 'bg-red-100 dark:bg-red-950/40', text: 'text-red-700 dark:text-red-400', icon: <AlertCircle className="h-3 w-3" /> },
  client: { label: 'Client', bg: 'bg-emerald-100 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-400', icon: <Users className="h-3 w-3" /> },
  qa: { label: 'QA', bg: 'bg-purple-100 dark:bg-purple-950/40', text: 'text-purple-700 dark:text-purple-400', icon: <CheckSquare className="h-3 w-3" /> },
  general: { label: 'General', bg: 'bg-slate-100 dark:bg-slate-800/60', text: 'text-slate-600 dark:text-slate-400', icon: <Video className="h-3 w-3" /> },
}

function formatMeetingDate(iso: string) {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' }),
    time: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
  }
}

// ─── Meeting Card ─────────────────────────────────────────────────────────────

const MeetingCard: React.FC<{ meeting: Meeting; index: number; onGenerateMOM: (id: string) => void }> = ({ meeting, index, onGenerateMOM }) => {
  const [expanded, setExpanded] = useState(false)
  const typeCfg = TYPE_CONFIG[meeting.type]
  const { date, time } = formatMeetingDate(meeting.scheduled_at)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
    >
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {/* Date block */}
            <div className="flex-shrink-0 rounded-xl border border-border bg-muted/40 px-3 py-2 text-center min-w-[52px]">
              <p className="text-[10px] text-muted-foreground font-medium uppercase">{date.split(',')[0]}</p>
              <p className="text-lg font-bold text-foreground leading-tight">{date.split(' ')[2] ?? '28'}</p>
              <p className="text-[10px] text-muted-foreground">{date.split(' ')[1]}</p>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-foreground leading-snug">{meeting.title}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', typeCfg.bg, typeCfg.text)}>
                      {typeCfg.icon} {typeCfg.label}
                    </span>
                    <StatusBadge status={meeting.status} size="sm" />
                    {meeting.mom_generated && (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400">
                        <FileText className="h-2.5 w-2.5" /> MOM Ready
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {meeting.status === 'completed' && !meeting.mom_generated && (
                    <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => onGenerateMOM(meeting.id)}>
                      <FileText className="h-3 w-3" /> Generate MOM
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded((v) => !v)}>
                    {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{time} · {meeting.duration_minutes} min</span>
                <span className="flex items-center gap-1"><Users className="h-3 w-3" />{meeting.attendees.length} attendees</span>
              </div>

              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 space-y-3">
                      {meeting.notes && (
                        <div>
                          <p className="text-xs font-medium text-foreground mb-1">Notes</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">{meeting.notes}</p>
                        </div>
                      )}
                      {meeting.attendees.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-foreground mb-1.5">Attendees</p>
                          <div className="flex flex-wrap gap-1.5">
                            {meeting.attendees.map((a) => (
                              <span key={a} className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-foreground">{a}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {meeting.action_items && meeting.action_items.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-foreground mb-1.5">Action Items</p>
                          <div className="space-y-1">
                            {meeting.action_items.map((item, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                                <CheckSquare className="h-3 w-3 mt-0.5 flex-shrink-0 text-primary" />
                                <span>{item}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ─── Schedule Dialog ──────────────────────────────────────────────────────────

const ScheduleDialog: React.FC<{ open: boolean; onClose: () => void; onSchedule: (m: Meeting) => void }> = ({ open, onClose, onSchedule }) => {
  const [form, setForm] = useState({
    title: '',
    date: '',
    time: '',
    duration: '60',
    type: 'general' as Meeting['type'],
    attendees: '',
    description: '',
  })

  const handleSubmit = () => {
    if (!form.title || !form.date || !form.time) return
    const meeting: Meeting = {
      id: `m-${Date.now()}`,
      title: form.title,
      scheduled_at: new Date(`${form.date}T${form.time}:00`).toISOString(),
      duration_minutes: parseInt(form.duration),
      attendees: form.attendees.split(',').map((a) => a.trim()).filter(Boolean),
      type: form.type,
      status: 'scheduled',
      notes: form.description,
      action_items: [],
      mom_generated: false,
    }
    onSchedule(meeting)
    onClose()
    setForm({ title: '', date: '', time: '', duration: '60', type: 'general', attendees: '', description: '' })
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Calendar className="h-4 w-4" /> Schedule Meeting</DialogTitle>
          <DialogDescription>Create a new meeting entry with attendees and details.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Meeting Title</Label>
            <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="e.g. v9.49 Release Planning" className="h-9" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Time</Label>
              <Input type="time" value={form.time} onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))} className="h-9" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Duration</Label>
              <Select value={form.duration} onValueChange={(v) => setForm((p) => ({ ...p, duration: v }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="45">45 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="90">1.5 hours</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                  <SelectItem value="180">3 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((p) => ({ ...p, type: v as Meeting['type'] }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_CONFIG).map(([v, cfg]) => (
                    <SelectItem key={v} value={v}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Attendees (comma-separated)</Label>
            <Input value={form.attendees} onChange={(e) => setForm((p) => ({ ...p, attendees: e.target.value }))} placeholder="Ajay Todkar, Priya Sharma, Client Name" className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Meeting agenda or description..."
              className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit} disabled={!form.title || !form.date || !form.time}>Schedule Meeting</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const MeetingsPage: React.FC = () => {
  const [meetings, setMeetings] = useState<Meeting[]>(MOCK_MEETINGS)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')

  const filtered = useMemo(() =>
    meetings.filter((m) => {
      const matchSearch = !search || m.title.toLowerCase().includes(search.toLowerCase())
      const matchType = typeFilter === 'all' || m.type === typeFilter
      const matchStatus = statusFilter === 'all' || m.status === statusFilter
      return matchSearch && matchType && matchStatus
    }).sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()),
    [meetings, search, typeFilter, statusFilter]
  )

  const handleGenerateMOM = (id: string) => {
    setMeetings((prev) => prev.map((m) => m.id === id ? { ...m, mom_generated: true } : m))
  }

  const handleSchedule = (meeting: Meeting) => {
    setMeetings((prev) => [meeting, ...prev])
  }

  const upcoming = meetings.filter((m) => m.status === 'scheduled').length
  const completed = meetings.filter((m) => m.status === 'completed').length

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Meetings"
        subtitle="Schedule and track release reviews, RCA sessions, client calls, and QA walkthroughs."
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setViewMode('list')}
                className={cn('px-2.5 py-1.5 text-xs transition-colors', viewMode === 'list' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground')}
              >
                <List className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={cn('px-2.5 py-1.5 text-xs border-l border-border transition-colors', viewMode === 'calendar' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground')}
              >
                <CalendarDays className="h-3.5 w-3.5" />
              </button>
            </div>
            <Button size="sm" className="gap-1.5" onClick={() => setScheduleOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Schedule Meeting
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Meetings', value: meetings.length },
          { label: 'Upcoming', value: upcoming },
          { label: 'Completed', value: completed },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Filters */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search meetings..." className="pl-8 h-9 text-sm" />
          {search && <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setSearch('')}><X className="h-3.5 w-3.5" /></button>}
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-32 h-9 text-sm"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {Object.entries(TYPE_CONFIG).map(([v, cfg]) => <SelectItem key={v} value={v}>{cfg.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32 h-9 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* Meeting list */}
      {filtered.length === 0 ? (
        <EmptyState icon={<Calendar />} title="No meetings found" description="Schedule a new meeting or adjust your filters." compact action={{ label: 'Schedule Meeting', onClick: () => setScheduleOpen(true) }} />
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {filtered.map((meeting, i) => (
              <MeetingCard key={meeting.id} meeting={meeting} index={i} onGenerateMOM={handleGenerateMOM} />
            ))}
          </AnimatePresence>
        </div>
      )}

      <ScheduleDialog open={scheduleOpen} onClose={() => setScheduleOpen(false)} onSchedule={handleSchedule} />
    </div>
  )
}

export default MeetingsPage
