import React, { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { analyticsApi } from '@/services/api'
import {
  Bot,
  LayoutDashboard,
  Search,
  Package,
  Bug,
  ScrollText,
  FileText,
  BarChart3,
  Settings,
  Mail,
  CalendarDays,
  Globe,
  AlertCircle,
  TestTube2,
  Flag,
  BookOpen,
  Users,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  RefreshCw,
  FolderInput,
  HelpCircle,
  ExternalLink,
  CheckCircle2,
  ChevronDown,
  FileStack,
  Wrench,
  HardDriveDownload,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { useUIStore } from '@/store/uiStore'
import greeksFtLogo from '@/assets/greeks-ft-logo.svg'
import greeksFtIcon from '@/assets/greeks-ft-icon.svg'

// ─── Nav item definitions ─────────────────────────────────────────────────────

interface NavItem {
  label: string
  icon: React.ElementType
  path: string
}

const MAIN_NAV: NavItem[] = [
  { label: 'AI Chat Assistant', icon: Bot, path: '/chat' },
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Search', icon: Search, path: '/search' },
  { label: 'Releases', icon: Package, path: '/releases' },
  { label: 'Jira Issues', icon: Bug, path: '/jira' },
  { label: 'Logs Explorer', icon: ScrollText, path: '/logs' },
  { label: 'Documents', icon: FileText, path: '/documents' },
  { label: 'Analytics', icon: BarChart3, path: '/analytics' },
  { label: 'Settings', icon: Settings, path: '/settings' },
]

const MORE_MODULES: NavItem[] = [
  { label: 'Emails', icon: Mail, path: '/emails' },
  { label: 'Meetings', icon: CalendarDays, path: '/meetings' },
  { label: 'Exchange Circulars', icon: Globe, path: '/circulars' },
  { label: 'Error Codes', icon: AlertCircle, path: '/error-codes' },
  { label: 'Test Cases', icon: TestTube2, path: '/test-cases' },
  { label: 'Flags', icon: Flag, path: '/flags' },
  { label: 'Greek Codes', icon: BookOpen, path: '/greek-codes' },
  { label: 'Client Releases', icon: Users, path: '/clients' },
  { label: 'Patch/Release Notes', icon: FileStack, path: '/patch-notes' },
  { label: 'Utilities', icon: Wrench, path: '/utilities' },
  { label: 'Project Backup', icon: HardDriveDownload, path: '/backup' },
]

// ─── Quick stats colors config ────────────────────────────────────────────────

const STATS_CONFIG = [
  { label: 'Files Indexed',  key: 'files_indexed',  color: 'text-violet-500 dark:text-violet-400' },
  { label: 'Jira Issues',    key: 'jira_issues',    color: 'text-blue-500 dark:text-blue-400' },
  { label: 'Releases',       key: 'releases',       color: 'text-emerald-500 dark:text-emerald-400' },
  { label: 'Log Files',      key: 'log_files',      color: 'text-amber-500 dark:text-amber-400' },
  { label: 'Documents',      key: 'documents',      color: 'text-pink-500 dark:text-pink-400' },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

interface NavItemRowProps {
  item: NavItem
  collapsed: boolean
}

const NavItemRow: React.FC<NavItemRowProps> = ({ item, collapsed }) => {
  const Icon = item.icon

  return (
    <NavLink
      to={item.path}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
          isActive
            ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary'
            : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            className={cn(
              'flex-shrink-0 transition-colors',
              collapsed ? 'h-5 w-5' : 'h-4 w-4',
              isActive
                ? 'text-primary'
                : 'text-muted-foreground group-hover:text-sidebar-accent-foreground'
            )}
          />
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.18, ease: 'easeInOut' }}
                className="overflow-hidden whitespace-nowrap"
              >
                {item.label}
              </motion.span>
            )}
          </AnimatePresence>
          {isActive && !collapsed && (
            <motion.div
              layoutId="active-pill"
              className="ml-auto h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0"
            />
          )}
        </>
      )}
    </NavLink>
  )
}

// ─── Main Sidebar ─────────────────────────────────────────────────────────────

export const Sidebar: React.FC = () => {
  const { sidebarCollapsed, toggleSidebar } = useUIStore()
  const [moreExpanded, setMoreExpanded] = useState(true)
  const collapsed = sidebarCollapsed

  // Fetch real stats from backend for sidebar quick stats
  const { data: statsData } = useQuery({
    queryKey: ['sidebar-stats'],
    queryFn: async () => {
      try {
        const res = await analyticsApi.getDashboardStats()
        return res.data as Record<string, number>
      } catch { return null }
    },
    staleTime: 5 * 60 * 1000,
  })

  const quickStats = STATS_CONFIG.map((cfg) => ({
    label: cfg.label,
    value: statsData ? (statsData[cfg.key] ?? 0).toLocaleString() : '…',
    color: cfg.color,
  }))

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 230 }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        'relative flex h-screen flex-col border-r border-sidebar-border',
        'bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))]',
        'overflow-hidden flex-shrink-0'
      )}
    >
      {/* ── Toggle button ── */}
      <button
        onClick={toggleSidebar}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className={cn(
          'absolute -right-3 top-[72px] z-20 flex h-6 w-6 items-center justify-center',
          'rounded-full border border-sidebar-border bg-background shadow-sm',
          'hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
        )}
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ChevronLeft className="h-3 w-3 text-muted-foreground" />
        )}
      </button>

      {/* ── Logo / Brand ── */}
      <div
        className={cn(
          'flex h-16 items-center border-b border-sidebar-border flex-shrink-0',
          collapsed ? 'justify-center px-0' : 'px-3'
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          {collapsed ? (
            <motion.img
              key="icon"
              src={greeksFtIcon}
              alt="Greeks FT"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.18 }}
              className="h-8 w-8 object-contain flex-shrink-0"
            />
          ) : (
            <motion.img
              key="logo"
              src={greeksFtLogo}
              alt="Greeks FT"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
              className="h-9 w-auto object-contain max-w-full"
            />
          )}
        </AnimatePresence>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-3 space-y-1">
        {/* Main nav */}
        <nav className={cn('px-2', collapsed && 'flex flex-col items-center')}>
          {MAIN_NAV.map((item) => (
            <NavItemRow key={item.path} item={item} collapsed={collapsed} />
          ))}
        </nav>

        {/* More modules section */}
        <div className="px-2 pt-3">
          {!collapsed ? (
            <>
              <button
                onClick={() => setMoreExpanded((v) => !v)}
                className="flex w-full items-center justify-between px-2.5 py-1 mb-1"
              >
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                  More Modules
                </span>
                <ChevronDown
                  className={cn(
                    'h-3 w-3 text-muted-foreground/60 transition-transform duration-200',
                    moreExpanded && 'rotate-180'
                  )}
                />
              </button>
              <AnimatePresence initial={false}>
                {moreExpanded && (
                  <motion.nav
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    {MORE_MODULES.map((item) => (
                      <NavItemRow key={item.path} item={item} collapsed={collapsed} />
                    ))}
                  </motion.nav>
                )}
              </AnimatePresence>
            </>
          ) : (
            <nav className="flex flex-col items-center gap-0.5">
              {MORE_MODULES.map((item) => (
                <NavItemRow key={item.path} item={item} collapsed={collapsed} />
              ))}
            </nav>
          )}
        </div>
      </div>

      {/* ── Bottom panels (hidden when collapsed) ── */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex-shrink-0 border-t border-sidebar-border"
          >
            {/* Data Source */}
            <DataSourcePanel />

            {/* Quick Stats */}
            <QuickStatsPanel stats={quickStats} />

            {/* Help */}
            <HelpPanel />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  )
}

// ─── Data Source Panel ────────────────────────────────────────────────────────

const DataSourcePanel: React.FC = () => (
  <div className="px-3 py-3 border-b border-sidebar-border">
    <div className="mb-2 flex items-center justify-between">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
        Data Source
      </span>
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="h-2.5 w-2.5" />
        Connected
      </span>
    </div>

    <div className="mb-2 flex items-center gap-1.5 rounded-md bg-muted/60 px-2 py-1.5">
      <FolderOpen className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
      <span className="truncate text-[10px] font-medium text-muted-foreground">
        /data/releaseiq/root
      </span>
    </div>

    <div className="flex gap-1.5">
      <button className="flex flex-1 items-center justify-center gap-1 rounded-md bg-primary/10 px-2 py-1.5 text-[10px] font-medium text-primary hover:bg-primary/20 transition-colors">
        <RefreshCw className="h-2.5 w-2.5" />
        Re-scan &amp; Index
      </button>
      <button className="flex flex-1 items-center justify-center gap-1 rounded-md bg-muted px-2 py-1.5 text-[10px] font-medium text-muted-foreground hover:bg-muted/80 transition-colors">
        <FolderInput className="h-2.5 w-2.5" />
        Change Folder
      </button>
    </div>
  </div>
)

// ─── Quick Stats Panel ────────────────────────────────────────────────────────

const QuickStatsPanel: React.FC<{ stats: Array<{ label: string; value: string; color: string }> }> = ({ stats }) => (
  <div className="px-3 py-3 border-b border-sidebar-border">
    <span className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
      Quick Stats
    </span>
    <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
      {stats.map((stat) => (
        <div key={stat.label} className="flex flex-col">
          <span className={cn('text-sm font-bold leading-none', stat.color)}>
            {stat.value}
          </span>
          <span className="mt-0.5 text-[9px] text-muted-foreground leading-tight">
            {stat.label}
          </span>
        </div>
      ))}
    </div>
  </div>
)

// ─── Help Panel ───────────────────────────────────────────────────────────────

const HelpPanel: React.FC = () => (
  <div className="px-3 py-3">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Need Help?</span>
      </div>
      <button className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors">
        View Guide
        <ExternalLink className="h-2.5 w-2.5" />
      </button>
    </div>
  </div>
)

export default Sidebar
