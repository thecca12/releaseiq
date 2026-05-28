import React from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { cn } from '@/utils/cn'
import { useUIStore } from '@/store/uiStore'

export const AppLayout: React.FC = () => {
  const { sidebarCollapsed } = useUIStore()

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* ── Sidebar ── */}
      <Sidebar />

      {/* ── Main column (header + content) ── */}
      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col overflow-hidden transition-all duration-200',
          sidebarCollapsed ? 'ml-0' : 'ml-0'
        )}
      >
        {/* Header */}
        <Header />

        {/* Page content — no opacity animation so it's never invisible */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-muted/20 dark:bg-background">
          <div className="h-full w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

export default AppLayout
