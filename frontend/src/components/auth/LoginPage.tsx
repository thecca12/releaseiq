import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Loader2, Zap, BarChart3, GitBranch, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/utils/cn'
import { authApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import type { User } from '@/types'

// ── Feature cards shown on the left hero panel ────────────────────────────────
const features = [
  {
    icon: BarChart3,
    title: 'Release Analytics',
    description: 'Real-time health scores and deployment insights across all clients.',
  },
  {
    icon: GitBranch,
    title: 'Jira Integration',
    description: 'Seamlessly track issues, patches and version history in one place.',
  },
  {
    icon: Zap,
    title: 'AI-Powered Chat',
    description: 'Ask anything about your releases, logs and knowledge base instantly.',
  },
  {
    icon: Shield,
    title: 'Enterprise Security',
    description: 'Role-based access control with full audit trails and SSO support.',
  },
]

// ── Animation variants ────────────────────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
}

const panelVariants = {
  hidden: { opacity: 0, x: -40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: 'easeOut' } },
}

const formPanelVariants = {
  hidden: { opacity: 0, x: 40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: 'easeOut' } },
}

// ── LoginPage ─────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const navigate = useNavigate()
  const { setAuth, setLoading, isLoading } = useAuthStore()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.')
      return
    }

    setError(null)
    setLoading(true)

    try {
      const response = await authApi.login(username.trim(), password)
      const { access_token, user } = response.data as { access_token: string; user: User }
      setAuth(user, access_token)
      navigate('/', { replace: true })
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string }; status?: number } }
      if (axiosErr?.response?.status === 401) {
        setError('Invalid username or password. Please try again.')
      } else if (axiosErr?.response?.data?.detail) {
        setError(axiosErr.response.data.detail)
      } else {
        setError('Unable to connect to the server. Please check your network and try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex overflow-hidden bg-background">

      {/* ── Left hero panel ─────────────────────────────────────────────────── */}
      <motion.div
        variants={panelVariants}
        initial="hidden"
        animate="visible"
        className="hidden lg:flex lg:w-[55%] xl:w-[60%] flex-col justify-between p-10 xl:p-14 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #a855f7 100%)' }}
      >
        {/* Background decorative blobs */}
        <div
          aria-hidden
          className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #818cf8 0%, transparent 70%)' }}
        />
        <div
          aria-hidden
          className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #e879f9 0%, transparent 70%)' }}
        />
        <div
          aria-hidden
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full opacity-5"
          style={{ background: 'radial-gradient(circle, #fff 0%, transparent 70%)' }}
        />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">ReleaseIQ</span>
          </div>
        </div>

        {/* Main hero copy */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="relative z-10 flex-1 flex flex-col justify-center py-12"
        >
          <motion.h1
            variants={itemVariants}
            className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-4"
          >
            AI-Powered
            <br />
            <span className="text-purple-200">Release Intelligence</span>
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="text-lg text-purple-100 mb-10 max-w-md leading-relaxed"
          >
            The intelligent platform for trading technology teams to manage releases,
            analyse logs, track Jira issues and engage with your knowledge base — all in one place.
          </motion.p>

          {/* Feature cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
            {features.map((feature) => (
              <motion.div
                key={feature.title}
                variants={itemVariants}
                className="flex items-start gap-3 p-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/15 transition-colors"
              >
                <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-white/20">
                  <feature.icon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{feature.title}</p>
                  <p className="text-xs text-purple-200 mt-0.5 leading-relaxed">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Footer text */}
        <div className="relative z-10 text-purple-300 text-xs">
          &copy; {new Date().getFullYear()} GreekSoft Technologies. All rights reserved.
        </div>
      </motion.div>

      {/* ── Right form panel ─────────────────────────────────────────────────── */}
      <motion.div
        variants={formPanelVariants}
        initial="hidden"
        animate="visible"
        className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10"
      >
        {/* Mobile logo */}
        <div className="lg:hidden mb-8 flex items-center gap-2">
          <div
            className="flex items-center justify-center w-9 h-9 rounded-xl"
            style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #a855f7 100%)' }}
          >
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-foreground tracking-tight">ReleaseIQ</span>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="w-full max-w-sm"
        >
          {/* Heading */}
          <motion.div variants={itemVariants} className="mb-8 text-center lg:text-left">
            <h2 className="text-2xl font-bold text-foreground mb-1">Welcome back</h2>
            <p className="text-sm text-muted-foreground">
              Sign in to your ReleaseIQ account to continue.
            </p>
          </motion.div>

          {/* Form */}
          <motion.form
            variants={itemVariants}
            onSubmit={handleSubmit}
            className="space-y-5"
            noValidate
          >
            {/* Error banner */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                {error}
              </motion.div>
            )}

            {/* Username */}
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value)
                  if (error) setError(null)
                }}
                disabled={isLoading}
                className={cn(
                  'h-10',
                  error && 'border-destructive focus-visible:ring-destructive'
                )}
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline underline-offset-2 focus:outline-none"
                  tabIndex={0}
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (error) setError(null)
                  }}
                  disabled={isLoading}
                  className={cn(
                    'h-10 pr-10',
                    error && 'border-destructive focus-visible:ring-destructive'
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              className="w-full h-10 font-semibold"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </motion.form>

          {/* Footer note */}
          <motion.p
            variants={itemVariants}
            className="mt-8 text-center text-xs text-muted-foreground"
          >
            Having trouble?{' '}
            <a
              href="mailto:support@greeksoft.co.in"
              className="text-primary hover:underline underline-offset-2"
            >
              Contact support
            </a>
          </motion.p>
        </motion.div>
      </motion.div>
    </div>
  )
}
