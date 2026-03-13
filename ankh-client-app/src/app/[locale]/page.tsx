'use client'

import { useState, useEffect } from 'react'
import { Search, Loader2, AlertCircle, Users, Plus, Download, Upload, LogIn, UserPlus, MapPinPlus, Trash2, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Label } from '@/components/ui/label'
import { useRouter, usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import Cookies from 'js-cookie'
import React from 'react'

// ---------------------------------------------------------------------------
// Debounce hook
// ---------------------------------------------------------------------------
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])
  return debouncedValue
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type SearchType = 'customer' | 'instructor' | 'location'
type UserRole = 'MANAGER' | 'INSTRUCTOR'

interface User {
  id: string
  username: string
  role: UserRole
  firstName: string
  lastName: string
  email: string
  createdAt?: string
}

interface Location {
  id: string
  name: string
}

interface Customer {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  createdAt?: string
  deletedAt?: string | null
  lessonParticipants?: CustomerLessonParticipant[]
}

interface CustomerLessonParticipant {
  id: string
  lesson: {
    id: string
    lessonType?: string
    lessonContent?: string
    createdAt?: string
    instructor: {
      firstName: string
      lastName: string
    }
    location?: { name: string }
  }
  customerSymptoms?: string
  customerImprovements?: string
  status?: string
}

interface LessonFormData {
  lessonDate: string
  instructorId: string
  locationId: string
  lessonType: 'Group' | 'Individual'
  lessonContent: string
  customers: CustomerFormData[]
}

interface CustomerFormData {
  id?: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  symptoms: string
  improvements: string
}

interface UserFormData {
  username: string
  password: string
  role: UserRole
  firstName: string
  lastName: string
  email: string
}

// ---------------------------------------------------------------------------
// Toast component
// ---------------------------------------------------------------------------
const Toast = ({ message, onClose }: { message: string; onClose: () => void }) => (
  <div className="fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50">
    <span>{message}</span>
    <button className="ml-4 text-sm underline" onClick={onClose}>Close</button>
  </div>
)

// ---------------------------------------------------------------------------
// Shimmer rows
// ---------------------------------------------------------------------------
const ShimmerRows = ({ count = 8 }: { count?: number }) => (
  <div className="mt-6">
    {[...Array(count)].map((_, idx) => (
      <div key={idx} className="flex items-center space-x-4 py-4 border-b last:border-none">
        <div className="h-5 w-36 rounded-lg bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 shimmer" />
        <div className="h-5 w-48 rounded-lg bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 shimmer" />
        <div className="h-5 w-28 rounded-lg bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 shimmer" />
        <div className="h-5 w-32 rounded-lg bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 shimmer" />
        <div className="h-8 w-28 rounded-xl bg-gradient-to-r from-gray-300 via-gray-400 to-gray-300 shimmer" />
      </div>
    ))}
    <style jsx>{`
      .shimmer { position: relative; overflow: hidden; }
      .shimmer::before {
        content: '';
        position: absolute;
        top: 0; left: -150px;
        height: 100%; width: 150px;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent);
        animation: shimmerMove 1.2s infinite;
      }
      @keyframes shimmerMove { 0% { left: -150px; } 100% { left: 100%; } }
    `}</style>
  </div>
)

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function HomePage() {
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations()
  const locale = pathname.split('/')[1] || 'en'

  const formatName = (firstName: string, lastName: string): string =>
    locale === 'ko' ? `${lastName} ${firstName}` : `${firstName} ${lastName}`

  // --- Auth state ---
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [showLoginDialog, setShowLoginDialog] = useState(false)
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [errorMessage, setErrorMessage] = useState('')

  // --- Search state ---
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 400)
  const [page, setPage] = useState(1)
  const pageSize = 20
  const [searchType] = useState<SearchType>('customer')
  const [isLoading, setIsLoading] = useState(false)
  const [isError, setIsError] = useState(false)
  const [errorMessageSearch, setErrorMessageSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Customer[]>([])
  const [totalResults, setTotalResults] = useState(0)
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null)

  // --- Customer count / system status ---
  const [customerCount, setCustomerCount] = useState<number | null>(null)

  // --- View All Customers panel state ---
  const [showAllCustomersDialog, setShowAllCustomersDialog] = useState(false)
  const [allCustomers, setAllCustomers] = useState<Customer[]>([])
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false)
  const [allCustomersPage, setAllCustomersPage] = useState(1)
  const [allCustomersTotalPages, setAllCustomersTotalPages] = useState(1)
  const ALL_CUSTOMERS_PAGE_SIZE = 50

  // --- Customer detail modal state ---
  const [selectedCustomerInfo, setSelectedCustomerInfo] = useState<Customer | null>(null)
  const [isLoadingCustomerDetails, setIsLoadingCustomerDetails] = useState(false)

  // --- Edit customer state ---
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [editCustomerForm, setEditCustomerForm] = useState({ firstName: '', lastName: '', email: '', phone: '' })
  const [isSavingCustomerEdit, setIsSavingCustomerEdit] = useState(false)
  const [editCustomerError, setEditCustomerError] = useState<string | null>(null)

  // --- Delete state ---
  const [isDeletingCustomer, setIsDeletingCustomer] = useState(false)
  const [isDeletingLesson, setIsDeletingLesson] = useState(false)

  // --- Confirm dialog ---
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [confirmDialogData, setConfirmDialogData] = useState<{
    title: string; message: string; onConfirm: () => void
  } | null>(null)

  // --- Toast ---
  const [toastMessage, setToastMessage] = useState('')

  // --- Instructors / Locations ---
  const [instructors, setInstructors] = useState<User[]>([])
  const [locations, setLocations] = useState<Location[]>([])

  // --- Add user dialog ---
  const [showAddUserDialog, setShowAddUserDialog] = useState(false)
  const [userForm, setUserForm] = useState<UserFormData>({
    username: '', password: '', role: 'INSTRUCTOR',
    firstName: '', lastName: '', email: ''
  })
  const [isAddingUser, setIsAddingUser] = useState(false)
  const [addUserError, setAddUserError] = useState('')

  // --- View all users ---
  const [showAllUsersDialog, setShowAllUsersDialog] = useState(false)
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [userRoleFilter, setUserRoleFilter] = useState<'ALL' | 'MANAGER' | 'INSTRUCTOR'>('ALL')
  const [isDeletingUser, setIsDeletingUser] = useState(false)
  const [selectedUserInfo, setSelectedUserInfo] = useState<User | null>(null)

  // --- Add location ---
  const [showAddLocationDialog, setShowAddLocationDialog] = useState(false)
  const [locationForm, setLocationForm] = useState({ name: '' })
  const [isAddingLocation, setIsAddingLocation] = useState(false)
  const [addLocationError, setAddLocationError] = useState('')

  // --- Lesson form ---
  const [lessonForm, setLessonForm] = useState<LessonFormData>({
    lessonDate: '', instructorId: '', locationId: '',
    lessonType: 'Group', lessonContent: '',
    customers: [{ firstName: '', lastName: '', email: '', phone: '', symptoms: '', improvements: '' }]
  })
  const [isCreatingLesson, setIsCreatingLesson] = useState(false)
  const [lessonError, setLessonError] = useState('')
  const [lessonSuccess, setLessonSuccess] = useState('')

  // --- File upload ---
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadMessage, setUploadMessage] = useState('')
  const [uploadError, setUploadError] = useState('')

  // -------------------------------------------------------------------------
  // Restore auth from cookies on mount (zero extra API calls)
  // -------------------------------------------------------------------------
  useEffect(() => {
    const token = Cookies.get('jwt-token')
    if (token) {
      const userData = Cookies.get('current-user-data')
      if (userData) {
        setCurrentUser(JSON.parse(userData))
        setIsLoggedIn(true)
      }
    }
  }, [])

  // -------------------------------------------------------------------------
  // On login: load instructors, locations, and customer count in parallel.
  // We do NOT load all customers here — that only happens when the panel opens.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (isLoggedIn) {
      fetchInstructors()
      fetchLocations()
      fetchCustomerCount()
    }
  }, [isLoggedIn])

  // -------------------------------------------------------------------------
  // Fetch customer count only (cheap single-row query)
  // -------------------------------------------------------------------------
  const fetchCustomerCount = async () => {
    try {
      const res = await fetch('/api/customers?limit=1')
      if (res.ok) {
        const data = await res.json()
        setCustomerCount(data.total ?? null)
      }
    } catch {
      // Non-critical — silently ignore
    }
  }

  // -------------------------------------------------------------------------
  // Search with debounce + pagination
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (debouncedSearchTerm.length < 2) {
      setSearchResults([])
      setTotalResults(0)
      return
    }
    setIsLoading(true)
    setIsError(false)
    setErrorMessageSearch('')
    fetch(
      `/api/customers/search?name=${encodeURIComponent(debouncedSearchTerm)}&take=${pageSize}&skip=${(page - 1) * pageSize}`
    )
      .then(res => res.json())
      .then(data => {
        setSearchResults(data.customers || [])
        setTotalResults(data.total || 0)
      })
      .catch(() => {
        setIsError(true)
        setErrorMessageSearch('Failed to fetch customers')
      })
      .finally(() => setIsLoading(false))
  }, [debouncedSearchTerm, page])

  const totalPages = Math.ceil(totalResults / pageSize) || 1
  const handlePrevPage = () => setPage(p => Math.max(1, p - 1))
  const handleNextPage = () => setPage(p => (p < totalPages ? p + 1 : p))

  // -------------------------------------------------------------------------
  // Re-run search (e.g. after a delete)
  // -------------------------------------------------------------------------
  const handleSearch = () => {
    if (debouncedSearchTerm.length < 2) return
    setIsLoading(true)
    fetch(
      `/api/customers/search?name=${encodeURIComponent(debouncedSearchTerm)}&take=${pageSize}&skip=${(page - 1) * pageSize}`
    )
      .then(res => res.json())
      .then(data => {
        setSearchResults(data.customers || [])
        setTotalResults(data.total || 0)
      })
      .catch(() => setIsError(true))
      .finally(() => setIsLoading(false))
  }

  const toggleExpandCustomer = (id: string) =>
    setExpandedCustomerId(prev => (prev === id ? null : id))

  // -------------------------------------------------------------------------
  // Instructors + Locations
  // -------------------------------------------------------------------------
  const fetchInstructors = async () => {
    const token = Cookies.get('jwt-token')
    if (!token) return
    try {
      const res = await fetch('/api/users/instructors', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setInstructors(data.results || [])
      }
    } catch (err) {
      console.error('Error fetching instructors:', err)
      setInstructors([])
    }
  }

  const fetchLocations = async () => {
    try {
      const res = await fetch('/api/locations')
      if (res.ok) {
        const data = await res.json()
        setLocations(data.locations || [])
      }
    } catch (err) {
      console.error('Error fetching locations:', err)
      setLocations([])
    }
  }

  // -------------------------------------------------------------------------
  // View All Customers — lazy-load, only fires when panel is opened.
  // Uses pagination so we never dump 1000 rows into the browser at once.
  // -------------------------------------------------------------------------
  const fetchAllCustomers = async (pageNum = 1) => {
    setIsLoadingCustomers(true)
    try {
      const res = await fetch(`/api/customers?page=${pageNum}&limit=${ALL_CUSTOMERS_PAGE_SIZE}`)
      if (res.ok) {
        const data = await res.json()
        setAllCustomers(data.customers || [])
        setAllCustomersTotalPages(data.totalPages || 1)
        setAllCustomersPage(pageNum)
        // Sync the header count too
        if (data.total != null) setCustomerCount(data.total)
      } else {
        setToastMessage('Failed to fetch customers')
      }
    } catch {
      setToastMessage('Error fetching customers')
    } finally {
      setIsLoadingCustomers(false)
    }
  }

  // -------------------------------------------------------------------------
  // View All Users — lazy-load same pattern
  // -------------------------------------------------------------------------
  const fetchAllUsers = async () => {
    setIsLoadingUsers(true)
    try {
      const res = await fetch('/api/users')
      if (res.ok) {
        const data = await res.json()
        setAllUsers(data.users || [])
      } else {
        setToastMessage('Failed to fetch users')
      }
    } catch {
      setToastMessage('Error fetching users')
    } finally {
      setIsLoadingUsers(false)
    }
  }

  // -------------------------------------------------------------------------
  // Customer detail — loads full lesson history on-demand
  // -------------------------------------------------------------------------
  const handleViewCustomerDetails = async (customerId: string) => {
    setIsLoadingCustomerDetails(true)
    // Show a placeholder immediately while the full record loads
    const preview = allCustomers.find(c => c.id === customerId) ||
                    searchResults.find(c => c.id === customerId) || null
    setSelectedCustomerInfo(preview)
    try {
      const res = await fetch(`/api/customers/${customerId}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedCustomerInfo(data.customer)
      }
    } catch (err) {
      console.error('Error fetching customer details:', err)
    } finally {
      setIsLoadingCustomerDetails(false)
    }
  }

  // -------------------------------------------------------------------------
  // Delete customer
  // -------------------------------------------------------------------------
  const handleDeleteCustomer = (customerId: string, customerName: string) => {
    setConfirmDialogData({
      title: 'Delete Customer',
      message: `Are you sure you want to delete "${customerName}"? This will also delete all their lesson records.`,
      onConfirm: async () => {
        const token = Cookies.get('jwt-token')
        if (!token) { setToastMessage('You must be logged in as a manager.'); return }
        setIsDeletingCustomer(true)
        try {
          const res = await fetch(`/api/customers/${customerId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          })
          if (res.ok) {
            setToastMessage('Customer deleted successfully!')
            setSearchResults(prev => prev.filter(r => r.id !== customerId))
            setAllCustomers(prev => prev.filter(c => c.id !== customerId))
            setSelectedCustomerInfo(prev => prev?.id === customerId ? null : prev)
            fetchCustomerCount()
          } else {
            const err = await res.json()
            setToastMessage(err.error || 'Failed to delete customer.')
          }
        } catch {
          setToastMessage('An unexpected error occurred.')
        } finally {
          setIsDeletingCustomer(false)
          setShowConfirmDialog(false)
        }
      }
    })
    setShowConfirmDialog(true)
  }

  // -------------------------------------------------------------------------
  // Delete lesson participant
  // -------------------------------------------------------------------------
  const handleDeleteLessonParticipant = (customerId: string, lessonId: string, customerName: string) => {
    setConfirmDialogData({
      title: 'Delete Lesson Record',
      message: `Are you sure you want to delete this lesson record for "${customerName}"?`,
      onConfirm: async () => {
        const token = Cookies.get('jwt-token')
        if (!token) { setToastMessage('You must be logged in as a manager.'); return }
        setIsDeletingLesson(true)
        try {
          const res = await fetch(`/api/lessons/${lessonId}/participants/${customerId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          })
          if (res.ok) {
            setToastMessage('Lesson record deleted successfully!')
            handleSearch()
          } else {
            const err = await res.json()
            setToastMessage(err.error || 'Failed to delete lesson record.')
          }
        } catch {
          setToastMessage('An unexpected error occurred.')
        } finally {
          setIsDeletingLesson(false)
          setShowConfirmDialog(false)
        }
      }
    })
    setShowConfirmDialog(true)
  }

  // -------------------------------------------------------------------------
  // Edit customer
  // -------------------------------------------------------------------------
  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer)
    setEditCustomerForm({
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      phone: customer.phone || ''
    })
    setEditCustomerError(null)
  }

  const handleSaveCustomerEdit = async () => {
    if (!editingCustomer) return
    if (!editCustomerForm.firstName || !editCustomerForm.lastName || !editCustomerForm.email) {
      setEditCustomerError('First name, last name, and email are required.')
      return
    }
    setIsSavingCustomerEdit(true)
    setEditCustomerError(null)
    const token = Cookies.get('jwt-token')
    try {
      const res = await fetch(`/api/customers/${editingCustomer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(editCustomerForm)
      })
      if (res.ok) {
        const data = await res.json()
        setToastMessage('Customer updated successfully!')
        setEditingCustomer(null)
        // Update in-place in both lists
        const updated = data.customer
        setAllCustomers(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c))
        setSearchResults(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c))
        if (selectedCustomerInfo?.id === updated.id) setSelectedCustomerInfo({ ...selectedCustomerInfo, ...updated })
      } else {
        const err = await res.json()
        setEditCustomerError(err.error || 'Failed to update customer.')
      }
    } catch {
      setEditCustomerError('An unexpected error occurred.')
    } finally {
      setIsSavingCustomerEdit(false)
    }
  }

  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      })
      if (res.ok) {
        const data = await res.json()
        Cookies.set('jwt-token', data.token, { expires: 1 })
        const userToStore = { firstName: data.user.firstName, lastName: data.user.lastName, role: data.user.role }
        Cookies.set('current-user-data', JSON.stringify(userToStore), { expires: 7 })
        setCurrentUser(data.user)
        setIsLoggedIn(true)
        setShowLoginDialog(false)
        setLoginForm({ username: '', password: '' })
      } else {
        const err = await res.json()
        setErrorMessage(err.error)
      }
    } catch {
      setErrorMessage(t('HomePage.loginFailed'))
    }
  }

  const handleLogout = () => {
    Cookies.remove('jwt-token')
    Cookies.remove('current-user-data')
    setCurrentUser(null)
    setIsLoggedIn(false)
    setSearchResults([])
    setAllCustomers([])
    setAllUsers([])
  }

  // -------------------------------------------------------------------------
  // Add user
  // -------------------------------------------------------------------------
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userForm.username || !userForm.password || !userForm.firstName || !userForm.lastName || !userForm.email) {
      setAddUserError('All fields are required.')
      return
    }
    setIsAddingUser(true)
    setAddUserError('')
    const token = Cookies.get('jwt-token')
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(userForm)
      })
      if (res.ok) {
        setToastMessage('User created successfully!')
        setShowAddUserDialog(false)
        setUserForm({ username: '', password: '', role: 'INSTRUCTOR', firstName: '', lastName: '', email: '' })
        if (showAllUsersDialog) fetchAllUsers()
      } else {
        const err = await res.json()
        setAddUserError(err.error || 'Failed to create user.')
      }
    } catch {
      setAddUserError('An unexpected error occurred.')
    } finally {
      setIsAddingUser(false)
    }
  }

  // -------------------------------------------------------------------------
  // Delete user
  // -------------------------------------------------------------------------
  const handleDeleteUser = (userId: string, userName: string) => {
    setConfirmDialogData({
      title: 'Delete User',
      message: `Are you sure you want to delete "${userName}"?`,
      onConfirm: async () => {
        const token = Cookies.get('jwt-token')
        setIsDeletingUser(true)
        try {
          const res = await fetch(`/api/users/${userId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          })
          if (res.ok) {
            setToastMessage('User deleted successfully!')
            setAllUsers(prev => prev.filter(u => u.id !== userId))
          } else {
            const err = await res.json()
            setToastMessage(err.error || 'Failed to delete user.')
          }
        } catch {
          setToastMessage('An unexpected error occurred.')
        } finally {
          setIsDeletingUser(false)
          setShowConfirmDialog(false)
        }
      }
    })
    setShowConfirmDialog(true)
  }

  // -------------------------------------------------------------------------
  // Add location
  // -------------------------------------------------------------------------
  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!locationForm.name.trim()) { setAddLocationError('Location name is required.'); return }
    setIsAddingLocation(true)
    setAddLocationError('')
    try {
      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: locationForm.name.trim() })
      })
      if (res.ok) {
        setToastMessage('Location created successfully!')
        setShowAddLocationDialog(false)
        setLocationForm({ name: '' })
        fetchLocations()
      } else {
        const err = await res.json()
        setAddLocationError(err.error || 'Failed to create location.')
      }
    } catch {
      setAddLocationError('An unexpected error occurred.')
    } finally {
      setIsAddingLocation(false)
    }
  }

  // -------------------------------------------------------------------------
  // File upload
  // -------------------------------------------------------------------------
  const handleFileUpload = async () => {
    if (!uploadFile) { setUploadError('Please select a file.'); return }
    setIsUploading(true)
    setUploadMessage('')
    setUploadError('')
    const token = Cookies.get('jwt-token')
    const formData = new FormData()
    formData.append('file', uploadFile)
    try {
      const res = await fetch('/api/import-csv', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      })
      const data = await res.json()
      if (res.ok) {
        setUploadMessage(data.message || 'File uploaded successfully!')
        setUploadFile(null)
        fetchCustomerCount()
        if (showAllCustomersDialog) fetchAllCustomers(1)
      } else {
        setUploadError(data.error || 'Upload failed.')
      }
    } catch {
      setUploadError('An unexpected error occurred during upload.')
    } finally {
      setIsUploading(false)
    }
  }

  // =========================================================================
  // RENDER
  // =========================================================================
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast */}
      {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage('')} />}

      {/* Confirm dialog */}
      {showConfirmDialog && confirmDialogData && (
        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{confirmDialogData.title}</DialogTitle>
              <DialogDescription>{confirmDialogData.message}</DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>Cancel</Button>
              <Button variant="destructive" onClick={confirmDialogData.onConfirm}>Confirm</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{t('HomePage.title')}</h1>
              {customerCount !== null && (
                <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  {customerCount} {t('HomePage.customers')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <LanguageSwitcher />
              {isLoggedIn ? (
                <>
                  <span className="text-sm text-gray-600">
                    {t('Auth.welcome')}, {currentUser && formatName(currentUser.firstName, currentUser.lastName)} ({currentUser?.role})
                  </span>
                  <Button variant="outline" onClick={handleLogout}>{t('Auth.logout')}</Button>
                </>
              ) : (
                <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
                  <DialogTrigger asChild>
                    <Button><LogIn className="mr-2 h-4 w-4" />{t('Auth.login')}</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t('Auth.login')}</DialogTitle>
                      <DialogDescription>{t('HomePage.loginCredentials')}</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleLogin} className="space-y-4">
                      <div>
                        <Label htmlFor="username">{t('Auth.username')}</Label>
                        <Input id="username" className="my-2" value={loginForm.username}
                          onChange={e => setLoginForm({ ...loginForm, username: e.target.value })} required />
                      </div>
                      <div>
                        <Label htmlFor="password">{t('Auth.password')}</Label>
                        <Input id="password" className="my-2" type="password" value={loginForm.password}
                          onChange={e => setLoginForm({ ...loginForm, password: e.target.value })} required />
                      </div>
                      {errorMessage && <p className="text-red-600 text-sm">{errorMessage}</p>}
                      <Button type="submit" className="w-full">{t('Auth.login')}</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!isLoggedIn ? (
          <Card className="text-center">
            <CardHeader>
              <CardTitle>{t('HomePage.welcomeTitle')}</CardTitle>
              <CardDescription>{t('HomePage.welcomeDesc')}</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            {/* ── Action buttons ── */}
            <div className="flex flex-wrap justify-center gap-3 mb-8">
              <Button onClick={() => router.push(`/${locale}/add-record`)} className="px-6">
                <Plus className="mr-2 h-4 w-4" />{t('HomePage.addNewRecord')}
              </Button>

              <a href="/api/export-csv" download="customer_records.csv" className="inline-block">
                <Button variant="outline" className="px-6">
                  <Download className="mr-2 h-4 w-4" />{t('HomePage.exportCSV')}
                </Button>
              </a>

              {/* File upload */}
              <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="px-6">
                    <Upload className="mr-2 h-4 w-4" />{t('HomePage.importCSV')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('HomePage.importCSV')}</DialogTitle>
                    <DialogDescription>Upload a CSV or Excel file to import customer records.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Input type="file" accept=".csv,.xlsx,.xls"
                      onChange={e => { setUploadFile(e.target.files?.[0] || null); setUploadError(''); setUploadMessage('') }} />
                    {uploadError && <p className="text-red-600 text-sm">{uploadError}</p>}
                    {uploadMessage && <p className="text-green-600 text-sm">{uploadMessage}</p>}
                    <Button onClick={handleFileUpload} disabled={isUploading || !uploadFile} className="w-full">
                      {isUploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading...</> : 'Upload'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {currentUser?.role === 'MANAGER' && (
                <>
                  {/* View All Users */}
                  <Button variant="outline" className="px-6"
                    onClick={() => {
                      const next = !showAllUsersDialog
                      setShowAllUsersDialog(next)
                      if (next && allUsers.length === 0) fetchAllUsers()
                    }}>
                    <Users className="mr-2 h-4 w-4" />
                    {showAllUsersDialog ? 'Hide Users' : 'View All Users'}
                  </Button>

                  {/* View All Customers */}
                  <Button variant="outline" className="px-6"
                    onClick={() => {
                      const next = !showAllCustomersDialog
                      setShowAllCustomersDialog(next)
                      // Only fetch on open, and only if we haven't loaded page 1 yet
                      if (next && allCustomers.length === 0) fetchAllCustomers(1)
                    }}>
                    <Users className="mr-2 h-4 w-4" />
                    {showAllCustomersDialog ? 'Hide Customers' : 'View All Customers'}
                  </Button>

                  {/* Add User */}
                  <Dialog open={showAddUserDialog} onOpenChange={setShowAddUserDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="px-6">
                        <UserPlus className="mr-2 h-4 w-4" />{t('HomePage.addUser')}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{t('HomePage.addUser')}</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleAddUser} className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>First Name</Label>
                            <Input className="mt-1" value={userForm.firstName}
                              onChange={e => setUserForm({ ...userForm, firstName: e.target.value })} required />
                          </div>
                          <div>
                            <Label>Last Name</Label>
                            <Input className="mt-1" value={userForm.lastName}
                              onChange={e => setUserForm({ ...userForm, lastName: e.target.value })} required />
                          </div>
                        </div>
                        <div>
                          <Label>Email</Label>
                          <Input className="mt-1" type="email" value={userForm.email}
                            onChange={e => setUserForm({ ...userForm, email: e.target.value })} required />
                        </div>
                        <div>
                          <Label>Username</Label>
                          <Input className="mt-1" value={userForm.username}
                            onChange={e => setUserForm({ ...userForm, username: e.target.value })} required />
                        </div>
                        <div>
                          <Label>Password</Label>
                          <Input className="mt-1" type="password" value={userForm.password}
                            onChange={e => setUserForm({ ...userForm, password: e.target.value })} required />
                        </div>
                        <div>
                          <Label>Role</Label>
                          <Select value={userForm.role} onValueChange={(v: UserRole) => setUserForm({ ...userForm, role: v })}>
                            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="INSTRUCTOR">Instructor</SelectItem>
                              <SelectItem value="MANAGER">Manager</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {addUserError && <p className="text-red-600 text-sm">{addUserError}</p>}
                        <Button type="submit" className="w-full" disabled={isAddingUser}>
                          {isAddingUser ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : 'Create User'}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>

                  {/* Add Location */}
                  <Dialog open={showAddLocationDialog} onOpenChange={setShowAddLocationDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="px-6">
                        <MapPinPlus className="mr-2 h-4 w-4" />{t('HomePage.addLocation')}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{t('HomePage.addLocation')}</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleCreateLocation} className="space-y-4">
                        <div>
                          <Label>Location Name</Label>
                          <Input className="mt-1" value={locationForm.name}
                            onChange={e => setLocationForm({ name: e.target.value })} required />
                        </div>
                        {addLocationError && <p className="text-red-600 text-sm">{addLocationError}</p>}
                        <Button type="submit" className="w-full" disabled={isAddingLocation}>
                          {isAddingLocation ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : 'Create Location'}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>

                  {/* Manage Users link */}
                  <Button variant="outline" className="px-6" onClick={() => router.push(`/${locale}/manage-users`)}>
                    <Settings className="mr-2 h-4 w-4" />Manage Users
                  </Button>
                </>
              )}
            </div>

            {/* ── Search ── */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>{t('CustomerSearch.title')}</CardTitle>
                <CardDescription>{t('CustomerSearch.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder={t('CustomerSearch.placeholder')}
                      value={searchTerm}
                      onChange={e => { setSearchTerm(e.target.value); setPage(1) }}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Search results */}
                {isLoading && (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  </div>
                )}

                {isError && (
                  <div className="flex items-center gap-2 text-red-600 py-4">
                    <AlertCircle className="h-4 w-4" />
                    <span>{errorMessageSearch}</span>
                  </div>
                )}

                {!isLoading && searchResults.length > 0 && (
                  <div className="mt-4 space-y-3">
                    {searchResults.map(customer => (
                      <div key={customer.id} className="border rounded-lg overflow-hidden">
                        <div
                          className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                          onClick={() => toggleExpandCustomer(customer.id)}
                        >
                          <div>
                            <p className="font-medium">{formatName(customer.firstName, customer.lastName)}</p>
                            <p className="text-sm text-gray-500">{customer.email}</p>
                            {customer.phone && <p className="text-sm text-gray-500">{customer.phone}</p>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">
                              {customer.lessonParticipants?.length || 0} lessons (preview)
                            </span>
                            {currentUser?.role === 'MANAGER' && (
                              <>
                                <Button variant="outline" size="sm"
                                  onClick={e => { e.stopPropagation(); handleEditCustomer(customer) }}>
                                  Edit
                                </Button>
                                <Button variant="destructive" size="sm"
                                  onClick={e => { e.stopPropagation(); handleDeleteCustomer(customer.id, formatName(customer.firstName, customer.lastName)) }}
                                  disabled={isDeletingCustomer}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>

                        {expandedCustomerId === customer.id && (
                          <div className="border-t bg-gray-50 p-4">
                            <div className="flex justify-between items-center mb-3">
                              <h4 className="text-sm font-medium">{t('CustomerSearch.lessonDetails')}</h4>
                              <Button size="sm" variant="outline"
                                onClick={() => handleViewCustomerDetails(customer.id)}>
                                View Full History
                              </Button>
                            </div>
                            {customer.lessonParticipants && customer.lessonParticipants.length > 0 ? (
                              <div className="space-y-3">
                                {customer.lessonParticipants.map(lp => (
                                  <div key={lp.id} className="bg-white rounded p-3 border text-sm">
                                    <div className="flex justify-between">
                                      <span className="font-medium">
                                        {lp.lesson.createdAt ? new Date(lp.lesson.createdAt).toLocaleDateString() : 'N/A'}
                                        {' — '}{lp.lesson.lessonType}
                                      </span>
                                      <span className="text-gray-500">
                                        {formatName(lp.lesson.instructor.firstName, lp.lesson.instructor.lastName)}
                                      </span>
                                    </div>
                                    {lp.customerSymptoms && (
                                      <p className="text-gray-600 mt-1"><span className="font-medium">Symptoms:</span> {lp.customerSymptoms}</p>
                                    )}
                                    {lp.customerImprovements && (
                                      <p className="text-gray-600"><span className="font-medium">Improvements:</span> {lp.customerImprovements}</p>
                                    )}
                                    {currentUser?.role === 'MANAGER' && (
                                      <Button variant="destructive" size="sm" className="mt-2"
                                        onClick={() => handleDeleteLessonParticipant(customer.id, lp.lesson.id, formatName(customer.firstName, customer.lastName))}
                                        disabled={isDeletingLesson}>
                                        Delete Lesson
                                      </Button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500">No lesson records found.</p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Search pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between pt-4">
                        <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={page === 1}>Previous</Button>
                        <span className="text-sm text-gray-500">Page {page} of {totalPages} ({totalResults} results)</span>
                        <Button variant="outline" size="sm" onClick={handleNextPage} disabled={page === totalPages}>Next</Button>
                      </div>
                    )}
                  </div>
                )}

                {!isLoading && !isError && debouncedSearchTerm.length >= 2 && searchResults.length === 0 && (
                  <p className="text-center text-gray-500 py-8">{t('CustomerSearch.noResults')}</p>
                )}
              </CardContent>
            </Card>

            {/* ── All Users panel ── */}
            {currentUser?.role === 'MANAGER' && showAllUsersDialog && (
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle>All Users</CardTitle>
                  <CardDescription>View and manage all users in the system</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2 mb-4">
                    {(['ALL', 'MANAGER', 'INSTRUCTOR'] as const).map(role => (
                      <Button key={role} size="sm"
                        variant={userRoleFilter === role ? 'default' : 'outline'}
                        onClick={() => setUserRoleFilter(role)}>
                        {role}
                      </Button>
                    ))}
                  </div>
                  {isLoadingUsers ? <ShimmerRows count={5} /> : (
                    <div className="overflow-x-auto">
                      <Table className="table-fixed w-full">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[20%] px-4 py-3">Name</TableHead>
                            <TableHead className="w-[25%] px-4 py-3">Email</TableHead>
                            <TableHead className="w-[15%] px-4 py-3">Username</TableHead>
                            <TableHead className="w-[10%] px-4 py-3">Role</TableHead>
                            <TableHead className="w-[15%] px-4 py-3">Created</TableHead>
                            <TableHead className="w-[15%] px-4 py-3 text-center">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {allUsers.filter(u => userRoleFilter === 'ALL' || u.role === userRoleFilter).length > 0
                            ? allUsers
                                .filter(u => userRoleFilter === 'ALL' || u.role === userRoleFilter)
                                .map(user => (
                                  <TableRow key={user.id}>
                                    <TableCell className="px-4 py-3">
                                      <button className="text-blue-600 hover:underline"
                                        onClick={() => setSelectedUserInfo(user)}>
                                        {formatName(user.firstName, user.lastName)}
                                      </button>
                                    </TableCell>
                                    <TableCell className="px-4 py-3 break-all">{user.email}</TableCell>
                                    <TableCell className="px-4 py-3">{user.username}</TableCell>
                                    <TableCell className="px-4 py-3">
                                      <span className={`px-2 py-1 rounded text-xs ${user.role === 'MANAGER' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                        {user.role}
                                      </span>
                                    </TableCell>
                                    <TableCell className="px-4 py-3">{new Date(user.createdAt || '').toLocaleDateString()}</TableCell>
                                    <TableCell className="px-4 py-3 text-center">
                                      <Button variant="destructive" size="sm"
                                        onClick={() => handleDeleteUser(user.id, formatName(user.firstName, user.lastName))}
                                        disabled={isDeletingUser}>
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))
                            : (
                              <TableRow>
                                <TableCell colSpan={6} className="text-center text-gray-500 py-8">No users found</TableCell>
                              </TableRow>
                            )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ── All Customers panel ── */}
            {currentUser?.role === 'MANAGER' && showAllCustomersDialog && (
              <Card className="mb-8">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>All Customers</CardTitle>
                      <CardDescription>
                        Page {allCustomersPage} of {allCustomersTotalPages}
                        {customerCount !== null && ` — ${customerCount} total`}
                      </CardDescription>
                    </div>
                    {/* Pagination controls at top of table */}
                    {allCustomersTotalPages > 1 && (
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm"
                          onClick={() => fetchAllCustomers(allCustomersPage - 1)}
                          disabled={allCustomersPage === 1 || isLoadingCustomers}>
                          Previous
                        </Button>
                        <Button variant="outline" size="sm"
                          onClick={() => fetchAllCustomers(allCustomersPage + 1)}
                          disabled={allCustomersPage === allCustomersTotalPages || isLoadingCustomers}>
                          Next
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoadingCustomers ? <ShimmerRows /> : (
                    <div className="overflow-x-auto">
                      <Table className="table-fixed w-full">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[22%] px-4 py-3 font-semibold">Name</TableHead>
                            <TableHead className="w-[25%] px-4 py-3 font-semibold">Email</TableHead>
                            <TableHead className="w-[15%] px-4 py-3 font-semibold">Phone</TableHead>
                            <TableHead className="w-[15%] px-4 py-3 font-semibold">Last Lesson</TableHead>
                            <TableHead className="w-[23%] px-4 py-3 font-semibold text-center">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {allCustomers.length > 0
                            ? allCustomers.map(customer => (
                              <TableRow key={customer.id}>
                                <TableCell className="px-4 py-3">
                                  <button className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                                    onClick={() => handleViewCustomerDetails(customer.id)}>
                                    {formatName(customer.firstName, customer.lastName)}
                                  </button>
                                </TableCell>
                                <TableCell className="px-4 py-3 break-all">{customer.email}</TableCell>
                                <TableCell className="px-4 py-3">{customer.phone || 'N/A'}</TableCell>
                                <TableCell className="px-4 py-3">
                                  {customer.lessonParticipants?.[0]?.lesson?.createdAt
                                    ? new Date(customer.lessonParticipants[0].lesson.createdAt).toLocaleDateString()
                                    : 'None'}
                                </TableCell>
                                <TableCell className="px-4 py-3 text-center flex gap-1 justify-center">
                                  <Button variant="outline" size="sm" onClick={() => handleEditCustomer(customer)}>Edit</Button>
                                  <Button variant="destructive" size="sm"
                                    onClick={() => handleDeleteCustomer(customer.id, formatName(customer.firstName, customer.lastName))}
                                    disabled={isDeletingCustomer}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                            : (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center text-gray-500 py-8">No customers found</TableCell>
                              </TableRow>
                            )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ── User info modal ── */}
            {selectedUserInfo && (
              <Dialog open={!!selectedUserInfo} onOpenChange={open => !open && setSelectedUserInfo(null)}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>{formatName(selectedUserInfo.firstName, selectedUserInfo.lastName)}</DialogTitle>
                    <DialogDescription>User Information</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div><Label className="text-xs text-gray-600">Username</Label><p className="font-medium">{selectedUserInfo.username}</p></div>
                    <div><Label className="text-xs text-gray-600">Email</Label><p className="font-medium break-all">{selectedUserInfo.email}</p></div>
                    <div>
                      <Label className="text-xs text-gray-600">Role</Label>
                      <p className="font-medium">
                        <span className={`px-2 py-1 rounded text-xs ${selectedUserInfo.role === 'MANAGER' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                          {selectedUserInfo.role}
                        </span>
                      </p>
                    </div>
                    <div><Label className="text-xs text-gray-600">Created</Label><p className="font-medium">{new Date(selectedUserInfo.createdAt || '').toLocaleString()}</p></div>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {/* ── Customer detail modal ── */}
            {selectedCustomerInfo && (
              <Dialog open={!!selectedCustomerInfo} onOpenChange={open => !open && setSelectedCustomerInfo(null)}>
                <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
                  <DialogHeader>
                    <DialogTitle>{formatName(selectedCustomerInfo.firstName, selectedCustomerInfo.lastName)}</DialogTitle>
                    <DialogDescription>Customer Information</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 overflow-y-auto flex-1 pr-4">
                    <div><Label className="text-xs text-gray-600">Email</Label><p className="font-medium break-all">{selectedCustomerInfo.email}</p></div>
                    <div><Label className="text-xs text-gray-600">Phone</Label><p className="font-medium">{selectedCustomerInfo.phone || 'N/A'}</p></div>
                    <div><Label className="text-xs text-gray-600">Created At</Label><p className="font-medium">{selectedCustomerInfo.createdAt ? new Date(selectedCustomerInfo.createdAt).toLocaleString() : 'N/A'}</p></div>

                    <div className="border-t pt-4">
                      <h4 className="text-sm font-medium mb-2">{t('CustomerSearch.lessonDetails')}</h4>
                      {isLoadingCustomerDetails ? (
                        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
                      ) : selectedCustomerInfo.lessonParticipants && selectedCustomerInfo.lessonParticipants.length > 0 ? (
                        <div className="space-y-3">
                          {selectedCustomerInfo.lessonParticipants.map((lp) => (
                            <div key={lp.id} className="border rounded p-3 bg-gray-50 text-sm">
                              <div className="flex justify-between items-start">
                                <div>
                                  <span className="font-medium">{lp.lesson.createdAt ? new Date(lp.lesson.createdAt).toLocaleDateString() : 'N/A'}</span>
                                  <span className="ml-2 text-gray-500">{lp.lesson.lessonType}</span>
                                  {lp.lesson.location && <span className="ml-2 text-gray-400">@ {lp.lesson.location.name}</span>}
                                </div>
                                <span className="text-gray-500">{formatName(lp.lesson.instructor.firstName, lp.lesson.instructor.lastName)}</span>
                              </div>
                              {lp.lesson.lessonContent && <p className="text-gray-600 mt-1">{lp.lesson.lessonContent}</p>}
                              {lp.customerSymptoms && <p className="text-gray-600 mt-1"><span className="font-medium">Symptoms:</span> {lp.customerSymptoms}</p>}
                              {lp.customerImprovements && <p className="text-gray-600"><span className="font-medium">Improvements:</span> {lp.customerImprovements}</p>}
                              <div className="flex gap-2 mt-2">
                                <span className={`text-xs px-2 py-0.5 rounded ${lp.status === 'attended' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                  {lp.status}
                                </span>
                                {currentUser?.role === 'MANAGER' && (
                                  <Button variant="destructive" size="sm"
                                    onClick={() => handleDeleteLessonParticipant(selectedCustomerInfo.id, lp.lesson.id, formatName(selectedCustomerInfo.firstName, selectedCustomerInfo.lastName))}
                                    disabled={isDeletingLesson}>
                                    Delete Lesson
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No lesson records found.</p>
                      )}
                    </div>

                    {currentUser?.role === 'MANAGER' && (
                      <div className="border-t pt-4 flex gap-2">
                        <Button variant="outline"
                          onClick={() => { handleEditCustomer(selectedCustomerInfo); setSelectedCustomerInfo(null) }}>
                          Edit Customer
                        </Button>
                        <Button variant="destructive"
                          onClick={() => { handleDeleteCustomer(selectedCustomerInfo.id, formatName(selectedCustomerInfo.firstName, selectedCustomerInfo.lastName)); setSelectedCustomerInfo(null) }}
                          disabled={isDeletingCustomer}>
                          Delete Customer
                        </Button>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {/* ── Edit customer modal ── */}
            {editingCustomer && (
              <Dialog open={!!editingCustomer} onOpenChange={open => !open && setEditingCustomer(null)}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Customer</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>First Name</Label>
                        <Input className="mt-1" value={editCustomerForm.firstName}
                          onChange={e => setEditCustomerForm({ ...editCustomerForm, firstName: e.target.value })} />
                      </div>
                      <div>
                        <Label>Last Name</Label>
                        <Input className="mt-1" value={editCustomerForm.lastName}
                          onChange={e => setEditCustomerForm({ ...editCustomerForm, lastName: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input className="mt-1" type="email" value={editCustomerForm.email}
                        onChange={e => setEditCustomerForm({ ...editCustomerForm, email: e.target.value })} />
                    </div>
                    <div>
                      <Label>Phone</Label>
                      <Input className="mt-1" value={editCustomerForm.phone}
                        onChange={e => setEditCustomerForm({ ...editCustomerForm, phone: e.target.value })} />
                    </div>
                    {editCustomerError && <p className="text-red-600 text-sm">{editCustomerError}</p>}
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => setEditingCustomer(null)}>Cancel</Button>
                      <Button onClick={handleSaveCustomerEdit} disabled={isSavingCustomerEdit}>
                        {isSavingCustomerEdit ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Save Changes'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </>
        )}
      </div>
    </div>
  )
}