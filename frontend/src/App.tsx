import React, { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { AppLayout } from '@/components/layout/AppLayout'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'

// ── Eager imports (auth critical) ────────────────────────────────────────────
import LoginPage from '@/components/auth/LoginPage'

// ── Lazy imports (pages) ────────────────────────────────────────────────────
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const ChatPage = lazy(() => import('@/pages/ChatPage'))
const ReleasesPage = lazy(() => import('@/pages/ReleasesPage'))
const JiraIssuesPage = lazy(() => import('@/pages/JiraIssuesPage'))
const LogsExplorerPage = lazy(() => import('@/pages/LogsExplorerPage'))
const DocumentsPage = lazy(() => import('@/pages/DocumentsPage'))
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))
const UsersPage = lazy(() => import('@/pages/UsersPage'))
const EmailsPage = lazy(() => import('@/pages/EmailsPage'))
const MeetingsPage = lazy(() => import('@/pages/MeetingsPage'))
const SearchPage = lazy(() => import('@/pages/SearchPage'))
const ErrorCodesPage = lazy(() => import('@/pages/ErrorCodesPage'))
const FlagsPage = lazy(() => import('@/pages/FlagsPage'))
const ClientReleasesPage = lazy(() => import('@/pages/ClientReleasesPage'))
const PatchNotesPage = lazy(() => import('@/pages/PatchNotesPage'))
const UtilitiesPage = lazy(() => import('@/pages/UtilitiesPage'))
const TestCasesPage = lazy(() => import('@/pages/TestCasesPage'))
const GreekCodesPage = lazy(() => import('@/pages/GreekCodesPage'))
const CircularsPage = lazy(() => import('@/pages/CircularsPage'))

// ── Auth guard ───────────────────────────────────────────────────────────────
const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore()
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

// ── Page wrapper: suspense + error boundary ──────────────────────────────────
const Page: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ErrorBoundary>
    <Suspense fallback={<LoadingSpinner centered size="lg" label="Loading..." />}>
      {children}
    </Suspense>
  </ErrorBoundary>
)

// ── App ───────────────────────────────────────────────────────────────────────
const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected */}
        <Route
          path="/"
          element={
            <RequireAuth>
              <ErrorBoundary>
                <AppLayout />
              </ErrorBoundary>
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"    element={<Page><DashboardPage /></Page>} />
          <Route path="chat"         element={<Page><ChatPage /></Page>} />
          <Route path="releases"     element={<Page><ReleasesPage /></Page>} />
          <Route path="jira"         element={<Page><JiraIssuesPage /></Page>} />
          <Route path="logs"         element={<Page><LogsExplorerPage /></Page>} />
          <Route path="search"       element={<Page><SearchPage /></Page>} />
          <Route path="documents"    element={<Page><DocumentsPage /></Page>} />
          <Route path="analytics"    element={<Page><AnalyticsPage /></Page>} />
          <Route path="settings"     element={<Page><SettingsPage /></Page>} />
          <Route path="users"        element={<Page><UsersPage /></Page>} />
          <Route path="emails"       element={<Page><EmailsPage /></Page>} />
          <Route path="meetings"     element={<Page><MeetingsPage /></Page>} />
          <Route path="circulars"    element={<Page><CircularsPage /></Page>} />
          <Route path="error-codes"  element={<Page><ErrorCodesPage /></Page>} />
          <Route path="flags"        element={<Page><FlagsPage /></Page>} />
          <Route path="clients"      element={<Page><ClientReleasesPage /></Page>} />
          <Route path="patch-notes"  element={<Page><PatchNotesPage /></Page>} />
          <Route path="utilities"    element={<Page><UtilitiesPage /></Page>} />
          <Route path="test-cases"   element={<Page><TestCasesPage /></Page>} />
          <Route path="greek-codes"  element={<Page><GreekCodesPage /></Page>} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
