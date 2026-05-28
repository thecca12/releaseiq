import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Settings,
  Database,
  Brain,
  Bell,
  Shield,
  Info,
  Save,
  CheckCircle2,
  Server,
  Clock,
  FolderOpen,
  Mail,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { PageHeader } from '@/components/shared/PageHeader'

// ─── Section wrapper ──────────────────────────────────────────────────────────

const Section: React.FC<{ title: string; description?: string; children: React.ReactNode }> = ({ title, description, children }) => (
  <div className="space-y-4">
    <div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
    </div>
    <div className="space-y-4">{children}</div>
    <Separator />
  </div>
)

const FormRow: React.FC<{ label: string; description?: string; children: React.ReactNode; htmlFor?: string }> = ({ label, description, children, htmlFor }) => (
  <div className="flex items-start justify-between gap-8">
    <div className="flex-1 min-w-0">
      <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">{label}</Label>
      {description && <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{description}</p>}
    </div>
    <div className="flex-shrink-0 w-64">{children}</div>
  </div>
)

const SaveButton: React.FC<{ onSave: () => void; saved?: boolean }> = ({ onSave, saved }) => (
  <div className="flex justify-end pt-2">
    <Button size="sm" className="gap-1.5" onClick={onSave}>
      {saved ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" /> : <Save className="h-3.5 w-3.5" />}
      {saved ? 'Saved!' : 'Save Changes'}
    </Button>
  </div>
)

// ─── Page ─────────────────────────────────────────────────────────────────────

const SettingsPage: React.FC = () => {
  const [saved, setSaved] = useState<Record<string, boolean>>({})

  // General
  const [appName, setAppName] = useState('ReleaseIQ Enterprise')
  const [timezone, setTimezone] = useState('Asia/Kolkata')
  const [language, setLanguage] = useState('en')

  // Indexing
  const [rootFolder, setRootFolder] = useState('/opt/oms/release')
  const [schedule, setSchedule] = useState('0 2 * * *')
  const [includeTypes, setIncludeTypes] = useState('.java,.xml,.properties,.log,.txt,.json')
  const [excludeTypes, setExcludeTypes] = useState('.class,.jar,.war,.zip')
  const [autoReindex, setAutoReindex] = useState(true)
  const [deepIndex, setDeepIndex] = useState(false)

  // AI
  const [aiModel, setAiModel] = useState('llama3')
  const [aiEndpoint, setAiEndpoint] = useState('http://localhost:11434')
  const [temperature, setTemperature] = useState('0.3')
  const [maxTokens, setMaxTokens] = useState('2048')
  const [streamResponses, setStreamResponses] = useState(true)

  // Notifications
  const [emailAlerts, setEmailAlerts] = useState(true)
  const [alertEmail, setAlertEmail] = useState('admin@greeksoft.co.in')
  const [criticalThreshold, setCriticalThreshold] = useState('3')
  const [releaseAlerts, setReleaseAlerts] = useState(true)
  const [dailyDigest, setDailyDigest] = useState(false)

  // Security
  const [sessionTimeout, setSessionTimeout] = useState('480')
  const [minPasswordLength, setMinPasswordLength] = useState('8')
  const [requireMfa, setRequireMfa] = useState(false)
  const [auditLogs, setAuditLogs] = useState(true)

  const handleSave = (tab: string) => {
    setSaved((prev) => ({ ...prev, [tab]: true }))
    setTimeout(() => setSaved((prev) => ({ ...prev, [tab]: false })), 2000)
  }

  const tabItems = [
    { value: 'general', label: 'General', icon: Settings },
    { value: 'indexing', label: 'Indexing', icon: Database },
    { value: 'ai', label: 'AI', icon: Brain },
    { value: 'notifications', label: 'Notifications', icon: Bell },
    { value: 'security', label: 'Security', icon: Shield },
    { value: 'about', label: 'About', icon: Info },
  ]

  return (
    <div className="p-6">
      <PageHeader
        title="Settings"
        subtitle="Configure ReleaseIQ system preferences, AI model, indexing schedule, and security policies."
      />

      <Tabs defaultValue="general">
        <TabsList className="mb-6 flex-wrap h-auto gap-1 p-1.5">
          {tabItems.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="gap-1.5 text-xs">
              <Icon className="h-3.5 w-3.5" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── General ── */}
        <TabsContent value="general">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Settings className="h-4 w-4" /> General Settings</CardTitle>
                <CardDescription>Basic application configuration and locale preferences.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Section title="Application">
                  <FormRow label="Application Name" description="Displayed in the header and emails." htmlFor="app-name">
                    <Input id="app-name" value={appName} onChange={(e) => setAppName(e.target.value)} className="h-9" />
                  </FormRow>
                </Section>
                <Section title="Locale">
                  <FormRow label="Timezone" description="Used for scheduling and timestamps." htmlFor="timezone">
                    <Select value={timezone} onValueChange={setTimezone}>
                      <SelectTrigger id="timezone" className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</SelectItem>
                        <SelectItem value="UTC">UTC (+0:00)</SelectItem>
                        <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
                        <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                        <SelectItem value="Asia/Singapore">Asia/Singapore (SGT +8:00)</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormRow>
                  <FormRow label="Language" htmlFor="language">
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger id="language" className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="hi">Hindi</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormRow>
                </Section>
                <SaveButton onSave={() => handleSave('general')} saved={saved.general} />
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* ── Indexing ── */}
        <TabsContent value="indexing">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Database className="h-4 w-4" /> Indexing Configuration</CardTitle>
                <CardDescription>Control how files are discovered, indexed, and scheduled.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Section title="File Source">
                  <FormRow label="Root Folder Path" description="Absolute path to the source directory." htmlFor="root-folder">
                    <div className="relative">
                      <FolderOpen className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input id="root-folder" value={rootFolder} onChange={(e) => setRootFolder(e.target.value)} className="pl-8 h-9 font-mono text-xs" />
                    </div>
                  </FormRow>
                  <FormRow label="File Types to Include" description="Comma-separated extensions." htmlFor="include-types">
                    <Input id="include-types" value={includeTypes} onChange={(e) => setIncludeTypes(e.target.value)} className="h-9 font-mono text-xs" />
                  </FormRow>
                  <FormRow label="File Types to Exclude" description="Comma-separated extensions." htmlFor="exclude-types">
                    <Input id="exclude-types" value={excludeTypes} onChange={(e) => setExcludeTypes(e.target.value)} className="h-9 font-mono text-xs" />
                  </FormRow>
                </Section>
                <Section title="Schedule">
                  <FormRow label="Indexing Schedule (Cron)" description="When to automatically re-index." htmlFor="schedule">
                    <div className="relative">
                      <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input id="schedule" value={schedule} onChange={(e) => setSchedule(e.target.value)} className="pl-8 h-9 font-mono text-xs" />
                    </div>
                  </FormRow>
                  <FormRow label="Auto Re-index on File Change" description="Watch filesystem and re-index on modification.">
                    <Switch checked={autoReindex} onCheckedChange={setAutoReindex} />
                  </FormRow>
                  <FormRow label="Deep Content Indexing" description="Extract and index document content (slower).">
                    <Switch checked={deepIndex} onCheckedChange={setDeepIndex} />
                  </FormRow>
                </Section>
                <SaveButton onSave={() => handleSave('indexing')} saved={saved.indexing} />
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* ── AI ── */}
        <TabsContent value="ai">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Brain className="h-4 w-4" /> AI Model Configuration</CardTitle>
                <CardDescription>Configure the local LLM endpoint and inference parameters.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Section title="Model Selection">
                  <FormRow label="AI Model" description="The LLM to use for chat and analysis." htmlFor="ai-model">
                    <Select value={aiModel} onValueChange={setAiModel}>
                      <SelectTrigger id="ai-model" className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="llama3">Llama 3 (8B)</SelectItem>
                        <SelectItem value="llama3-70b">Llama 3 (70B)</SelectItem>
                        <SelectItem value="mistral">Mistral 7B</SelectItem>
                        <SelectItem value="mistral-instruct">Mistral Instruct 7B</SelectItem>
                        <SelectItem value="deepseek">DeepSeek Coder 6.7B</SelectItem>
                        <SelectItem value="deepseek-33b">DeepSeek 33B</SelectItem>
                        <SelectItem value="codellama">CodeLlama 13B</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormRow>
                  <FormRow label="AI Endpoint URL" description="Ollama or compatible API endpoint." htmlFor="ai-endpoint">
                    <div className="relative">
                      <Server className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input id="ai-endpoint" value={aiEndpoint} onChange={(e) => setAiEndpoint(e.target.value)} className="pl-8 h-9 font-mono text-xs" />
                    </div>
                  </FormRow>
                </Section>
                <Section title="Inference Parameters">
                  <FormRow label="Temperature" description="Controls randomness (0 = deterministic, 1 = creative).">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Input type="number" min="0" max="1" step="0.1" value={temperature} onChange={(e) => setTemperature(e.target.value)} className="h-9 w-24 font-mono text-xs" />
                        <span className="text-xs text-muted-foreground">{temperature}</span>
                      </div>
                      <Progress value={parseFloat(temperature) * 100} className="h-1.5" />
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Precise</span><span>Creative</span>
                      </div>
                    </div>
                  </FormRow>
                  <FormRow label="Max Tokens" description="Maximum response length in tokens." htmlFor="max-tokens">
                    <Select value={maxTokens} onValueChange={setMaxTokens}>
                      <SelectTrigger id="max-tokens" className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="512">512</SelectItem>
                        <SelectItem value="1024">1024</SelectItem>
                        <SelectItem value="2048">2048</SelectItem>
                        <SelectItem value="4096">4096</SelectItem>
                        <SelectItem value="8192">8192</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormRow>
                  <FormRow label="Stream Responses" description="Show AI response tokens as they generate.">
                    <Switch checked={streamResponses} onCheckedChange={setStreamResponses} />
                  </FormRow>
                </Section>
                <SaveButton onSave={() => handleSave('ai')} saved={saved.ai} />
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* ── Notifications ── */}
        <TabsContent value="notifications">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4" /> Notification Settings</CardTitle>
                <CardDescription>Configure alerts and threshold-based notifications.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Section title="Email Alerts">
                  <FormRow label="Enable Email Alerts" description="Receive notifications via email.">
                    <Switch checked={emailAlerts} onCheckedChange={setEmailAlerts} />
                  </FormRow>
                  {emailAlerts && (
                    <FormRow label="Alert Email Address" description="Where to send critical alerts." htmlFor="alert-email">
                      <div className="relative">
                        <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input id="alert-email" value={alertEmail} onChange={(e) => setAlertEmail(e.target.value)} className="pl-8 h-9 text-sm" />
                      </div>
                    </FormRow>
                  )}
                </Section>
                <Section title="Thresholds">
                  <FormRow label="Critical Issue Threshold" description="Alert when critical issues exceed this count." htmlFor="critical-threshold">
                    <Input id="critical-threshold" type="number" min="1" value={criticalThreshold} onChange={(e) => setCriticalThreshold(e.target.value)} className="h-9 w-24" />
                  </FormRow>
                  <FormRow label="Release Deployment Alerts" description="Notify when a new release is deployed.">
                    <Switch checked={releaseAlerts} onCheckedChange={setReleaseAlerts} />
                  </FormRow>
                  <FormRow label="Daily Digest" description="Receive a daily summary email at 8:00 AM IST.">
                    <Switch checked={dailyDigest} onCheckedChange={setDailyDigest} />
                  </FormRow>
                </Section>
                <SaveButton onSave={() => handleSave('notifications')} saved={saved.notifications} />
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* ── Security ── */}
        <TabsContent value="security">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" /> Security Settings</CardTitle>
                <CardDescription>Session management, password policies, and audit configuration.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Section title="Session">
                  <FormRow label="Session Timeout (minutes)" description="Auto-logout inactive users after this duration." htmlFor="session-timeout">
                    <Select value={sessionTimeout} onValueChange={setSessionTimeout}>
                      <SelectTrigger id="session-timeout" className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30 minutes</SelectItem>
                        <SelectItem value="60">1 hour</SelectItem>
                        <SelectItem value="240">4 hours</SelectItem>
                        <SelectItem value="480">8 hours</SelectItem>
                        <SelectItem value="1440">24 hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormRow>
                  <FormRow label="Require MFA" description="Enforce two-factor authentication for all users.">
                    <Switch checked={requireMfa} onCheckedChange={setRequireMfa} />
                  </FormRow>
                </Section>
                <Section title="Password Policy">
                  <FormRow label="Minimum Password Length" description="Minimum characters required for new passwords." htmlFor="min-pw">
                    <Select value={minPasswordLength} onValueChange={setMinPasswordLength}>
                      <SelectTrigger id="min-pw" className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="6">6 characters</SelectItem>
                        <SelectItem value="8">8 characters</SelectItem>
                        <SelectItem value="10">10 characters</SelectItem>
                        <SelectItem value="12">12 characters</SelectItem>
                        <SelectItem value="16">16 characters</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormRow>
                </Section>
                <Section title="Audit">
                  <FormRow label="Enable Audit Logs" description="Log all user actions for compliance and debugging.">
                    <Switch checked={auditLogs} onCheckedChange={setAuditLogs} />
                  </FormRow>
                </Section>
                <SaveButton onSave={() => handleSave('security')} saved={saved.security} />
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* ── About ── */}
        <TabsContent value="about">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Info className="h-4 w-4" /> About ReleaseIQ</CardTitle>
                <CardDescription>Version information and system health status.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Application Version', value: 'v1.4.2' },
                    { label: 'Build Number', value: '#2025052801' },
                    { label: 'API Version', value: 'v1' },
                    { label: 'Release Date', value: 'May 28, 2025' },
                    { label: 'License', value: 'Enterprise' },
                    { label: 'Organization', value: 'GreekSoft Technologies' },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
                      <p className="mt-1 text-sm font-semibold text-foreground font-mono">{value}</p>
                    </div>
                  ))}
                </div>
                <Separator />
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-3">System Status</h4>
                  <div className="space-y-2.5">
                    {[
                      { service: 'API Server', latency: '12ms' },
                      { service: 'AI Model (Llama 3)', latency: '240ms' },
                      { service: 'Indexing Engine', latency: '8ms' },
                      { service: 'Database', latency: '3ms' },
                      { service: 'Search Index', latency: '15ms' },
                    ].map(({ service, latency }) => (
                      <div key={service} className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          <span className="text-sm text-foreground">{service}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">{latency}</span>
                          <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 rounded-full px-2 py-0.5">operational</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>ReleaseIQ — AI-powered release intelligence for trading platforms</span>
                  <span>© 2025 GreekSoft Technologies Pvt. Ltd.</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default SettingsPage
