import React, { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Menu,
  Search,
  Sun,
  Moon,
  Monitor,
  Bell,
  LogOut,
  User as UserIcon,
  ChevronDown,
  Settings,
  X,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { useUIStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'
import type { Theme, User } from '@/types'

// ─── Theme cycle ──────────────────────────────────────────────────────────────

const THEMES: { value: Theme; icon: React.ElementType; label: string }[] = [
  { value: 'light', icon: Sun, label: 'Light' },
  { value: 'dark', icon: Moon, label: 'Dark' },
  { value: 'system', icon: Monitor, label: 'System' },
]

// ─── Header ───────────────────────────────────────────────────────────────────

export const Header: React.FC = () => {
  const { theme, setTheme, toggleSidebar, notifications } = useUIStore()
  const { user, clearAuth } = useAuthStore()

  const [searchFocused, setSearchFocused] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)

  const searchRef = useRef<HTMLInputElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)

  // Ctrl+K global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const cycleTheme = useCallback(() => {
    const idx = THEMES.findIndex((t) => t.value === theme)
    const next = THEMES[(idx + 1) % THEMES.length]
    setTheme(next.value)
  }, [theme, setTheme])

  const currentThemeIcon = THEMES.find((t) => t.value === theme)?.icon ?? Sun

  const initials = user
    ? (user.full_name || user.username)
        .split(' ')
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase())
        .join('')
    : 'U'

  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-background/95 backdrop-blur-sm px-4 flex-shrink-0 z-10">
      {/* Hamburger */}
      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Menu className="h-4.5 w-4.5 h-[18px] w-[18px]" />
      </motion.button>

      {/* Global search */}
      <motion.div
        animate={{ width: searchFocused ? '100%' : '360px' }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="relative flex-1 max-w-xl"
        style={{ maxWidth: searchFocused ? '100%' : 360 }}
      >
        <div
          className={cn(
            'flex items-center gap-2 rounded-lg border px-3 h-9 transition-all duration-200',
            searchFocused
              ? 'border-primary/50 bg-background ring-2 ring-primary/20'
              : 'border-border bg-muted/50 hover:border-border/80'
          )}
        >
          <Search
            className={cn(
              'h-3.5 w-3.5 flex-shrink-0 transition-colors',
              searchFocused ? 'text-primary' : 'text-muted-foreground'
            )}
          />
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search across logs, jira, docs, releases..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none min-w-0"
          />

          <AnimatePresence>
            {searchQuery ? (
              <motion.button
                key="clear"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => setSearchQuery('')}
                className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </motion.button>
            ) : (
              <motion.kbd
                key="kbd"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="hidden sm:flex items-center gap-0.5 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground flex-shrink-0"
              >
                <span>⌘</span>K
              </motion.kbd>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Right actions */}
      <div className="ml-auto flex items-center gap-1.5">
        {/* Theme toggle */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={cycleTheme}
          aria-label={`Switch to next theme (current: ${theme})`}
          title={`Theme: ${theme}`}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <AnimatePresence mode="wait">
            <motion.span
              key={theme}
              initial={{ rotate: -30, opacity: 0, scale: 0.8 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: 30, opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.18 }}
              className="flex items-center justify-center"
            >
              {React.createElement(currentThemeIcon, { className: 'h-4 w-4' })}
            </motion.span>
          </AnimatePresence>
        </motion.button>

        {/* Notification bell */}
        <div ref={notifRef} className="relative">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              setNotifOpen((v) => !v)
              setUserMenuOpen(false)
            }}
            aria-label={`Notifications (${notifications} unread)`}
            className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Bell className="h-4 w-4" />
            {notifications > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground leading-none"
              >
                {notifications > 9 ? '9+' : notifications}
              </motion.span>
            )}
          </motion.button>

          <AnimatePresence>
            {notifOpen && (
              <NotificationDropdown
                count={notifications}
                onClose={() => setNotifOpen(false)}
              />
            )}
          </AnimatePresence>
        </div>

        {/* User avatar / menu */}
        <div ref={userMenuRef} className="relative ml-1">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => {
              setUserMenuOpen((v) => !v)
              setNotifOpen(false)
            }}
            aria-label="User menu"
            aria-expanded={userMenuOpen}
            className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {/* Avatar */}
            <div className="flex h-7 w-7 items-center justify-center rounded-full gradient-brand text-[11px] font-bold text-white flex-shrink-0">
              {initials}
            </div>

            <div className="hidden sm:flex flex-col items-start leading-none">
              <span className="text-xs font-semibold text-foreground">
                {user?.full_name || user?.username || 'User'}
              </span>
              <span className="text-[10px] text-muted-foreground capitalize">
                {user?.role ?? 'user'}
              </span>
            </div>

            <ChevronDown
              className={cn(
                'hidden sm:block h-3 w-3 text-muted-foreground transition-transform duration-200',
                userMenuOpen && 'rotate-180'
              )}
            />
          </motion.button>

          <AnimatePresence>
            {userMenuOpen && (
              <UserDropdown
                user={user}
                onClose={() => setUserMenuOpen(false)}
                onLogout={() => {
                  clearAuth()
                  setUserMenuOpen(false)
                }}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  )
}

// ─── Notification Dropdown ────────────────────────────────────────────────────

interface NotificationDropdownProps {
  count: number
  onClose: () => void
}

const SAMPLE_NOTIFS = [
  { id: '1', title: 'New release deployed', msg: 'v2.4.1 is live on production', time: '2m ago', unread: true },
  { id: '2', title: 'Jira issue escalated', msg: 'TRADE-1892 marked Critical', time: '15m ago', unread: true },
  { id: '3', title: 'Scan complete', msg: '2,847 files indexed successfully', time: '1h ago', unread: false },
]

const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ onClose }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95, y: -4 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.95, y: -4 }}
    transition={{ duration: 0.15 }}
    className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-border bg-popover shadow-lg z-50 overflow-hidden"
  >
    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
      <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
      <button
        onClick={onClose}
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
    <div className="max-h-72 overflow-y-auto">
      {SAMPLE_NOTIFS.map((n) => (
        <div
          key={n.id}
          className={cn(
            'flex gap-3 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-muted/50 cursor-pointer transition-colors',
            n.unread && 'bg-primary/5'
          )}
        >
          {n.unread && (
            <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
          )}
          {!n.unread && <span className="mt-1.5 h-2 w-2 flex-shrink-0" />}
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground">{n.title}</p>
            <p className="text-xs text-muted-foreground truncate">{n.msg}</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground/70">{n.time}</p>
          </div>
        </div>
      ))}
    </div>
    <div className="px-4 py-2.5 text-center">
      <button className="text-xs font-medium text-primary hover:underline">
        View all notifications
      </button>
    </div>
  </motion.div>
)

// ─── User Dropdown ────────────────────────────────────────────────────────────

interface UserDropdownProps {
  user: User | null
  onClose: () => void
  onLogout: () => void
}

const UserDropdown: React.FC<UserDropdownProps> = ({ user, onClose, onLogout }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95, y: -4 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.95, y: -4 }}
    transition={{ duration: 0.15 }}
    className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-border bg-popover shadow-lg z-50 overflow-hidden"
  >
    {/* User info */}
    <div className="px-4 py-3 border-b border-border">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full gradient-brand text-sm font-bold text-white flex-shrink-0">
          {(user?.full_name || user?.username || 'U')
            .split(' ')
            .slice(0, 2)
            .map((w: string) => w[0]?.toUpperCase())
            .join('')}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {user?.full_name || user?.username}
          </p>
          <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          <p className="text-[10px] text-muted-foreground capitalize bg-muted/60 rounded px-1 inline-block mt-0.5">
            {user?.role}
          </p>
        </div>
      </div>
    </div>

    {/* Menu items */}
    <div className="py-1.5">
      <MenuItem icon={UserIcon} label="My Profile" onClick={onClose} />
      <MenuItem icon={Settings} label="Settings" onClick={onClose} />
    </div>

    <div className="border-t border-border py-1.5">
      <MenuItem
        icon={LogOut}
        label="Sign Out"
        onClick={onLogout}
        className="text-destructive hover:text-destructive"
      />
    </div>
  </motion.div>
)

interface MenuItemProps {
  icon: React.ElementType
  label: string
  onClick: () => void
  className?: string
}

const MenuItem: React.FC<MenuItemProps> = ({ icon: Icon, label, onClick, className }) => (
  <button
    onClick={onClick}
    className={cn(
      'flex w-full items-center gap-2.5 px-4 py-2 text-sm font-medium text-foreground',
      'hover:bg-muted transition-colors text-left',
      className
    )}
  >
    <Icon className="h-4 w-4 text-muted-foreground" />
    {label}
  </button>
)

export default Header
