export type UserRole = 'admin' | 'manager' | 'user'

export interface User {
  id: string
  email: string
  username: string
  full_name: string
  role: UserRole
  is_active: boolean
  created_at: string
  last_login?: string
  avatar_url?: string
}

export interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
}

export interface LoginCredentials {
  username: string
  password: string
}

export interface Release {
  id: string
  version: string
  release_date: string
  type: 'qa' | 'live'
  status: 'healthy' | 'warning' | 'critical'
  module: string
  description?: string
  jira_ids?: string[]
  clients?: string[]
  health_score: number
}

export interface JiraIssue {
  id: string
  jira_id: string
  title: string
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed'
  priority: 'Low' | 'Medium' | 'High' | 'Critical'
  assignee?: string
  created_at: string
  updated_at: string
  module?: string
  affected_versions?: string[]
  description?: string
}

export interface LogFile {
  id: string
  filename: string
  module: string
  size_bytes: number
  indexed_at: string
  log_type: 'fix' | 'server' | 'client' | 'rms' | 'oms'
  entry_count: number
  error_count: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  sources?: MessageSource[]
  confidence?: number
  is_loading?: boolean
}

export interface MessageSource {
  type: 'jira' | 'log' | 'release_note' | 'patch_note' | 'document'
  reference: string
  snippet?: string
}

export interface DashboardStats {
  files_indexed: number
  jira_issues: number
  releases: number
  log_files: number
  documents: number
  active_clients: number
}

export interface Client {
  id: string
  name: string
  current_version: string
  previous_version?: string
  deployment_date: string
  environment: 'production' | 'uat' | 'staging'
  exchange: string
  modules: string[]
  owner?: string
  health_status: 'healthy' | 'warning' | 'critical'
}

export interface Notification {
  id: string
  title: string
  message: string
  type: 'info' | 'warning' | 'error' | 'success'
  timestamp: string
  is_read: boolean
}

export interface SearchResult {
  id: string
  type: 'jira' | 'log' | 'release' | 'document' | 'email' | 'meeting'
  title: string
  snippet: string
  relevance_score: number
  metadata: Record<string, string>
}

export interface Email {
  id: string
  subject: string
  from_address: string
  to_addresses: string[]
  body: string
  received_at: string
  type: 'support' | 'deployment' | 'rca' | 'escalation' | 'release' | 'client'
  is_read: boolean
  attachments?: string[]
}

export interface Meeting {
  id: string
  title: string
  scheduled_at: string
  duration_minutes: number
  attendees: string[]
  type: 'release' | 'rca' | 'client' | 'qa' | 'general'
  status: 'scheduled' | 'completed' | 'cancelled'
  notes?: string
  action_items?: string[]
  mom_generated?: boolean
}

export interface ErrorCode {
  code: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  module: string
  resolution?: string
  root_cause?: string
}

export interface ExchangeCircular {
  id: string
  exchange: 'NSE' | 'BSE' | 'MCX' | 'SEBI'
  circular_no: string
  title: string
  issued_date: string
  effective_date?: string
  category: string
  summary?: string
  impact_analysis?: string
  document_url?: string
}

export interface FlagDetail {
  id: string
  name: string
  value: string
  type: 'trading_style' | 'ini_config' | 'runtime' | 'exchange'
  module: string
  description?: string
  default_value?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface ApiError {
  detail: string
  status_code: number
}

export type Theme = 'light' | 'dark' | 'system'
