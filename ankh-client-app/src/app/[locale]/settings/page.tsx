'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Loader2, AlertCircle, Check, User, Shield, Settings } from 'lucide-react'
import { useRouter, usePathname } from 'next/navigation'
import Cookies from 'js-cookie'

type Tab = 'visibility' | 'experience' | 'features'

interface Instructor {
  id: string
  firstName: string
  lastName: string
  email: string
  role: 'INSTRUCTOR' | 'MANAGER'
  isActive: boolean
}

function formatName(firstName: string, lastName: string) {
  if (!lastName) return firstName
  return `${lastName} ${firstName}`
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 ${on ? 'bg-gray-900' : 'bg-gray-200'}`}
      aria-checked={on}
      role="switch"
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

function InstructorCheckbox({
  instructor,
  checked,
  disabled,
  onChange
}: {
  instructor: Instructor
  checked: boolean
  disabled: boolean
  onChange: (checked: boolean) => void
}) {
  const isKorean = /[\uAC00-\uD7AF]/.test(instructor.firstName + instructor.lastName)
  return (
    <label className={`flex items-center gap-3 p-3 rounded-xl border transition-colors cursor-pointer select-none ${disabled ? 'opacity-40 cursor-not-allowed' : checked ? 'border-gray-300 bg-gray-50' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50/50'}`}>
      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${disabled ? 'border-gray-200 bg-gray-100' : checked ? 'border-gray-900 bg-gray-900' : 'border-gray-300 bg-white'}`}>
        {checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
      </div>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold ${instructor.role === 'MANAGER' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
        {isKorean
          ? `${instructor.lastName?.[0] ?? ''}${instructor.firstName?.[0] ?? ''}`
          : `${instructor.firstName?.[0] ?? ''}${instructor.lastName?.[0] ?? ''}`}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{formatName(instructor.firstName, instructor.lastName)}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {instructor.role === 'MANAGER'
            ? <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-blue-600"><Shield className="w-2.5 h-2.5" />Manager</span>
            : <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600"><User className="w-2.5 h-2.5" />Instructor</span>}
        </div>
      </div>
    </label>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const pathname = usePathname()
  const locale = pathname.split('/')[1] || 'en'

  const [activeTab, setActiveTab] = useState<Tab>('visibility')

  // Instructor visibility state
  const [instructors, setInstructors] = useState<Instructor[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filterEnabled, setFilterEnabled] = useState(false)
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [saveOk, setSaveOk] = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    const token = Cookies.get('jwt-token')
    if (!token) { router.push(`/${locale}`); return }
    loadInstructors(token)
  }, [])

  const loadInstructors = async (token: string) => {
    setLoading(true); setLoadError(null)
    try {
      const r = await fetch('/api/users/instructor-visibility', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!r.ok) { setLoadError('Failed to load instructors.'); return }
      const data = await r.json()
      const list: Instructor[] = data.instructors || []
      setInstructors(list)
      const anyInactive = list.some(i => !i.isActive)
      setFilterEnabled(anyInactive)
      setActiveIds(new Set(list.filter(i => i.isActive).map(i => i.id)))
    } catch {
      setLoadError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const toggleInstructor = (id: string, checked: boolean) => {
    setActiveIds(prev => {
      const next = new Set(prev)
      checked ? next.add(id) : next.delete(id)
      return next
    })
    setDirty(true); setSaveOk(false); setSaveErr(null)
  }

  const handleMasterToggle = (on: boolean) => {
    setFilterEnabled(on)
    if (!on) {
      // When filter off → mark all as active
      setActiveIds(new Set(instructors.map(i => i.id)))
    }
    setDirty(true); setSaveOk(false); setSaveErr(null)
  }

  const handleSave = async () => {
    setSaving(true); setSaveOk(false); setSaveErr(null)
    const token = Cookies.get('jwt-token')
    try {
      const updates = instructors.map(i => ({
        id: i.id,
        isActive: filterEnabled ? activeIds.has(i.id) : true
      }))
      const r = await fetch('/api/users/instructor-visibility', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ updates })
      })
      if (!r.ok) { const d = await r.json(); setSaveErr(d.error || 'Failed to save.'); return }
      setSaveOk(true); setDirty(false)
      setTimeout(() => setSaveOk(false), 3000)
    } catch {
      setSaveErr('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'visibility', label: 'App Visibility' },
    { id: 'experience', label: 'User Experience' },
    { id: 'features', label: 'Feature Management' },
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        html, body, * { font-family: 'DM Sans', system-ui, sans-serif; box-sizing: border-box; }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)} }
        .fade { animation: fadeIn .2s ease-out; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 99px; }
      `}</style>

      <div className="min-h-screen bg-[#f7f7f5]">

        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-40">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
            <button
              onClick={() => router.push(`/${locale}`)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </button>
            <div className="w-px h-5 bg-gray-200" />
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-gray-500" />
              <h1 className="text-[15px] font-semibold text-gray-900">Settings</h1>
              <span className="hidden sm:inline text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-2 py-0.5 bg-gray-100 rounded-full">Manager only</span>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 fade">

          {/* Page title */}
          <div className="mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Settings</h2>
            <p className="text-xs sm:text-sm text-gray-400 mt-1">ADMIN / MANAGER ONLY — Configure app visibility and preferences</p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 sm:gap-2 mb-6 overflow-x-auto pb-1 -mx-1 px-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-shrink-0 px-3 sm:px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-300'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* App Visibility tab */}
          {activeTab === 'visibility' && (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden fade">
              {/* Section header */}
              <div className="flex items-start sm:items-center justify-between gap-4 px-5 sm:px-6 py-5 border-b border-gray-50">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Instructor Visibility</h3>
                  <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
                    {loading ? 'Loading…' : `Select Instructors to Show (${instructors.length} Found)`}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs font-semibold ${filterEnabled ? 'text-gray-900' : 'text-gray-400'}`}>
                    {filterEnabled ? 'On' : 'Off'}
                  </span>
                  <Toggle on={filterEnabled} onChange={handleMasterToggle} />
                </div>
              </div>

              {/* Filter off notice */}
              {!filterEnabled && !loading && (
                <div className="px-5 sm:px-6 py-3 bg-amber-50 border-b border-amber-100">
                  <p className="text-xs text-amber-700 font-medium">All instructors are shown when filter is Off. Turn On to select specific instructors.</p>
                </div>
              )}

              {/* Content */}
              <div className="px-5 sm:px-6 py-5">
                {loading && (
                  <div className="space-y-3 animate-pulse">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100">
                        <div className="w-5 h-5 rounded-md bg-gray-100 flex-shrink-0" />
                        <div className="w-7 h-7 rounded-full bg-gray-100 flex-shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3.5 w-28 bg-gray-100 rounded-full" />
                          <div className="h-2.5 w-16 bg-gray-50 rounded-full" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {loadError && (
                  <div className="flex items-center gap-2.5 text-red-600 bg-red-50 px-4 py-3 rounded-xl text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />{loadError}
                  </div>
                )}

                {!loading && !loadError && instructors.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-8">No instructors found. Add users with the Instructor role first.</p>
                )}

                {!loading && !loadError && instructors.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {instructors.map(instructor => (
                      <InstructorCheckbox
                        key={instructor.id}
                        instructor={instructor}
                        checked={activeIds.has(instructor.id)}
                        disabled={!filterEnabled}
                        onChange={checked => toggleInstructor(instructor.id, checked)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              {!loading && !loadError && instructors.length > 0 && (
                <div className="px-5 sm:px-6 py-4 border-t border-gray-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    {saveOk && (
                      <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                        <Check className="w-3.5 h-3.5" />Changes saved successfully
                      </span>
                    )}
                    {saveErr && (
                      <span className="flex items-center gap-1.5 text-xs font-medium text-red-600">
                        <AlertCircle className="w-3.5 h-3.5" />{saveErr}
                      </span>
                    )}
                    {filterEnabled && !saveOk && !saveErr && (
                      <span className="text-xs text-gray-400">
                        {activeIds.size} of {instructors.length} instructors visible
                      </span>
                    )}
                  </div>
                  <button
                    onClick={handleSave}
                    disabled={saving || !dirty}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 disabled:opacity-40 transition-colors"
                  >
                    {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : 'Save Changes'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* User Experience tab — placeholder */}
          {activeTab === 'experience' && (
            <div className="bg-white rounded-2xl border border-gray-100 px-6 py-12 text-center fade">
              <div className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <Settings className="w-5 h-5 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-500">User Experience settings</p>
              <p className="text-xs text-gray-400 mt-1">Coming soon</p>
            </div>
          )}

          {/* Feature Management tab — placeholder */}
          {activeTab === 'features' && (
            <div className="bg-white rounded-2xl border border-gray-100 px-6 py-12 text-center fade">
              <div className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <Settings className="w-5 h-5 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-500">Feature Management settings</p>
              <p className="text-xs text-gray-400 mt-1">Coming soon</p>
            </div>
          )}
        </main>
      </div>
    </>
  )
}
