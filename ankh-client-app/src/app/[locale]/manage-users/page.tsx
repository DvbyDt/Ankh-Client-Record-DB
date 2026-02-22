'use client'

import { useState, useEffect } from 'react'
import { Search, Loader2, ArrowLeft, Edit, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useRouter, usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Cookies from 'js-cookie'

interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  role: string
  createdAt: string
}

export default function ManageUsersPage() {
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations()
  const locale = pathname.split('/')[1] || 'en'

  // Search state
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)

  // Edit mode state
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editFormData, setEditFormData] = useState<{ firstName: string; lastName: string; email: string; role: string }>({
    firstName: '',
    lastName: '',
    email: '',
    role: ''
  })
  const [isEditingSaving, setIsEditingSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Check authentication
  useEffect(() => {
    const token = Cookies.get('jwt-token')
    if (!token) {
      router.push(`/${locale}`)
    }
  }, [])

  const handleUserSearch = async () => {
    if (!searchTerm.trim()) return

    setIsSearching(true)
    setSearchError(null)
    setHasSearched(true)
    const token = Cookies.get('jwt-token')

    try {
      const response = await fetch(`/api/users/search?name=${encodeURIComponent(searchTerm)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        setSearchResults(data.users || [])
      } else {
        setSearchError('Failed to search users. Please try again.')
        setSearchResults([])
      }
    } catch (error) {
      console.error('Error searching users:', error)
      setSearchError('An error occurred while searching. Please try again.')
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const handleEditUser = (user: User) => {
    setEditingUserId(user.id)
    setEditFormData({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role
    })
    setEditError(null)
  }

  const handleSaveUserEdit = async () => {
    if (!editingUserId) return

    if (!editFormData.firstName.trim() || !editFormData.lastName.trim() || !editFormData.email.trim()) {
      setEditError('First name, last name, and email are required')
      return
    }

    setIsEditingSaving(true)
    setEditError(null)
    const token = Cookies.get('jwt-token')

    try {
      const response = await fetch(`/api/users/${editingUserId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          firstName: editFormData.firstName,
          lastName: editFormData.lastName,
          email: editFormData.email,
          role: editFormData.role
        })
      })

      if (response.ok) {
        // Update the search results
        setSearchResults(prev =>
          prev.map(user =>
            user.id === editingUserId
              ? { ...user, ...editFormData }
              : user
          )
        )
        setEditingUserId(null)
      } else {
        const error = await response.json()
        setEditError(error.error || 'Failed to update user')
      }
    } catch (error) {
      console.error('Error updating user:', error)
      setEditError('An error occurred while updating the user')
    } finally {
      setIsEditingSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setEditingUserId(null)
    setEditFormData({ firstName: '', lastName: '', email: '', role: '' })
    setEditError(null)
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
              Manage Users
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Search and Manage Users</CardTitle>
            <CardDescription>
              Search for users by name or email to view and edit their information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Input
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setHasSearched(false)
                  setSearchError(null)
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleUserSearch()}
                className="flex-1"
              />
              <Button onClick={handleUserSearch} disabled={isSearching || !searchTerm.trim()}>
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
                <p className="text-sm text-yellow-700">No users found</p>
              </div>
            )}

            {searchResults.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-medium text-sm text-gray-700">Search Results:</h3>
                {searchResults.map((user) => (
                  <div key={user.id} className="space-y-2">
                    <Card className="hover:border-blue-500 transition-all">
                      <CardContent className="py-3">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-medium">{user.firstName} {user.lastName}</p>
                            <p className="text-sm text-gray-600">{user.email}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              Role: <span className="font-medium">{user.role}</span>
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditUser(user)}
                            className="ml-2"
                          >
                            <Edit className="h-4 w-4 text-blue-600" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Edit Modal */}
                    {editingUserId === user.id && (
                      <Card className="border-blue-300 bg-blue-50">
                        <CardContent className="pt-6 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label>First Name *</Label>
                              <Input
                                value={editFormData.firstName}
                                onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                                placeholder="First name"
                              />
                            </div>
                            <div>
                              <Label>Last Name *</Label>
                              <Input
                                value={editFormData.lastName}
                                onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                                placeholder="Last name"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <Label>Email *</Label>
                              <Input
                                type="email"
                                value={editFormData.email}
                                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                                placeholder="Email"
                              />
                            </div>
                            <div>
                              <Label>Role</Label>
                              <Input
                                value={editFormData.role}
                                disabled
                                placeholder="Role (cannot be changed)"
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
                              onClick={handleSaveUserEdit}
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
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
