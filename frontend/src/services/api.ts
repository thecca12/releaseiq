import axios, { type AxiosInstance, type AxiosError } from 'axios'
import { useAuthStore } from '@/store/authStore'

const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1'

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearAuth()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export const authApi = {
  login: (username: string, password: string) =>
    apiClient.post('/auth/login', { username, password }),
  logout: () => apiClient.post('/auth/logout'),
  me: () => apiClient.get('/auth/me'),
  refreshToken: () => apiClient.post('/auth/refresh'),
  changePassword: (old_password: string, new_password: string) =>
    apiClient.post('/auth/change-password', { old_password, new_password }),
}

export const usersApi = {
  list: (params?: Record<string, unknown>) => apiClient.get('/users', { params }),
  get: (id: string) => apiClient.get(`/users/${id}`),
  create: (data: Record<string, unknown>) => apiClient.post('/users', data),
  update: (id: string, data: Record<string, unknown>) => apiClient.put(`/users/${id}`, data),
  delete: (id: string) => apiClient.delete(`/users/${id}`),
  resetPassword: (id: string) => apiClient.post(`/users/${id}/reset-password`),
  toggleActive: (id: string) => apiClient.post(`/users/${id}/toggle-active`),
}

export const chatApi = {
  sendMessage: (message: string, session_id?: string) =>
    apiClient.post('/chat/message', { message, session_id }),
  getHistory: (session_id: string) => apiClient.get(`/chat/history/${session_id}`),
  getSessions: () => apiClient.get('/chat/sessions'),
  deleteSession: (session_id: string) => apiClient.delete(`/chat/sessions/${session_id}`),
}

export const releasesApi = {
  list: (params?: Record<string, unknown>) => apiClient.get('/releases', { params }),
  get: (id: string) => apiClient.get(`/releases/${id}`),
  getHealth: () => apiClient.get('/releases/health/summary'),
  getClientReleases: (params?: Record<string, unknown>) =>
    apiClient.get('/releases/clients', { params }),
  updateClientRelease: (id: string, data: Record<string, unknown>) =>
    apiClient.put(`/releases/clients/${id}`, data),
}

export const issuesApi = {
  list: (params?: Record<string, unknown>) => apiClient.get('/issues', { params }),
  get: (id: string) => apiClient.get(`/issues/${id}`),
  search: (query: string) => apiClient.get('/issues/search', { params: { q: query } }),
}

export const logsApi = {
  list: (params?: Record<string, unknown>) => apiClient.get('/logs', { params }),
  getFiles: (params?: Record<string, unknown>) => apiClient.get('/logs/files', { params }),
  getFileEntries: (filename: string) => apiClient.get(`/logs/files/${encodeURIComponent(filename)}/entries`),
  getFileAnalysis: (filename: string) => apiClient.get(`/logs/files/${encodeURIComponent(filename)}/analyze`),
  search: (query: string, filters?: Record<string, unknown>) =>
    apiClient.post('/logs/search', { query, filters }),
  analyze: (log_id: string) => apiClient.post(`/logs/${log_id}/analyze`),
  getModules: () => apiClient.get('/logs/modules'),
}

export const documentsApi = {
  list: (params?: Record<string, unknown>) => apiClient.get('/documents', { params }),
  get: (id: string) => apiClient.get(`/documents/${id}`),
  upload: (formData: FormData) =>
    apiClient.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  reindex: () => apiClient.post('/documents/reindex'),
}

export const analyticsApi = {
  getDashboardStats: () => apiClient.get('/analytics/dashboard'),
  getReleaseAnalytics: (params?: Record<string, unknown>) =>
    apiClient.get('/analytics/releases', { params }),
  getIssueAnalytics: (params?: Record<string, unknown>) =>
    apiClient.get('/analytics/issues', { params }),
  getLogAnalytics: (params?: Record<string, unknown>) =>
    apiClient.get('/analytics/logs', { params }),
}

export const searchApi = {
  global: (query: string, filters?: Record<string, unknown>) =>
    apiClient.post('/search', { query, filters }),
}

export const emailsApi = {
  list: (params?: Record<string, unknown>) => apiClient.get('/emails', { params }),
  get: (id: string) => apiClient.get(`/emails/${id}`),
  send: (data: Record<string, unknown>) => apiClient.post('/emails/send', data),
  draft: (context: string) => apiClient.post('/emails/draft', { context }),
}

export const meetingsApi = {
  list: (params?: Record<string, unknown>) => apiClient.get('/meetings', { params }),
  get: (id: string) => apiClient.get(`/meetings/${id}`),
  create: (data: Record<string, unknown>) => apiClient.post('/meetings', data),
  update: (id: string, data: Record<string, unknown>) => apiClient.put(`/meetings/${id}`, data),
  generateMOM: (id: string) => apiClient.post(`/meetings/${id}/generate-mom`),
}

export const knowledgeApi = {
  getErrorCodes: (params?: Record<string, unknown>) =>
    apiClient.get('/knowledge/error-codes', { params }),
  getCirculars: (params?: Record<string, unknown>) =>
    apiClient.get('/knowledge/circulars', { params }),
  getFlags: (params?: Record<string, unknown>) => apiClient.get('/knowledge/flags', { params }),
  getGreekCodes: (params?: Record<string, unknown>) =>
    apiClient.get('/knowledge/greek-codes', { params }),
  getTestCases: (params?: Record<string, unknown>) =>
    apiClient.get('/knowledge/test-cases', { params }),
}

export const indexingApi = {
  getStatus: () => apiClient.get('/indexing/status'),
  startReindex: (folder?: string) => apiClient.post('/indexing/reindex', { folder }),
  setRootFolder: (path: string) => apiClient.post('/indexing/root-folder', { path }),
  getStats: () => apiClient.get('/indexing/stats'),
}

export const patchNotesApi = {
  list: (params?: Record<string, unknown>) => apiClient.get('/patch-notes', { params }),
  get: (version: string) => apiClient.get(`/patch-notes/${version}`),
  compare: (v1: string, v2: string) => apiClient.get('/patch-notes/compare', { params: { v1, v2 } }),
  search: (q: string) => apiClient.get('/patch-notes/search', { params: { q } }),
}

export const utilitiesApi = {
  list: () => apiClient.get('/utilities'),
  download: (filename: string) => apiClient.get(`/utilities/${filename}/download`, { responseType: 'blob' }),
}

export const clientReleasesApi = {
  list: (params?: Record<string, unknown>) => apiClient.get('/client-releases', { params }),
  stats: () => apiClient.get('/client-releases/stats'),
  get: (clientId: string) => apiClient.get(`/client-releases/${clientId}`),
}
