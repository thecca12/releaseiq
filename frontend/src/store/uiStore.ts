import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Theme } from '@/types'

interface UIState {
  theme: Theme
  sidebarCollapsed: boolean
  activeModule: string
  notifications: number
}

interface UIActions {
  setTheme: (theme: Theme) => void
  toggleSidebar: () => void
  setActiveModule: (module: string) => void
  setNotifications: (count: number) => void
}

export const useUIStore = create<UIState & UIActions>()(
  persist(
    (set) => ({
      theme: 'light',
      sidebarCollapsed: false,
      activeModule: 'chat',
      notifications: 3,
      setTheme: (theme) => {
        set({ theme })
        const root = document.documentElement
        root.classList.remove('light', 'dark')
        if (theme === 'system') {
          const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
          root.classList.add(systemDark ? 'dark' : 'light')
        } else {
          root.classList.add(theme)
        }
      },
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setActiveModule: (activeModule) => set({ activeModule }),
      setNotifications: (notifications) => set({ notifications }),
    }),
    {
      name: 'releaseiq-ui',
      partialize: (state) => ({ theme: state.theme, sidebarCollapsed: state.sidebarCollapsed }),
    }
  )
)
