'use client'

import { useState, useEffect } from 'react'
import { Search, Loader2, ArrowLeft, UserPlus, Users, Edit, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useRouter, usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Cookies from 'js-cookie'

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
  firstName: string
  lastName: string
  email: string
  phone?: string
  symptoms: string
  improvements: string
}

interface LessonFormData {
  instructorId: string
  locationId: string
  lessonType: 'Group' | 'Individual'
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
  
  // Edit mode state
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null)
  const [editFormData, setEditFormData] = useState<{firstName: string; lastName: string; email: string; phone: string}>({firstName: '', lastName: '', email: '', phone: ''})
  const [isEditingSaving, setIsEditingSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  
  // Form data
  const [instructors, setInstructors] = useState<User[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [lessonForm, setLessonForm] = useState<LessonFormData>({
    instructorId: '',
    locationId: '',
    lessonType: 'Group',
    customers: [{ firstName: '', lastName: '', email: '', phone: '', symptoms: '', improvements: '' }]
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
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        setInstructors(data.results || [])
      }
    } catch (error) {
      console.error('Error fetching instructors:', error)
    }
  }

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
        setSearchError('Failed to search customers. Please try again.')
        setSearchResults([])
      }
    } catch (error) {
      console.error('Error searching customers:', error)
      setSearchError('An error occurred while searching. Please try again.')
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const handleSelectExistingCustomer = (customer: Customer) => {
    setSelectedCustomer(customer)
    
    // Get the most recent symptoms and improvements from lesson history
    const latestLesson = customer.lessonParticipants?.[0]
    const previousSymptoms = latestLesson?.customerSymptoms || ''
    const previousImprovements = latestLesson?.customerImprovements || ''
    
    setLessonForm({
      ...lessonForm,
      customers: [{
        id: customer.id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone || '',
        symptoms: previousSymptoms,
        improvements: previousImprovements
      }]
    })
    setStep('form')
  }

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomerId(customer.id)
    setEditFormData({
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      phone: customer.phone || ''
    })
    setEditError(null)
  }

  const handleSaveCustomerEdit = async () => {
    if (!editingCustomerId) return

    if (!editFormData.firstName.trim() || !editFormData.lastName.trim() || !editFormData.email.trim()) {
      setEditError('First name, last name, and email are required')
      return
    }

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
          firstName: editFormData.firstName,
          lastName: editFormData.lastName,
          email: editFormData.email,
          phone: editFormData.phone || null
        })
      })

      if (response.ok) {
        // Update the search results
        setSearchResults(prev =>
          prev.map(customer =>
            customer.id === editingCustomerId
              ? { ...customer, ...editFormData }
              : customer
          )
        )
        setEditingCustomerId(null)
      } else {
        const error = await response.json()
        setEditError(error.error || 'Failed to update customer')
      }
    } catch (error) {
      console.error('Error updating customer:', error)
      setEditError('An error occurred while updating the customer')
    } finally {
      setIsEditingSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setEditingCustomerId(null)
    setEditFormData({firstName: '', lastName: '', email: '', phone: ''})
    setEditError(null)
  }

  const addCustomerRow = () => {
    setLessonForm({
      ...lessonForm,
      customers: [...lessonForm.customers, { firstName: '', lastName: '', email: '', phone: '', symptoms: '', improvements: '' }]
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitError('')
    setSubmitMessage('')

    try {
      // Prepare the payload with the correct field names for the API
      const payload = {
        lessonType: lessonForm.lessonType,
        instructorId: lessonForm.instructorId,
        location: lessonForm.locationId, // API expects 'location', not 'locationId'
        customers: lessonForm.customers
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Button variant="ghost" onClick={() => router.push(`/${locale}`)} className="mr-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('Common.back')}
            </Button>
            <h1 className="text-xl font-semibold text-gray-900">
              {t('AddRecord.title')}
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Step 1: Select Customer Type */}
        {step === 'select-type' && (
          <Card>
            <CardHeader>
              <CardTitle>{t('AddRecord.customerType')}</CardTitle>
              <CardDescription>
                {t('AddRecord.customerTypeDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card 
                className="cursor-pointer hover:border-blue-500 hover:shadow-lg transition-all"
                onClick={() => handleCustomerTypeSelect('new')}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <UserPlus className="h-8 w-8 text-blue-600" />
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
                className="cursor-pointer hover:border-green-500 hover:shadow-lg transition-all"
                onClick={() => handleCustomerTypeSelect('existing')}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Users className="h-8 w-8 text-green-600" />
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
          <Card>
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
                      <Card
                        className="hover:border-blue-500 transition-all"
                      >
                        <CardContent className="py-3">
                          <div className="flex justify-between items-start">
                            <div className="flex-1 cursor-pointer" onClick={() => handleSelectExistingCustomer(customer)}>
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
                              <Edit className="h-4 w-4 text-blue-600" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Edit Modal */}
                      {editingCustomerId === customer.id && (
                        <Card className="border-blue-300 bg-blue-50">
                          <CardContent className="pt-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <Label>{t('AddRecord.firstName')} *</Label>
                                <Input
                                  value={editFormData.firstName}
                                  onChange={(e) => setEditFormData({...editFormData, firstName: e.target.value})}
                                  placeholder="First name"
                                />
                              </div>
                              <div>
                                <Label>{t('AddRecord.lastName')} *</Label>
                                <Input
                                  value={editFormData.lastName}
                                  onChange={(e) => setEditFormData({...editFormData, lastName: e.target.value})}
                                  placeholder="Last name"
                                />
                              </div>
                              <div>
                                <Label>{t('CustomerSearch.email')} *</Label>
                                <Input
                                  type="email"
                                  value={editFormData.email}
                                  onChange={(e) => setEditFormData({...editFormData, email: e.target.value})}
                                  placeholder="Email"
                                />
                              </div>
                              <div>
                                <Label>{t('Dialogs.phone')}</Label>
                                <Input
                                  value={editFormData.phone}
                                  onChange={(e) => setEditFormData({...editFormData, phone: e.target.value})}
                                  placeholder="Phone"
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
            <Card>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="instructor">{t('AddRecord.instructorLabel')} *</Label>
                    <Select
                      value={lessonForm.instructorId}
                      onValueChange={(value) => setLessonForm({ ...lessonForm, instructorId: value })}
                    >
                      <SelectTrigger>
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
                  </div>

                  <div>
                    <Label htmlFor="location">{t('AddRecord.locationLabel')} *</Label>
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
                    <Label htmlFor="lessonType">{t('AddRecord.lessonTypeLabel')} *</Label>
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
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">{t('AddRecord.customerDetails')}</h3>
                    {customerType === 'new' && (
                      <Button type="button" onClick={addCustomerRow} variant="outline" size="sm">
                        {t('AddRecord.addCustomer')}
                      </Button>
                    )}
                  </div>

                  {lessonForm.customers.map((customer, index) => (
                    <Card key={index}>
                      <CardContent className="pt-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label>{t('AddRecord.firstName')} *</Label>
                            <Input
                              value={customer.firstName}
                              onChange={(e) => updateCustomerField(index, 'firstName', e.target.value)}
                              disabled={customerType === 'existing'}
                              required
                            />
                          </div>
                          <div>
                            <Label>{t('AddRecord.lastName')} *</Label>
                            <Input
                              value={customer.lastName}
                              onChange={(e) => updateCustomerField(index, 'lastName', e.target.value)}
                              disabled={customerType === 'existing'}
                              required
                            />
                          </div>
                          <div>
                            <Label>{t('CustomerSearch.email')} *</Label>
                            <Input
                              type="email"
                              value={customer.email}
                              onChange={(e) => updateCustomerField(index, 'email', e.target.value)}
                              disabled={customerType === 'existing'}
                              required
                            />
                          </div>
                          <div>
                            <Label>{t('Dialogs.phone')}</Label>
                            <Input
                              value={customer.phone || ''}
                              onChange={(e) => updateCustomerField(index, 'phone', e.target.value)}
                              disabled={customerType === 'existing'}
                            />
                          </div>
                        </div>

                        <div>
                          <Label>{t('AddRecord.symptomsLabel')}</Label>
                          <Textarea
                            value={customer.symptoms}
                            onChange={(e) => updateCustomerField(index, 'symptoms', e.target.value)}
                            rows={3}
                          />
                        </div>

                        <div>
                          <Label>{t('AddRecord.improvementsLabel')}</Label>
                          <Textarea
                            value={customer.improvements}
                            onChange={(e) => updateCustomerField(index, 'improvements', e.target.value)}
                            rows={3}
                          />
                        </div>

                        {customerType === 'new' && lessonForm.customers.length > 1 && (
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => removeCustomerRow(index)}
                          >
                            {t('AddRecord.removeCustomer')}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
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

                <div className="flex gap-4">
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
