'use client'

import { useState, useEffect } from 'react'
import { Search, Loader2, ArrowLeft, UserPlus, Users, Edit, Check, X, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useRouter, usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Cookies from 'js-cookie'

// Helper: split "Full Name" → { firstName, lastName }
const splitFullName = (fullName: string): { firstName: string; lastName: string } => {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length <= 1) return { firstName: parts[0] || '', lastName: '' }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

interface User {
  id: string
  firstName: string
  lastName: string
  email: string
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
  lessonParticipants?: {
    lesson: {
      id: string
      instructor: {
        firstName: string
        lastName: string
      }
    }
    customerSymptoms: string | null
    customerImprovements: string | null
  }[]
}

interface CustomerFormData {
  id?: string
  name: string       // Single full-name field (UI only)
  firstName: string  // Split before submit
  lastName: string   // Split before submit
  email: string
  phone?: string
  symptoms: string
  improvements: string
  feedback: string
}

interface LessonFormData {
  instructorIds: string[]   // Array of instructor IDs (first is primary)
  locationId: string
  lessonType: 'Group' | 'Individual'
  lessonDate: string        // ISO date string, e.g. "2025-03-15"
  customers: CustomerFormData[]
}

export default function AddRecordPage() {
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations()
  const locale = pathname.split('/')[1] || 'en'
  const [step, setStep] = useState<'select-type' | 'search-customer' | 'form'>('select-type')
  const [customerType, setCustomerType] = useState<'new' | 'existing' | null>(null)

  // Helper function to format name based on locale
  const formatName = (firstName: string, lastName: string): string => {
    if (locale === 'ko') {
      return `${lastName} ${firstName}`
    }
    return `${firstName} ${lastName}`
  }

  // Search state
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<Customer[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)

  // Edit mode state (search screen)
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null)
  const [editFormData, setEditFormData] = useState<{ name: string; email: string; phone: string }>({ name: '', email: '', phone: '' })
  const [isEditingSaving, setIsEditingSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Form data
  const [instructors, setInstructors] = useState<User[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [lessonForm, setLessonForm] = useState<LessonFormData>({
    instructorIds: [''],
    locationId: '',
    lessonType: 'Group',
    lessonDate: '',
    customers: [{ name: '', firstName: '', lastName: '', email: '', phone: '', symptoms: '', improvements: '', feedback: '' }]
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState('')
  const [submitError, setSubmitError] = useState('')

  // Check authentication
  useEffect(() => {
    const token = Cookies.get('jwt-token')
    if (!token) {
      router.push(`/${locale}`)
    } else {
      fetchInstructors()
      fetchLocations()
    }
  }, [])

  const fetchInstructors = async () => {
    const token = Cookies.get('jwt-token')
    try {
      const response = await fetch('/api/users/instructors', {
        headers: { 'Authorization': `Bearer ${token}` },
        cache: 'no-store'
      })
      if (response.ok) {
        const data = await response.json()
        setInstructors(data.results || [])
      }
    } catch (error) {
      console.error('Error fetching instructors:', error)
    }
  }

  // Re-fetch instructors when tab becomes visible again (e.g. after saving Settings)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchInstructors()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/locations')
      if (response.ok) {
        const data = await response.json()
        setLocations(data.locations || [])
      }
    } catch (error) {
      console.error('Error fetching locations:', error)
    }
  }

  const handleCustomerTypeSelect = (type: 'new' | 'existing') => {
    setCustomerType(type)
    if (type === 'new') {
      setStep('form')
    } else {
      setStep('search-customer')
    }
  }

  const handleCustomerSearch = async () => {
    if (!searchTerm.trim()) return

    setIsSearching(true)
    setSearchError(null)
    setHasSearched(true)
    try {
      const response = await fetch(`/api/customers/search?name=${encodeURIComponent(searchTerm)}`)
      if (response.ok) {
        const data = await response.json()
        setSearchResults(data.customers || [])
      } else {
        setSearchError(t('AddRecord.searchFailed'))
        setSearchResults([])
      }
    } catch (error) {
      console.error('Error searching customers:', error)
      setSearchError(t('AddRecord.searchFailedGeneric'))
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const handleSelectExistingCustomer = (customer: Customer) => {
    setSelectedCustomer(customer)

    // Issue 2 fix: symptoms/improvements start empty for new lesson
    setLessonForm({
      ...lessonForm,
      customers: [{
        id: customer.id,
        name: formatName(customer.firstName, customer.lastName),
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone || '',
        symptoms: '',
        improvements: '',
        feedback: ''
      }]
    })
    setStep('form')
  }

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomerId(customer.id)
    setEditFormData({
      name: formatName(customer.firstName, customer.lastName),
      email: customer.email,
      phone: customer.phone || ''
    })
    setEditError(null)
  }

  const handleSaveCustomerEdit = async () => {
    if (!editingCustomerId) return

    if (!editFormData.name.trim() || !editFormData.email.trim()) {
      setEditError(t('AddRecord.requiredEditFields'))
      return
    }

    const { firstName, lastName } = splitFullName(editFormData.name)

    setIsEditingSaving(true)
    setEditError(null)
    const token = Cookies.get('jwt-token')

    try {
      const response = await fetch(`/api/customers/${editingCustomerId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          firstName,
          lastName,
          email: editFormData.email,
          phone: editFormData.phone || null
        })
      })

      if (response.ok) {
        setSearchResults(prev =>
          prev.map(customer =>
            customer.id === editingCustomerId
              ? { ...customer, firstName, lastName, email: editFormData.email, phone: editFormData.phone }
              : customer
          )
        )
        setEditingCustomerId(null)
      } else {
        const error = await response.json()
        setEditError(error.error || t('AddRecord.updateCustomerFailed'))
      }
    } catch (error) {
      console.error('Error updating customer:', error)
      setEditError(t('AddRecord.updateCustomerGeneric'))
    } finally {
      setIsEditingSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setEditingCustomerId(null)
    setEditFormData({ name: '', email: '', phone: '' })
    setEditError(null)
  }

  // Issue 7: Show "Add Another Customer" for Group lessons regardless of customerType
  const showAddCustomer = lessonForm.lessonType === 'Group'

  const addCustomerRow = () => {
    // For existing customer flow, additional rows are new customers (editable)
    setLessonForm({
      ...lessonForm,
      customers: [...lessonForm.customers, { name: '', firstName: '', lastName: '', email: '', phone: '', symptoms: '', improvements: '', feedback: '' }]
    })
  }

  const removeCustomerRow = (index: number) => {
    const newCustomers = lessonForm.customers.filter((_, i) => i !== index)
    setLessonForm({ ...lessonForm, customers: newCustomers })
  }

  const updateCustomerField = (index: number, field: keyof CustomerFormData, value: string) => {
    const newCustomers = [...lessonForm.customers]
    newCustomers[index] = { ...newCustomers[index], [field]: value }
    setLessonForm({ ...lessonForm, customers: newCustomers })
  }

  // Issue 4: instructor management
  const updateInstructorId = (index: number, value: string) => {
    const newIds = [...lessonForm.instructorIds]
    newIds[index] = value
    setLessonForm({ ...lessonForm, instructorIds: newIds })
  }

  const addInstructor = () => {
    setLessonForm({ ...lessonForm, instructorIds: [...lessonForm.instructorIds, ''] })
  }

  const removeInstructor = (index: number) => {
    const newIds = lessonForm.instructorIds.filter((_, i) => i !== index)
    setLessonForm({ ...lessonForm, instructorIds: newIds })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitError('')
    setSubmitMessage('')

    try {
      // Split full names before submitting
      const processedCustomers = lessonForm.customers.map(c => {
        if (c.name && (!c.firstName || !c.lastName)) {
          const { firstName, lastName } = splitFullName(c.name)
          return { ...c, firstName, lastName }
        }
        return c
      })

      const primaryInstructorId = lessonForm.instructorIds[0]
      const allInstructorIds = lessonForm.instructorIds.filter(id => id.trim() !== '')

      const payload = {
        lessonType: lessonForm.lessonType,
        lessonDate: lessonForm.lessonDate || undefined,
        instructorId: primaryInstructorId,
        instructorIds: allInstructorIds,
        location: lessonForm.locationId,
        customers: processedCustomers
      }

      const response = await fetch('/api/lessons/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        setSubmitMessage(t('AddRecord.successMessage'))
        setTimeout(() => {
          router.push(`/${locale}`)
        }, 2000)
      } else {
        const error = await response.json()
        setSubmitError(error.error || t('AddRecord.errorMessage'))
      }
    } catch (error) {
      setSubmitError(t('AddRecord.errorMessage'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-[#f7f7f5] to-[#f7f7f5]">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-5 h-16 flex items-center gap-3 flex-wrap">
          <button
            onClick={() => router.push(`/${locale}`)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-100 text-gray-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">{t('Common.back')}</span>
          </button>
          <div className="w-px h-7 bg-gray-200" />
          <div>
            <h1 className="text-[15px] font-semibold text-gray-900">{t('AddRecord.title')}</h1>
            <p className="text-xs text-gray-400 mt-0.5">{t('AddRecord.customerTypeDesc')}</p>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-5 py-6">
        {/* Step 1: Select Customer Type */}
        {step === 'select-type' && (
          <Card className="rounded-2xl border-gray-100 shadow-sm">
            <CardHeader>
              <CardTitle>{t('AddRecord.customerType')}</CardTitle>
              <CardDescription>
                {t('AddRecord.customerTypeDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card
                className="cursor-pointer rounded-2xl hover:border-gray-300 hover:shadow-md transition-all"
                onClick={() => handleCustomerTypeSelect('new')}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <UserPlus className="h-8 w-8 text-gray-900" />
                    <div>
                      <CardTitle className="text-lg">{t('AddRecord.newCustomer')}</CardTitle>
                      <CardDescription className="text-sm">
                        {t('AddRecord.newCustomerDesc')}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">
                    {t('AddRecord.newCustomerDesc')}
                  </p>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer rounded-2xl hover:border-gray-300 hover:shadow-md transition-all"
                onClick={() => handleCustomerTypeSelect('existing')}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Users className="h-8 w-8 text-gray-900" />
                    <div>
                      <CardTitle className="text-lg">{t('AddRecord.existingCustomer')}</CardTitle>
                      <CardDescription className="text-sm">
                        {t('AddRecord.existingCustomerDesc')}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">
                    {t('AddRecord.existingCustomerDesc')}
                  </p>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Search Existing Customer */}
        {step === 'search-customer' && (
          <Card className="rounded-2xl border-gray-100 shadow-sm">
            <CardHeader>
              <CardTitle>{t('AddRecord.searchCustomer')}</CardTitle>
              <CardDescription>
                {t('AddRecord.searchCustomerDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Input
                  placeholder={t('AddRecord.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value)
                    setHasSearched(false)
                    setSearchError(null)
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleCustomerSearch()}
                  className="flex-1"
                  spellCheck={false}
                  autoComplete="off"
                />
                <Button onClick={handleCustomerSearch} disabled={isSearching || !searchTerm.trim()}>
                  {isSearching ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-2 h-4 w-4" />
                  )}
                  {t('Common.search')}
                </Button>
              </div>

              {searchError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{searchError}</p>
                </div>
              )}

              {hasSearched && !isSearching && !searchError && searchResults.length === 0 && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-sm text-yellow-700">{t('AddRecord.noCustomersFound')}</p>
                </div>
              )}

              {searchResults.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-medium text-sm text-gray-700">{t('AddRecord.selectCustomer')}:</h3>
                  {searchResults.map((customer) => (
                    <div key={customer.id} className="space-y-2">
                      <Card className="rounded-2xl border-gray-100 hover:border-gray-200 transition-all">
                        <CardContent className="py-3">
                          <div className="flex justify-between items-start">
                            <div className="flex-1 cursor-pointer" onClick={() => handleSelectExistingCustomer(customer)} translate="no">
                              <p className="font-medium">{formatName(customer.firstName, customer.lastName)}</p>
                              <p className="text-sm text-gray-600">{customer.email}</p>
                              {customer.phone && (
                                <p className="text-sm text-gray-500">{customer.phone}</p>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditCustomer(customer)}
                              className="ml-2"
                            >
                              <Edit className="h-4 w-4 text-gray-700" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Edit Modal */}
                      {editingCustomerId === customer.id && (
                        <Card className="rounded-2xl border-gray-200 bg-gray-50">
                          <CardContent className="pt-6 space-y-4">
                            <div className="grid grid-cols-1 gap-4">
                              <div>
                                <Label>{t('AddRecord.name')} *</Label>
                                <Input
                                  value={editFormData.name}
                                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                                  placeholder={t('AddRecord.namePlaceholder')}
                                />
                              </div>
                              <div>
                                <Label>{t('CustomerSearch.email')} *</Label>
                                <Input
                                  type="email"
                                  value={editFormData.email}
                                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                                  placeholder={t('AddRecord.placeholderEmail')}
                                />
                              </div>
                              <div>
                                <Label>{t('Dialogs.phone')}</Label>
                                <Input
                                  value={editFormData.phone}
                                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                                  placeholder={t('AddRecord.placeholderPhone')}
                                />
                              </div>
                            </div>

                            {editError && (
                              <div className="p-2 bg-red-100 border border-red-300 rounded text-sm text-red-700">
                                {editError}
                              </div>
                            )}

                            <div className="flex gap-2 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleCancelEdit}
                                disabled={isEditingSaving}
                              >
                                <X className="h-4 w-4 mr-1" />
                                {t('Common.cancel')}
                              </Button>
                              <Button
                                size="sm"
                                onClick={handleSaveCustomerEdit}
                                disabled={isEditingSaving}
                              >
                                {isEditingSaving ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                    {t('Common.saving')}
                                  </>
                                ) : (
                                  <>
                                    <Check className="h-4 w-4 mr-1" />
                                    {t('Common.save')}
                                  </>
                                )}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <Button
                variant="outline"
                onClick={() => setStep('select-type')}
                className="w-full"
              >
                {t('Common.back')}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Lesson Form */}
        {step === 'form' && (
          <form onSubmit={handleSubmit}>
            <Card className="rounded-2xl border-gray-100 shadow-sm">
              <CardHeader>
                <CardTitle>{t('AddRecord.lessonInfo')}</CardTitle>
                <CardDescription>
                  {customerType === 'existing' && selectedCustomer
                    ? t('AddRecord.lessonInfoForCustomer', { customerName: formatName(selectedCustomer.firstName, selectedCustomer.lastName) })
                    : t('AddRecord.enterDetails')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Lesson Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                  {/* Multiple instructors — displayed horizontally */}
                  <div className="md:col-span-2">
                    <Label className="mb-2 block">{t('AddRecord.instructorLabel')} *</Label>
                    <div className="flex flex-wrap items-center gap-2">
                      {lessonForm.instructorIds.map((instrId, idx) => (
                        <div key={idx} className="flex items-center gap-1">
                          <Select
                            value={instrId}
                            onValueChange={(value) => updateInstructorId(idx, value)}
                          >
                            <SelectTrigger className="w-full sm:w-48">
                              <SelectValue placeholder={t('AddRecord.selectInstructor')} />
                            </SelectTrigger>
                            <SelectContent>
                              {instructors.map((instructor) => (
                                <SelectItem key={instructor.id} value={instructor.id}>
                                  {formatName(instructor.firstName, instructor.lastName)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {idx > 0 && (
                            <button
                              type="button"
                              onClick={() => removeInstructor(idx)}
                              className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={addInstructor}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {t('AddRecord.addInstructor')}
                      </button>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="location" className="mb-2 block">{t('AddRecord.locationLabel')} *</Label>
                    <Select
                      value={lessonForm.locationId}
                      onValueChange={(value) => setLessonForm({ ...lessonForm, locationId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('AddRecord.selectLocation')} />
                      </SelectTrigger>
                      <SelectContent>
                        {locations.map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="lessonDate" className="mb-2 block">{t('AddRecord.lessonDateLabel')}</Label>
                    <input
                      id="lessonDate"
                      type="date"
                      value={lessonForm.lessonDate}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setLessonForm({ ...lessonForm, lessonDate: e.target.value })}
                      className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    />
                    <p className="text-xs text-gray-400 mt-1">{t('AddRecord.lessonDateHint')}</p>
                  </div>

                  <div>
                    <Label htmlFor="lessonType" className="mb-2 block">{t('AddRecord.lessonTypeLabel')} *</Label>
                    <Select
                      value={lessonForm.lessonType}
                      onValueChange={(value: 'Group' | 'Individual') => setLessonForm({ ...lessonForm, lessonType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Group">{t('AddRecord.lessonTypeGroup')}</SelectItem>
                        <SelectItem value="Individual">{t('AddRecord.lessonTypeIndividual')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Customer Details */}
                <div className="space-y-4">
                  <div className="flex flex-wrap justify-between items-center gap-2">
                    <h3 className="text-lg font-medium">{t('AddRecord.customerDetails')}</h3>
                    {/* Issue 7: Show Add button for all Group lessons */}
                    {showAddCustomer && (
                      <Button type="button" onClick={addCustomerRow} variant="outline" size="sm">
                        {t('AddRecord.addGroupCustomer')}
                      </Button>
                    )}
                  </div>

                  {lessonForm.customers.map((customer, index) => {
                    // Issue 7: only the first customer row is disabled when customerType === 'existing'
                    const isDisabled = customerType === 'existing' && index === 0

                    return (
                      <Card key={index} className="rounded-2xl border-gray-100">
                        <CardContent className="pt-6 space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="md:col-span-2">
                              <Label className="mb-2 block">{t('AddRecord.name')} *</Label>
                              <Input
                                value={customer.name}
                                onChange={(e) => {
                                  const { firstName, lastName } = splitFullName(e.target.value)
                                  const newCustomers = [...lessonForm.customers]
                                  newCustomers[index] = { ...newCustomers[index], name: e.target.value, firstName, lastName }
                                  setLessonForm({ ...lessonForm, customers: newCustomers })
                                }}
                                placeholder={t('AddRecord.namePlaceholder')}
                                disabled={isDisabled}
                                required
                              />
                            </div>
                            <div>
                              <Label className="mb-2 block">{t('CustomerSearch.email')} *</Label>
                              <Input
                                type="email"
                                value={customer.email}
                                onChange={(e) => updateCustomerField(index, 'email', e.target.value)}
                                disabled={isDisabled}
                                required
                              />
                            </div>
                            <div>
                              <Label className="mb-2 block">{t('Dialogs.phone')}</Label>
                              <Input
                                value={customer.phone || ''}
                                onChange={(e) => updateCustomerField(index, 'phone', e.target.value)}
                                disabled={isDisabled}
                              />
                            </div>
                          </div>

                          <div>
                            <Label className="mb-2 block">{t('AddRecord.symptomsLabel')}</Label>
                            <Textarea
                              value={customer.symptoms}
                              onChange={(e) => updateCustomerField(index, 'symptoms', e.target.value)}
                              rows={3}
                            />
                          </div>

                          <div>
                            <Label className="mb-2 block">{t('AddRecord.improvementsLabel')}</Label>
                            <Textarea
                              value={customer.improvements}
                              onChange={(e) => updateCustomerField(index, 'improvements', e.target.value)}
                              rows={3}
                            />
                          </div>

                          <div>
                            <Label className="mb-2 block">{t('AddRecord.feedbackLabel')}</Label>
                            <Textarea
                              value={customer.feedback}
                              onChange={(e) => updateCustomerField(index, 'feedback', e.target.value)}
                              rows={2}
                            />
                          </div>

                          {/* Allow removing non-first rows; for new customers, allow removing any extra row */}
                          {lessonForm.customers.length > 1 && index > 0 && (
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => removeCustomerRow(index)}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              {t('AddRecord.removeCustomer')}
                            </Button>
                          )}
                          {customerType === 'new' && lessonForm.customers.length > 1 && index === 0 && (
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => removeCustomerRow(index)}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              {t('AddRecord.removeCustomer')}
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>

                {submitError && (
                  <div className="p-3 border border-red-200 rounded-md bg-red-50">
                    <p className="text-red-800 text-sm">{submitError}</p>
                  </div>
                )}

                {submitMessage && (
                  <div className="p-3 border border-green-200 rounded-md bg-green-50">
                    <p className="text-green-800 text-sm">{submitMessage}</p>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => customerType === 'existing' ? setStep('search-customer') : setStep('select-type')}
                    className="flex-1"
                  >
                    {t('Common.back')}
                  </Button>
                  <Button type="submit" disabled={isSubmitting} className="flex-1">
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('AddRecord.creating')}
                      </>
                    ) : (
                      t('AddRecord.createRecord')
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        )}
      </div>
    </div>
  )
}
