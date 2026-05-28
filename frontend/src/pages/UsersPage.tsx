import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  UserPlus,
  Search,
  Edit,
  KeyRound,
  UserX,
  UserCheck,
  Shield,
  X,
  Trash2,
  RefreshCw,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
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
import { EmptyState } from '@/components/shared/EmptyState'
import { cn } from '@/utils/cn'
import { usersApi } from '@/services/api'
import type { User, UserRole } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

function formatDate(iso?: string | null) {
  if (!iso) return 'Never'
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const hours = Math.floor(diff / 3600000)
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })
}

const ROLE_CONFIG: Record<UserRole, { label: string; bg: string; text: string; dot: string }> = {
  admin: { label: 'Admin', bg: 'bg-purple-100 dark:bg-purple-950/40', text: 'text-purple-700 dark:text-purple-400', dot: 'bg-purple-500' },
  manager: { label: 'Manager', bg: 'bg-blue-100 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-400', dot: 'bg-blue-500' },
  user: { label: 'User', bg: 'bg-slate-100 dark:bg-slate-800/60', text: 'text-slate-600 dark:text-slate-400', dot: 'bg-slate-400' },
}

const AVATAR_COLORS = [
  'bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-pink-500', 'bg-indigo-500', 'bg-teal-500', 'bg-orange-500',
]

const RoleBadge: React.FC<{ role: UserRole }> = ({ role }) => {
  const cfg = ROLE_CONFIG[role]
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', cfg.bg, cfg.text)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  )
}

const StatusBadge: React.FC<{ active: boolean }> = ({ active }) => (
  <span className={cn(
    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
    active ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400'
  )}>
    <span className={cn('h-1.5 w-1.5 rounded-full', active ? 'bg-emerald-500' : 'bg-red-500')} />
    {active ? 'Active' : 'Inactive'}
  </span>
)

// ─── User Form ────────────────────────────────────────────────────────────────

interface UserFormData {
  full_name: string
  email: string
  username: string
  password: string
  role: UserRole
}

const defaultForm: UserFormData = { full_name: '', email: '', username: '', password: '', role: 'user' }

const UserForm: React.FC<{
  data: UserFormData
  onChange: (data: UserFormData) => void
  isEdit?: boolean
}> = ({ data, onChange, isEdit }) => {
  const set = (field: keyof UserFormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...data, [field]: e.target.value })

  return (
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="full-name" className="text-xs font-medium">Full Name</Label>
          <Input id="full-name" value={data.full_name} onChange={set('full_name')} placeholder="e.g. Priya Sharma" className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="uname" className="text-xs font-medium">Username</Label>
          <Input id="uname" value={data.username} onChange={set('username')} placeholder="e.g. psharma" className="h-9 font-mono" disabled={isEdit} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-xs font-medium">Email Address</Label>
        <Input id="email" type="email" value={data.email} onChange={set('email')} placeholder="user@greeksoft.co.in" className="h-9" />
      </div>
      {!isEdit && (
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-xs font-medium">Password</Label>
          <Input id="password" type="password" value={data.password} onChange={set('password')} placeholder="Minimum 8 characters" className="h-9" />
        </div>
      )}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Role</Label>
        <Select value={data.role} onValueChange={(v) => onChange({ ...data, role: v as UserRole })}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">Admin — full system access</SelectItem>
            <SelectItem value="manager">Manager — manage releases and issues</SelectItem>
            <SelectItem value="user">User — read and query only</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [deleteUser, setDeleteUser] = useState<User | null>(null)
  const [resetUser, setResetUser] = useState<User | null>(null)
  const [newPassword, setNewPassword] = useState('')

  const [formData, setFormData] = useState<UserFormData>(defaultForm)
  const [editForm, setEditForm] = useState<UserFormData>(defaultForm)
  const [saving, setSaving] = useState(false)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await usersApi.list({ page_size: 100 })
      setUsers(res.data.items ?? [])
    } catch {
      setError('Failed to load users.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  const filtered = useMemo(() =>
    users.filter((u) => {
      const matchSearch = !search || u.full_name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()) || u.username.toLowerCase().includes(search.toLowerCase())
      const matchRole = roleFilter === 'all' || u.role === roleFilter
      const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? u.is_active : !u.is_active)
      return matchSearch && matchRole && matchStatus
    }),
    [users, search, roleFilter, statusFilter]
  )

  const handleCreate = async () => {
    if (!formData.full_name || !formData.email || !formData.username || !formData.password) return
    setSaving(true)
    try {
      await usersApi.create({ ...formData })
      await loadUsers()
      setFormData(defaultForm)
      setCreateOpen(false)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      alert(msg || 'Failed to create user.')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async () => {
    if (!editUser) return
    setSaving(true)
    try {
      await usersApi.update(editUser.id, {
        full_name: editForm.full_name,
        email: editForm.email,
        role: editForm.role,
      })
      await loadUsers()
      setEditUser(null)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      alert(msg || 'Failed to update user.')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (user: User) => {
    try {
      await usersApi.toggleActive(user.id)
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, is_active: !u.is_active } : u))
    } catch {
      alert('Failed to update user status.')
    }
  }

  const handleDelete = async () => {
    if (!deleteUser) return
    setSaving(true)
    try {
      await usersApi.delete(deleteUser.id)
      setUsers((prev) => prev.filter((u) => u.id !== deleteUser.id))
      setDeleteUser(null)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      alert(msg || 'Failed to delete user.')
    } finally {
      setSaving(false)
    }
  }

  const handleResetPassword = async () => {
    if (!resetUser || newPassword.length < 8) return
    setSaving(true)
    try {
      await usersApi.resetPassword(resetUser.id, newPassword)
      setResetUser(null)
      setNewPassword('')
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      alert(msg || 'Failed to reset password.')
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (u: User) => {
    setEditForm({ full_name: u.full_name, email: u.email, username: u.username, password: '', role: u.role })
    setEditUser(u)
  }

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="User Management"
        subtitle="Manage system users, roles, and access permissions."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={loadUsers} disabled={loading}>
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> Refresh
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => { setFormData(defaultForm); setCreateOpen(true) }}>
              <UserPlus className="h-3.5 w-3.5" /> Create User
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Users', value: users.length },
          { label: 'Active', value: users.filter((u) => u.is_active).length },
          { label: 'Admins', value: users.filter((u) => u.role === 'admin').length },
          { label: 'Managers', value: users.filter((u) => u.role === 'manager').length },
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
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users..." className="pl-8 h-9 text-sm" />
          {search && <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setSearch('')}><X className="h-3.5 w-3.5" /></button>}
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-32 h-9 text-sm"><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
            <SelectItem value="user">User</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32 h-9 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error} <button className="underline ml-2" onClick={loadUsers}>Retry</button>
        </div>
      )}

      {/* Users table */}
      {loading ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">Loading users…</CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Shield />} title="No users found" description="Try adjusting your search or filters." compact />
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {['User', 'Role', 'Status', 'Last Login', 'Actions'].map((h) => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <AnimatePresence initial={false}>
                      {filtered.map((user, idx) => (
                        <motion.tr
                          key={user.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ delay: idx * 0.03 }}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <div className={cn('h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0', AVATAR_COLORS[parseInt(user.id) % AVATAR_COLORS.length])}>
                                {getInitials(user.full_name)}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-foreground">{user.full_name}</p>
                                <p className="text-xs text-muted-foreground">{user.email}</p>
                                <p className="text-[10px] text-muted-foreground/60 font-mono">@{user.username}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3"><RoleBadge role={user.role} /></td>
                          <td className="px-5 py-3"><StatusBadge active={user.is_active} /></td>
                          <td className="px-5 py-3 text-xs text-muted-foreground">{formatDate(user.last_login)}</td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit user" onClick={() => openEdit(user)}>
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="Reset password" onClick={() => { setResetUser(user); setNewPassword('') }}>
                                <KeyRound className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={cn('h-7 w-7', user.is_active ? 'text-amber-500 hover:text-amber-600' : 'text-emerald-600 hover:text-emerald-700')}
                                title={user.is_active ? 'Deactivate' : 'Activate'}
                                onClick={() => handleToggleActive(user)}
                              >
                                {user.is_active ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                title="Delete user"
                                onClick={() => setDeleteUser(user)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Create User Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserPlus className="h-4 w-4" /> Create New User</DialogTitle>
            <DialogDescription>Fill in the details to create a new system user.</DialogDescription>
          </DialogHeader>
          <UserForm data={formData} onChange={setFormData} />
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)} disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={handleCreate} disabled={saving || !formData.full_name || !formData.email || !formData.username || formData.password.length < 8}>
              {saving ? 'Creating…' : 'Create User'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Edit className="h-4 w-4" /> Edit User</DialogTitle>
            <DialogDescription>Update details for {editUser?.full_name}.</DialogDescription>
          </DialogHeader>
          <UserForm data={editForm} onChange={setEditForm} isEdit />
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={() => setEditUser(null)} disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={handleEdit} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetUser} onOpenChange={() => { setResetUser(null); setNewPassword('') }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> Reset Password</DialogTitle>
            <DialogDescription>Set a new password for {resetUser?.full_name}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 mt-4">
            <Label htmlFor="new-password" className="text-xs font-medium">New Password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              className="h-9"
            />
            {newPassword.length > 0 && newPassword.length < 8 && (
              <p className="text-[11px] text-destructive">Password must be at least 8 characters.</p>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={() => { setResetUser(null); setNewPassword('') }} disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={handleResetPassword} disabled={saving || newPassword.length < 8}>
              {saving ? 'Resetting…' : 'Reset Password'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteUser} onOpenChange={() => setDeleteUser(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><Trash2 className="h-4 w-4" /> Delete User</DialogTitle>
            <DialogDescription>
              Permanently delete <strong>{deleteUser?.full_name}</strong> (@{deleteUser?.username})? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={() => setDeleteUser(null)} disabled={saving}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={saving}>
              {saving ? 'Deleting…' : 'Delete User'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default UsersPage
