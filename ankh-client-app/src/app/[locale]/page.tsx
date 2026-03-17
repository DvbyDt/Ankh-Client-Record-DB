'use client'

import { useState, useEffect } from 'react'
import {
  Search, Loader2, AlertCircle, Users, Plus, Download,
  Upload, LogIn, UserPlus, MapPin, Trash2, Settings,
  ChevronDown, ChevronUp, X, Eye, Edit3, BookOpen,
  Activity, LogOut
} from 'lucide-react'
import { useRouter, usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import Cookies from 'js-cookie'
import React from 'react'

// ─── Debounce hook ───────────────────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])
  return debouncedValue
}

// ─── Types ────────────────────────────────────────────────────────────────────
type UserRole = 'MANAGER' | 'INSTRUCTOR'

interface User {
  id: string; username: string; role: UserRole
  firstName: string; lastName: string; email: string; createdAt?: string
}
interface CustomerLessonParticipant {
  id: string
  lesson: {
    id: string; lessonType?: string; lessonContent?: string; createdAt?: string
    instructor: { firstName: string; lastName: string }
    location?: { name: string }
  }
  customerSymptoms?: string; customerImprovements?: string; status?: string
}
interface Customer {
  id: string; firstName: string; lastName: string; email: string
  phone?: string; createdAt?: string; deletedAt?: string | null
  lessonParticipants?: CustomerLessonParticipant[]
}

// ─── Tiny UI primitives ───────────────────────────────────────────────────────

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t) }, [onClose])
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-gray-900 text-white px-5 py-3 rounded-xl shadow-2xl border border-gray-700" style={{ animation: 'slideUp .25s ease-out' }}>
      <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="ml-2 text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
    </div>
  )
}

function Overlay({ onClick }: { onClick: () => void }) {
  return <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClick} />
}

function ModalShell({ open, onClose, title, subtitle, wide, children }: {
  open: boolean; onClose: () => void; title: string; subtitle?: string; wide?: boolean; children: React.ReactNode
}) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])
  if (!open) return null
  return (
    <>
      <Overlay onClick={onClose} />
      <div className={`fixed inset-0 z-50 flex items-center justify-center p-4`}>
        <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] flex flex-col overflow-hidden`} onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 flex-shrink-0">
            <div>
              <h2 className="text-base font-semibold text-gray-900">{title}</h2>
              {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"><X className="w-4 h-4" /></button>
          </div>
          <div className="overflow-y-auto flex-1 px-6 py-5">{children}</div>
        </div>
      </div>
    </>
  )
}

function ConfirmDialog({ open, title, message, onConfirm, onCancel }: {
  open: boolean; title: string; message: string; onConfirm: () => void; onCancel: () => void
}) {
  if (!open) return null
  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]" />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
          <div className="flex items-start gap-4 mb-5">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{message}</p>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">Cancel</button>
            <button onClick={onConfirm} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors">Delete</button>
          </div>
        </div>
      </div>
    </>
  )
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
      <input {...props} className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all" />
    </div>
  )
}

function FieldSelect({ label, children, ...props }: { label: string; children: React.ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
      <select {...props} className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 transition-all">{children}</select>
    </div>
  )
}

function Badge({ children, variant = 'gray' }: { children: React.ReactNode; variant?: 'gray' | 'blue' | 'green' | 'red' | 'amber' }) {
  const v = { gray: 'bg-gray-100 text-gray-600', blue: 'bg-blue-50 text-blue-700', green: 'bg-emerald-50 text-emerald-700', red: 'bg-red-50 text-red-600', amber: 'bg-amber-50 text-amber-700' }
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${v[variant]}`}>{children}</span>
}

function Avatar({ name, color = 'gray' }: { name: string; color?: 'gray' | 'green' | 'violet' }) {
  const initials = name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
  const colors = {
    gray: 'from-gray-200 to-gray-300 text-gray-700',
    green: 'from-emerald-100 to-teal-200 text-emerald-800',
    violet: 'from-violet-100 to-purple-200 text-violet-800'
  }
  return <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${colors[color]} flex items-center justify-center text-xs font-semibold flex-shrink-0`}>{initials}</div>
}

function ShimmerRow() {
  return (
    <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-50">
      <div className="w-9 h-9 rounded-full bg-gray-100 animate-pulse" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-36 bg-gray-100 rounded-full animate-pulse" />
        <div className="h-3 w-52 bg-gray-50 rounded-full animate-pulse" />
      </div>
      <div className="h-3 w-24 bg-gray-100 rounded-full animate-pulse" />
      <div className="h-6 w-16 bg-gray-100 rounded-lg animate-pulse" />
    </div>
  )
}

function Btn({ children, variant = 'primary', size = 'md', className = '', ...props }: {
  children: React.ReactNode; variant?: 'primary' | 'secondary' | 'danger'; size?: 'sm' | 'md'; className?: string
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-colors disabled:opacity-50'
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2.5 text-sm' }
  const variants = { primary: 'bg-gray-900 text-white hover:bg-gray-800', secondary: 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300', danger: 'bg-red-50 text-red-600 hover:bg-red-100' }
  return <button {...props} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}>{children}</button>
}

// ─── Recent Lessons component ─────────────────────────────────────────────────
function RecentLessons({ locale, formatName, onViewCustomer }: {
  locale: string
  formatName: (f: string, l: string) => string
  onViewCustomer: (id: string) => void
}) {
  const [lessons, setLessons] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/lessons/recent?limit=8')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.lessons) setLessons(d.lessons) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (!loading && lessons.length === 0) return null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-900 text-[15px]">Recent Lessons</h2>
          <p className="text-xs text-gray-400 mt-0.5">Latest recorded sessions</p>
        </div>
        <Activity className="w-4 h-4 text-gray-300" />
      </div>
      {loading ? (
        <div className="divide-y divide-gray-50">{[...Array(4)].map((_, i) => <ShimmerRow key={i} />)}</div>
      ) : (
        <div className="divide-y divide-gray-50">
          {lessons.map((lp: any) => {
            const customer = lp.customer
            const lesson = lp.lesson
            if (!customer || !lesson) return null
            return (
              <div key={lp.id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-gray-50 transition-colors group">
                <Avatar name={`${customer.firstName} ${customer.lastName}`} color="violet" />
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => onViewCustomer(customer.id)}
                    className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors truncate block text-left"
                  >
                    {formatName(customer.firstName, customer.lastName)}
                  </button>
                  <p className="text-xs text-gray-400 truncate">
                    {lesson.instructor ? formatName(lesson.instructor.firstName, lesson.instructor.lastName) : ''}
                    {lesson.location ? ` · ${lesson.location.name}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {lesson.lessonType && <Badge variant="gray">{lesson.lessonType}</Badge>}
                  <span className="text-xs text-gray-400 hidden sm:block">
                    {lesson.createdAt ? new Date(lesson.createdAt).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', { month: 'short', day: 'numeric' }) : '—'}
                  </span>
                </div>
                <button
                  onClick={() => onViewCustomer(customer.id)}
                  className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all"
                >
                  <Eye className="w-3 h-3" />View
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function HomePage() {
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations()
  const locale = pathname.split('/')[1] || 'en'
  const formatName = (f: string, l: string) => locale === 'ko' ? `${l} ${f}` : `${f} ${l}`

  // ── Auth ──
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [showLogin, setShowLogin] = useState(false)
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  // ── Search ──
  const [searchTerm, setSearchTerm] = useState('')
  const debounced = useDebounce(searchTerm, 400)
  const [searchPage, setSearchPage] = useState(1)
  const PAGE = 20
  const [sLoading, setSLoading] = useState(false)
  const [sError, setSError] = useState(false)
  const [results, setResults] = useState<Customer[]>([])
  const [total, setTotal] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const totalPages = Math.ceil(total / PAGE) || 1

  // ── Counts ──
  const [customerCount, setCustomerCount] = useState<number | null>(null)

  // ── Panels ──
  const [showAllCustomers, setShowAllCustomers] = useState(false)
  const [allCustomers, setAllCustomers] = useState<Customer[]>([])
  const [acLoading, setAcLoading] = useState(false)
  const [acPage, setAcPage] = useState(1)
  const [acTotalPages, setAcTotalPages] = useState(1)
  const [showAllUsers, setShowAllUsers] = useState(false)
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [auLoading, setAuLoading] = useState(false)
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'MANAGER' | 'INSTRUCTOR'>('ALL')

  // ── Modals ──
  const [detailModal, setDetailModal] = useState<Customer | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [editModal, setEditModal] = useState<Customer | null>(null)
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', email: '', phone: '' })
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')
  const [userModal, setUserModal] = useState<User | null>(null)
  const [addUserModal, setAddUserModal] = useState(false)
  const [addUserForm, setAddUserForm] = useState({ username: '', password: '', role: 'INSTRUCTOR' as UserRole, firstName: '', lastName: '', email: '' })
  const [addUserLoading, setAddUserLoading] = useState(false)
  const [addUserError, setAddUserError] = useState('')
  const [addLocModal, setAddLocModal] = useState(false)
  const [locName, setLocName] = useState('')
  const [locLoading, setLocLoading] = useState(false)
  const [locError, setLocError] = useState('')
  const [uploadModal, setUploadModal] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const [uploadErr, setUploadErr] = useState('')

  // ── Confirm / Toast ──
  const [confirm, setConfirm] = useState<{ title: string; message: string; fn: () => void } | null>(null)
  const [toast, setToast] = useState('')
  const flash = (m: string) => setToast(m)

  // ── Init ──
  useEffect(() => {
    const token = Cookies.get('jwt-token')
    if (token) {
      const u = Cookies.get('current-user-data')
      if (u) { setCurrentUser(JSON.parse(u)); setIsLoggedIn(true) }
    }
  }, [])
  useEffect(() => { if (isLoggedIn) fetchCount() }, [isLoggedIn])

  // ── Search effect ──
  useEffect(() => {
    if (debounced.length < 2) { setResults([]); setTotal(0); return }
    setSLoading(true); setSError(false)
    fetch(`/api/customers/search?name=${encodeURIComponent(debounced)}&take=${PAGE}&skip=${(searchPage - 1) * PAGE}`)
      .then(r => r.json())
      .then(d => { setResults(d.customers || []); setTotal(d.total || 0) })
      .catch(() => setSError(true))
      .finally(() => setSLoading(false))
  }, [debounced, searchPage])

  // ── Fetchers ──
  const fetchCount = async () => {
    try { const r = await fetch('/api/customers?limit=1'); if (r.ok) { const d = await r.json(); setCustomerCount(d.total ?? null) } } catch {}
  }
  const fetchAllCustomers = async (p = 1) => {
    setAcLoading(true)
    try {
      const r = await fetch(`/api/customers?page=${p}&limit=50`)
      if (r.ok) { const d = await r.json(); setAllCustomers(d.customers || []); setAcTotalPages(d.totalPages || 1); setAcPage(p); if (d.total != null) setCustomerCount(d.total) }
    } finally { setAcLoading(false) }
  }
  const fetchAllUsers = async () => {
    setAuLoading(true)
    try { const r = await fetch('/api/users'); if (r.ok) { const d = await r.json(); setAllUsers(d.users || []) } } finally { setAuLoading(false) }
  }
  const fetchDetail = async (id: string) => {
    setDetailLoading(true)
    const preview = allCustomers.find(c => c.id === id) || results.find(c => c.id === id) || null
    setDetailModal(preview)
    try { const r = await fetch(`/api/customers/${id}`); if (r.ok) { const d = await r.json(); setDetailModal(d.customer) } } finally { setDetailLoading(false) }
  }

  // ── Handlers ──
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLoginLoading(true); setLoginError('')
    try {
      const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(loginForm) })
      if (r.ok) {
        const d = await r.json()
        Cookies.set('jwt-token', d.token, { expires: 1 })
        Cookies.set('current-user-data', JSON.stringify({ firstName: d.user.firstName, lastName: d.user.lastName, role: d.user.role }), { expires: 7 })
        setCurrentUser(d.user); setIsLoggedIn(true); setShowLogin(false); setLoginForm({ username: '', password: '' })
      } else { const d = await r.json(); setLoginError(d.error || t('HomePage.loginFailed')) }
    } catch { setLoginError(t('HomePage.loginFailed')) } finally { setLoginLoading(false) }
  }
  const handleLogout = () => {
    Cookies.remove('jwt-token'); Cookies.remove('current-user-data')
    setCurrentUser(null); setIsLoggedIn(false); setResults([]); setAllCustomers([]); setAllUsers([])
  }
  const openEdit = (c: Customer) => { setEditModal(c); setEditForm({ firstName: c.firstName, lastName: c.lastName, email: c.email, phone: c.phone || '' }); setEditError('') }
  const saveEdit = async () => {
    if (!editModal || !editForm.firstName || !editForm.lastName || !editForm.email) { setEditError('All fields required.'); return }
    setEditLoading(true); setEditError('')
    const token = Cookies.get('jwt-token')
    try {
      const r = await fetch(`/api/customers/${editModal.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(editForm) })
      if (r.ok) {
        const { customer: u } = await r.json()
        setAllCustomers(p => p.map(c => c.id === u.id ? { ...c, ...u } : c))
        setResults(p => p.map(c => c.id === u.id ? { ...c, ...u } : c))
        if (detailModal?.id === u.id) setDetailModal(prev => prev ? { ...prev, ...u } : prev)
        setEditModal(null); flash('Customer updated successfully!')
      } else { const d = await r.json(); setEditError(d.error || 'Failed to update.') }
    } catch { setEditError('Unexpected error.') } finally { setEditLoading(false) }
  }
  const deleteCustomer = (id: string, name: string) => {
    setConfirm({ title: 'Delete Customer', message: `Delete "${name}" and all their lesson records? This cannot be undone.`, fn: async () => {
      const token = Cookies.get('jwt-token')
      const r = await fetch(`/api/customers/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      if (r.ok) { setResults(p => p.filter(c => c.id !== id)); setAllCustomers(p => p.filter(c => c.id !== id)); if (detailModal?.id === id) setDetailModal(null); fetchCount(); flash('Customer deleted.') }
      else flash('Failed to delete customer.')
      setConfirm(null)
    }})
  }
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault(); setAddUserLoading(true); setAddUserError('')
    const token = Cookies.get('jwt-token')
    try {
      const r = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(addUserForm) })
      if (r.ok) { setAddUserModal(false); setAddUserForm({ username: '', password: '', role: 'INSTRUCTOR', firstName: '', lastName: '', email: '' }); flash('User created!'); if (showAllUsers) fetchAllUsers() }
      else { const d = await r.json(); setAddUserError(d.error || 'Failed.') }
    } catch { setAddUserError('Unexpected error.') } finally { setAddUserLoading(false) }
  }
  const deleteUser = (id: string, name: string) => {
    setConfirm({ title: 'Delete User', message: `Delete user "${name}"?`, fn: async () => {
      const token = Cookies.get('jwt-token')
      const r = await fetch(`/api/users/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      if (r.ok) { setAllUsers(p => p.filter(u => u.id !== id)); flash('User deleted.') }
      setConfirm(null)
    }})
  }
  const addLocation = async (e: React.FormEvent) => {
    e.preventDefault(); setLocLoading(true); setLocError('')
    try {
      const r = await fetch('/api/locations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: locName.trim() }) })
      if (r.ok) { setAddLocModal(false); setLocName(''); flash('Location created!') } else { const d = await r.json(); setLocError(d.error || 'Failed.') }
    } catch { setLocError('Unexpected error.') } finally { setLocLoading(false) }
  }
  const handleUpload = async () => {
    if (!uploadFile) { setUploadErr('Please select a file.'); return }
    setUploading(true); setUploadMsg(''); setUploadErr('')
    const token = Cookies.get('jwt-token'); const fd = new FormData(); fd.append('file', uploadFile)
    try {
      const r = await fetch('/api/import-csv', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd })
      const d = await r.json()
      if (r.ok) { setUploadMsg(d.message || 'Imported!'); setUploadFile(null); fetchCount(); if (showAllCustomers) fetchAllCustomers(1) } else setUploadErr(d.error || 'Upload failed.')
    } catch { setUploadErr('Unexpected error.') } finally { setUploading(false) }
  }

  const filteredUsers = allUsers.filter(u => roleFilter === 'ALL' || u.role === roleFilter)

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        html, body, * { font-family: 'DM Sans', system-ui, sans-serif; box-sizing: border-box; }
        @keyframes slideUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        .fade-in { animation: fadeIn .2s ease-out; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 99px; }
      `}</style>

      <div className="min-h-screen bg-[#f7f7f5]">
        {toast && <Toast message={toast} onClose={() => setToast('')} />}
        <ConfirmDialog open={!!confirm} title={confirm?.title || ''} message={confirm?.message || ''} onConfirm={() => confirm?.fn()} onCancel={() => setConfirm(null)} />

        {/* ━━━━ HEADER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gray-900 flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-semibold text-gray-900 text-[14px] hidden sm:block">{t('Common.appName')}</span>
              {customerCount !== null && isLoggedIn && (
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">{customerCount} Customers</span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <LanguageSwitcher />
              {isLoggedIn ? (
                <>
                  <div className="hidden md:flex items-center gap-2 text-sm">
                    <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-[11px] font-semibold text-gray-700">
                      {currentUser?.firstName?.[0]}{currentUser?.lastName?.[0]}
                    </div>
                    <span className="text-gray-600 font-medium text-[13px]">{currentUser && formatName(currentUser.firstName, currentUser.lastName)}</span>
                    <Badge variant={currentUser?.role === 'MANAGER' ? 'blue' : 'green'}>{currentUser?.role}</Badge>
                  </div>
                  <button onClick={handleLogout} className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                    <LogOut className="w-3.5 h-3.5" /><span className="hidden sm:inline">{t('Auth.logout')}</span>
                  </button>
                </>
              ) : (
                <button onClick={() => setShowLogin(true)} className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-[13px] font-medium rounded-xl hover:bg-gray-800 transition-colors">
                  <LogIn className="w-3.5 h-3.5" />{t('Auth.login')}
                </button>
              )}
            </div>
          </div>
        </header>

        {/* ━━━━ CONTENT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <main className="max-w-6xl mx-auto px-5 py-8">

          {/* Not logged in */}
          {!isLoggedIn && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center fade-in">
              <div className="w-14 h-14 rounded-2xl bg-gray-900 flex items-center justify-center mb-5">
                <BookOpen className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('HomePage.welcomeTitle')}</h1>
              <p className="text-gray-400 mb-7 max-w-sm text-sm leading-relaxed">{t('HomePage.welcomeDesc')}</p>
              <button onClick={() => setShowLogin(true)} className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors">
                <LogIn className="w-4 h-4" />{t('Auth.login')}
              </button>
            </div>
          )}

          {/* Logged in */}
          {isLoggedIn && (
            <div className="space-y-5 fade-in">

              {/* ── Toolbar ── */}
              <div className="bg-white rounded-2xl border border-gray-100 px-4 py-4 space-y-3">
                {/* Row 1 — primary actions, always visible */}
                <div className="flex flex-wrap gap-2">
                  <Btn onClick={() => router.push(`/${locale}/add-record`)}>
                    <Plus className="w-3.5 h-3.5" />{t('HomePage.addNewRecord')}
                  </Btn>
                  <a href="/api/export-csv" download="customer_records.csv">
                    <Btn variant="secondary"><Download className="w-3.5 h-3.5" />{t('HomePage.exportCSV')}</Btn>
                  </a>
                  <Btn variant="secondary" onClick={() => setUploadModal(true)}>
                    <Upload className="w-3.5 h-3.5" />{t('HomePage.importCSV')}
                  </Btn>
                </div>

                {/* Row 2 — manager-only actions */}
                {currentUser?.role === 'MANAGER' && (
                  <div className="flex flex-wrap gap-2 pt-2.5 border-t border-gray-50">
                    <Btn variant="secondary"
                      className={showAllCustomers ? '!bg-gray-900 !text-white !border-gray-900' : ''}
                      onClick={() => { const n = !showAllCustomers; setShowAllCustomers(n); if (n && !allCustomers.length) fetchAllCustomers(1) }}>
                      <Users className="w-3.5 h-3.5" />All Customers
                    </Btn>
                    <Btn variant="secondary"
                      className={showAllUsers ? '!bg-gray-900 !text-white !border-gray-900' : ''}
                      onClick={() => { const n = !showAllUsers; setShowAllUsers(n); if (n && !allUsers.length) fetchAllUsers() }}>
                      <Users className="w-3.5 h-3.5" />All Users
                    </Btn>
                    <div className="w-px bg-gray-200 mx-0.5 self-stretch" />
                    <Btn variant="secondary" onClick={() => setAddUserModal(true)}>
                      <UserPlus className="w-3.5 h-3.5" />Add User
                    </Btn>
                    <Btn variant="secondary" onClick={() => setAddLocModal(true)}>
                      <MapPin className="w-3.5 h-3.5" />Add Location
                    </Btn>
                    <Btn variant="secondary" onClick={() => router.push(`/${locale}/manage-users`)}>
                      <Settings className="w-3.5 h-3.5" />Manage Users
                    </Btn>
                  </div>
                )}
              </div>

              {/* ── All Users panel ── */}
              {currentUser?.role === 'MANAGER' && showAllUsers && (
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden fade-in">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
                    <div>
                      <h2 className="font-semibold text-gray-900 text-[15px]">All Users</h2>
                      <p className="text-xs text-gray-400 mt-0.5">{allUsers.length} total</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {(['ALL', 'MANAGER', 'INSTRUCTOR'] as const).map(r => (
                        <button key={r} onClick={() => setRoleFilter(r)} className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${roleFilter === r ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{r}</button>
                      ))}
                    </div>
                  </div>
                  {auLoading ? [...Array(4)].map((_, i) => <ShimmerRow key={i} />) : (
                    <div className="divide-y divide-gray-50">
                      {filteredUsers.length === 0
                        ? <div className="px-6 py-10 text-center text-sm text-gray-400">No users found</div>
                        : filteredUsers.map(u => (
                          <div key={u.id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-gray-50 transition-colors group">
                            <Avatar name={`${u.firstName} ${u.lastName}`} color="gray" />
                            <div className="flex-1 min-w-0">
                              <button onClick={() => setUserModal(u)} className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors truncate block text-left">{formatName(u.firstName, u.lastName)}</button>
                              <p className="text-xs text-gray-400 truncate">{u.email}</p>
                            </div>
                            <span className="text-xs text-gray-400 hidden sm:block font-mono">{u.username}</span>
                            <Badge variant={u.role === 'MANAGER' ? 'blue' : 'green'}>{u.role}</Badge>
                            <span className="text-xs text-gray-400 hidden lg:block">{new Date(u.createdAt || '').toLocaleDateString()}</span>
                            <button onClick={() => deleteUser(u.id, formatName(u.firstName, u.lastName))} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── All Customers panel ── */}
              {currentUser?.role === 'MANAGER' && showAllCustomers && (
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden fade-in">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
                    <div>
                      <h2 className="font-semibold text-gray-900 text-[15px]">All Customers</h2>
                      <p className="text-xs text-gray-400 mt-0.5">Page {acPage}/{acTotalPages}{customerCount != null ? ` · ${customerCount} total` : ''}</p>
                    </div>
                    {acTotalPages > 1 && (
                      <div className="flex gap-1.5">
                        <button disabled={acPage === 1 || acLoading} onClick={() => fetchAllCustomers(acPage - 1)} className="px-3 py-1 text-xs font-medium rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-40 transition-colors">← Prev</button>
                        <button disabled={acPage === acTotalPages || acLoading} onClick={() => fetchAllCustomers(acPage + 1)} className="px-3 py-1 text-xs font-medium rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-40 transition-colors">Next →</button>
                      </div>
                    )}
                  </div>
                  {acLoading ? [...Array(6)].map((_, i) => <ShimmerRow key={i} />) : (
                    <div className="divide-y divide-gray-50">
                      {allCustomers.length === 0
                        ? <div className="px-6 py-10 text-center text-sm text-gray-400">No customers found</div>
                        : allCustomers.map(c => (
                          <div key={c.id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-gray-50 transition-colors group">
                            <Avatar name={`${c.firstName} ${c.lastName}`} color="green" />
                            <div className="flex-1 min-w-0">
                              <button onClick={() => fetchDetail(c.id)} className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors truncate block text-left">{formatName(c.firstName, c.lastName)}</button>
                              <p className="text-xs text-gray-400 truncate">{c.email}</p>
                            </div>
                            <span className="text-xs text-gray-400 hidden sm:block">{c.phone || '—'}</span>
                            <span className="text-xs text-gray-400 hidden lg:block">
                              {c.lessonParticipants?.[0]?.lesson?.createdAt ? new Date(c.lessonParticipants[0].lesson.createdAt).toLocaleDateString() : 'No lessons'}
                            </span>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => openEdit(c)} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-blue-600 hover:bg-blue-50 transition-colors"><Edit3 className="w-3.5 h-3.5" /></button>
                              <button onClick={() => deleteCustomer(c.id, formatName(c.firstName, c.lastName))} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Recent Lessons quick-view ── */}
              <RecentLessons locale={locale} formatName={formatName} onViewCustomer={fetchDetail} />

              {/* ── Search box ── */}
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="px-6 pt-5 pb-4">
                  <p className="text-[13px] font-semibold text-gray-400 uppercase tracking-wide mb-3">{t('CustomerSearch.title')}</p>
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={e => { setSearchTerm(e.target.value); setSearchPage(1) }}
                      placeholder={t('HomePage.searchPlaceholder')}
                      className="w-full pl-10 pr-10 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
                    />
                    {searchTerm && (
                      <button onClick={() => { setSearchTerm(''); setResults([]) }} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {sLoading && <div className="border-t border-gray-50">{[...Array(3)].map((_, i) => <ShimmerRow key={i} />)}</div>}

                {sError && !sLoading && (
                  <div className="border-t border-gray-50 px-6 py-5 flex items-center gap-2.5 text-red-500">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm">{t('HomePage.searchFailedCustomer')}</span>
                  </div>
                )}

                {!sLoading && !sError && results.length > 0 && (
                  <div className="border-t border-gray-50">
                    {results.map(c => (
                      <div key={c.id}>
                        <div className="flex items-center gap-4 px-6 py-3.5 hover:bg-gray-50 transition-colors group cursor-pointer" onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}>
                          <Avatar name={`${c.firstName} ${c.lastName}`} color="violet" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{formatName(c.firstName, c.lastName)}</p>
                            <p className="text-xs text-gray-400 truncate">{c.email}{c.phone ? ` · ${c.phone}` : ''}</p>
                          </div>
                          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={e => { e.stopPropagation(); fetchDetail(c.id) }} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                              <Eye className="w-3 h-3" />View
                            </button>
                            {currentUser?.role === 'MANAGER' && (
                              <>
                                <button onClick={e => { e.stopPropagation(); openEdit(c) }} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                                  <Edit3 className="w-3 h-3" />Edit
                                </button>
                                <button onClick={e => { e.stopPropagation(); deleteCustomer(c.id, formatName(c.firstName, c.lastName)) }} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-500 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
                                  <Trash2 className="w-3 h-3" />Delete
                                </button>
                              </>
                            )}
                          </div>
                          <span className="text-gray-300 flex-shrink-0">{expandedId === c.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
                        </div>

                        {expandedId === c.id && (
                          <div className="border-t border-gray-50 bg-gray-50/70 px-6 py-4 fade-in">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{t('CustomerSearch.lessonDetails')}</p>
                              <button onClick={() => fetchDetail(c.id)} className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors">View full history →</button>
                            </div>
                            {c.lessonParticipants && c.lessonParticipants.length > 0 ? (
                              <div className="space-y-2">
                                {c.lessonParticipants.map(lp => (
                                  <div key={lp.id} className="bg-white rounded-xl border border-gray-100 p-3.5">
                                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                      <span className="text-xs font-semibold text-gray-800">{lp.lesson.createdAt ? new Date(lp.lesson.createdAt).toLocaleDateString() : '—'}</span>
                                      <Badge>{lp.lesson.lessonType}</Badge>
                                      {lp.status && <Badge variant={lp.status === 'attended' ? 'green' : 'amber'}>{lp.status}</Badge>}
                                      <span className="text-xs text-gray-400 ml-auto">{formatName(lp.lesson.instructor.firstName, lp.lesson.instructor.lastName)}</span>
                                    </div>
                                    {lp.customerSymptoms && <p className="text-xs text-gray-600"><span className="font-semibold text-gray-700">{t('CustomerSearch.symptoms')}:</span> {lp.customerSymptoms}</p>}
                                    {lp.customerImprovements && <p className="text-xs text-gray-600 mt-0.5"><span className="font-semibold text-gray-700">{t('CustomerSearch.improvements')}:</span> {lp.customerImprovements}</p>}
                                  </div>
                                ))}
                              </div>
                            ) : <p className="text-sm text-gray-400">No lesson records found.</p>}
                          </div>
                        )}
                      </div>
                    ))}

                    {totalPages > 1 && (
                      <div className="flex items-center justify-between px-6 py-3.5 border-t border-gray-50 bg-gray-50/50">
                        <button disabled={searchPage === 1} onClick={() => setSearchPage(p => p - 1)} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors">← Previous</button>
                        <span className="text-xs text-gray-400">Page {searchPage} of {totalPages} · {total} results</span>
                        <button disabled={searchPage === totalPages} onClick={() => setSearchPage(p => p + 1)} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors">Next →</button>
                      </div>
                    )}
                  </div>
                )}

                {!sLoading && !sError && debounced.length >= 2 && results.length === 0 && (
                  <div className="border-t border-gray-50 px-6 py-10 text-center">
                    <Search className="w-7 h-7 text-gray-200 mx-auto mb-2.5" />
                    <p className="text-sm text-gray-400">{t('HomePage.noResults')}</p>
                  </div>
                )}
                {!sLoading && searchTerm.length > 0 && searchTerm.length < 2 && (
                  <div className="border-t border-gray-50 px-6 py-4 text-center text-xs text-gray-400">Type at least 2 characters to search</div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ━━━━ ALL MODALS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}

      {/* Login */}
      <ModalShell open={showLogin} onClose={() => setShowLogin(false)} title={t('Auth.login')}>
        <form onSubmit={handleLogin} className="space-y-4">
          <Field label={t('Auth.username')} type="text" value={loginForm.username} onChange={e => setLoginForm({ ...loginForm, username: e.target.value })} placeholder="Enter your username" required autoFocus />
          <Field label={t('Auth.password')} type="password" value={loginForm.password} onChange={e => setLoginForm({ ...loginForm, password: e.target.value })} placeholder="••••••••" required />
          {loginError && <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3.5 py-2.5 rounded-xl"><AlertCircle className="w-4 h-4 flex-shrink-0" />{loginError}</div>}
          <Btn type="submit" disabled={loginLoading} className="w-full mt-2 justify-center !py-3">
            {loginLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Signing in…</> : t('Auth.login')}
          </Btn>
        </form>
      </ModalShell>

      {/* Customer detail */}
      <ModalShell open={!!detailModal} onClose={() => setDetailModal(null)} wide title={detailModal ? formatName(detailModal.firstName, detailModal.lastName) : ''} subtitle="Customer Profile">
        {detailModal && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Email', value: detailModal.email },
                { label: 'Phone', value: detailModal.phone || '—' },
                { label: 'Since', value: detailModal.createdAt ? new Date(detailModal.createdAt).toLocaleDateString() : '—' }
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 rounded-xl p-3.5">
                  <p className="text-[11px] text-gray-400 mb-1 uppercase tracking-wide font-medium">{label}</p>
                  <p className="text-sm font-medium text-gray-900 break-all">{value}</p>
                </div>
              ))}
            </div>
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{t('CustomerSearch.lessonDetails')}</p>
                {detailModal.lessonParticipants && <Badge>{detailModal.lessonParticipants.length} sessions</Badge>}
              </div>
              {detailLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
              ) : detailModal.lessonParticipants?.length ? (
                <div className="space-y-2.5 max-h-[45vh] overflow-y-auto pr-1">
                  {detailModal.lessonParticipants.map(lp => (
                    <div key={lp.id} className="border border-gray-100 rounded-xl p-4 bg-white hover:border-gray-200 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900">{lp.lesson.createdAt ? new Date(lp.lesson.createdAt).toLocaleDateString() : '—'}</span>
                          <Badge>{lp.lesson.lessonType}</Badge>
                          {lp.lesson.location && <Badge variant="blue">{lp.lesson.location.name}</Badge>}
                          {lp.status && <Badge variant={lp.status === 'attended' ? 'green' : 'amber'}>{lp.status}</Badge>}
                        </div>
                        <span className="text-xs text-gray-400">{formatName(lp.lesson.instructor.firstName, lp.lesson.instructor.lastName)}</span>
                      </div>
                      {lp.lesson.lessonContent && <p className="text-xs text-gray-400 italic mb-2">{lp.lesson.lessonContent}</p>}
                      {lp.customerSymptoms && <p className="text-xs text-gray-600"><span className="font-semibold">{t('CustomerSearch.symptoms')}:</span> {lp.customerSymptoms}</p>}
                      {lp.customerImprovements && <p className="text-xs text-gray-600 mt-0.5"><span className="font-semibold">{t('CustomerSearch.improvements')}:</span> {lp.customerImprovements}</p>}
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-gray-400 py-4 text-center">No lesson records found.</p>}
            </div>
            {currentUser?.role === 'MANAGER' && (
              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <Btn variant="secondary" size="sm" onClick={() => { openEdit(detailModal); setDetailModal(null) }}><Edit3 className="w-3 h-3" />Edit</Btn>
                <Btn variant="danger" size="sm" onClick={() => { deleteCustomer(detailModal.id, formatName(detailModal.firstName, detailModal.lastName)); setDetailModal(null) }}><Trash2 className="w-3 h-3" />Delete</Btn>
              </div>
            )}
          </div>
        )}
      </ModalShell>

      {/* Edit customer */}
      <ModalShell open={!!editModal} onClose={() => setEditModal(null)} title="Edit Customer">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First Name" value={editForm.firstName} onChange={e => setEditForm({ ...editForm, firstName: e.target.value })} />
            <Field label="Last Name" value={editForm.lastName} onChange={e => setEditForm({ ...editForm, lastName: e.target.value })} />
          </div>
          <Field label="Email" type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
          <Field label="Phone" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} placeholder="Optional" />
          {editError && <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3.5 py-2.5 rounded-xl"><AlertCircle className="w-4 h-4 flex-shrink-0" />{editError}</div>}
          <div className="flex gap-2 pt-1">
            <Btn variant="secondary" className="flex-1 justify-center" onClick={() => setEditModal(null)}>Cancel</Btn>
            <Btn disabled={editLoading} className="flex-1 justify-center" onClick={saveEdit}>{editLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : 'Save Changes'}</Btn>
          </div>
        </div>
      </ModalShell>

      {/* User info */}
      <ModalShell open={!!userModal} onClose={() => setUserModal(null)} title={userModal ? formatName(userModal.firstName, userModal.lastName) : ''}>
        {userModal && (
          <div className="divide-y divide-gray-50">
            {[
              { label: 'Username', val: <span className="font-mono text-sm">{userModal.username}</span> },
              { label: 'Email', val: <span className="text-sm break-all">{userModal.email}</span> },
              { label: 'Role', val: <Badge variant={userModal.role === 'MANAGER' ? 'blue' : 'green'}>{userModal.role}</Badge> },
              { label: 'Created', val: <span className="text-sm">{new Date(userModal.createdAt || '').toLocaleString()}</span> },
            ].map(({ label, val }) => (
              <div key={label} className="flex items-center gap-4 py-3">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide w-20 flex-shrink-0">{label}</span>
                {val}
              </div>
            ))}
          </div>
        )}
      </ModalShell>

      {/* Add user */}
      <ModalShell open={addUserModal} onClose={() => setAddUserModal(false)} title="Add New User">
        <form onSubmit={handleAddUser} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First Name" value={addUserForm.firstName} onChange={e => setAddUserForm({ ...addUserForm, firstName: e.target.value })} required />
            <Field label="Last Name" value={addUserForm.lastName} onChange={e => setAddUserForm({ ...addUserForm, lastName: e.target.value })} required />
          </div>
          <Field label="Email" type="email" value={addUserForm.email} onChange={e => setAddUserForm({ ...addUserForm, email: e.target.value })} required />
          <Field label="Username" value={addUserForm.username} onChange={e => setAddUserForm({ ...addUserForm, username: e.target.value })} required />
          <Field label="Password" type="password" value={addUserForm.password} onChange={e => setAddUserForm({ ...addUserForm, password: e.target.value })} required />
          <FieldSelect label="Role" value={addUserForm.role} onChange={e => setAddUserForm({ ...addUserForm, role: e.target.value as UserRole })}>
            <option value="INSTRUCTOR">Instructor</option>
            <option value="MANAGER">Manager</option>
          </FieldSelect>
          {addUserError && <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3.5 py-2.5 rounded-xl"><AlertCircle className="w-4 h-4 flex-shrink-0" />{addUserError}</div>}
          <Btn type="submit" disabled={addUserLoading} className="w-full justify-center !py-3 mt-1">{addUserLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Creating…</> : 'Create User'}</Btn>
        </form>
      </ModalShell>

      {/* Add location */}
      <ModalShell open={addLocModal} onClose={() => setAddLocModal(false)} title="Add New Location">
        <form onSubmit={addLocation} className="space-y-4">
          <Field label="Location Name" value={locName} onChange={e => setLocName(e.target.value)} placeholder="e.g. Studio A, Room 201" required />
          {locError && <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3.5 py-2.5 rounded-xl"><AlertCircle className="w-4 h-4 flex-shrink-0" />{locError}</div>}
          <Btn type="submit" disabled={locLoading} className="w-full justify-center !py-3">{locLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Creating…</> : 'Create Location'}</Btn>
        </form>
      </ModalShell>

      {/* Upload */}
      <ModalShell open={uploadModal} onClose={() => setUploadModal(false)} title={t('HomePage.importCSV')}>
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-gray-600">{t('HomePage.importRecordsDesc')}</p>
            <div className="rounded-xl border border-gray-100 bg-white p-3.5">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                {t('HomePage.csvRequirements')}
              </p>
              <p className="text-xs text-gray-500 mb-2">{t('HomePage.csvRequirementsDesc')}</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-gray-700">
                {[
                  t('HomePage.csvHeaders.customerId'),
                  t('HomePage.csvHeaders.customerName'),
                  t('HomePage.csvHeaders.initialSymptom'),
                  t('HomePage.csvHeaders.lessonId'),
                  t('HomePage.csvHeaders.lessonDate'),
                  t('HomePage.csvHeaders.instructorName'),
                  t('HomePage.csvHeaders.lessonType'),
                  t('HomePage.csvHeaders.customerSymptoms'),
                  t('HomePage.csvHeaders.lessonContent'),
                  t('HomePage.csvHeaders.courseCompletion')
                ].map(h => (
                  <div key={h} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                    <span className="break-words">{h}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-gray-400 mt-2">
                Tip: Header names are case-insensitive, and common aliases are accepted.
              </p>
            </div>
          </div>
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 hover:bg-gray-100 hover:border-gray-300 cursor-pointer transition-colors">
            <Upload className="w-5 h-5 text-gray-400 mb-2" />
            <span className="text-sm font-medium text-gray-600">{uploadFile ? uploadFile.name : 'Click to select file'}</span>
            <span className="text-xs text-gray-400 mt-0.5">CSV, XLSX, XLS supported</span>
            <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={e => { setUploadFile(e.target.files?.[0] || null); setUploadErr(''); setUploadMsg('') }} />
          </label>
          {uploadErr && <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3.5 py-2.5 rounded-xl"><AlertCircle className="w-4 h-4 flex-shrink-0" />{uploadErr}</div>}
          {uploadMsg && <div className="flex items-center gap-2 text-emerald-700 text-sm bg-emerald-50 px-3.5 py-2.5 rounded-xl"><Activity className="w-4 h-4 flex-shrink-0" />{uploadMsg}</div>}
          <Btn onClick={handleUpload} disabled={uploading || !uploadFile} className="w-full justify-center !py-3">{uploading ? <><Loader2 className="w-4 h-4 animate-spin" />Uploading…</> : 'Upload & Import'}</Btn>
        </div>
      </ModalShell>
    </>
  )
}