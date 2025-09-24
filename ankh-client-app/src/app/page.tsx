'use client'

import { useState, useEffect } from 'react'
import { Search, Loader2, AlertCircle, Users, UserCheck, MapPin, Plus, Download, Upload, LogIn, UserPlus, MapPinPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

// Types
type SearchType = 'customer' | 'instructor' | 'location'
type UserRole = 'MANAGER' | 'INSTRUCTOR'

interface User {
  id: string
  username: string
  role: UserRole
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

export default function HomePage() {
  // State management for search functionality
  const [searchTerm, setSearchTerm] = useState('')
  const [searchType, setSearchType] = useState<SearchType>('customer')
  const [isLoading, setIsLoading] = useState(false)
  const [isError, setIsError] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])

  // State management for CSV import
  const [isImporting, setIsImporting] = useState(false)
  const [importMessage, setImportMessage] = useState('')
  const [importError, setImportError] = useState('')
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  // State management for user authentication
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [showLoginDialog, setShowLoginDialog] = useState(false)
  const [showUserDialog, setShowUserDialog] = useState(false)
  const [showLocationDialog, setShowLocationDialog] = useState(false)

  // State management for forms
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [userForm, setUserForm] = useState<UserFormData>({
    username: '',
    password: '',
    role: 'INSTRUCTOR',
    firstName: '',
    lastName: '',
    email: ''
  })
  const [locationForm, setLocationForm] = useState({ name: '' })

  // State management for dynamic data
  const [instructors, setInstructors] = useState<User[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])

  // State management for lesson form
  const [lessonForm, setLessonForm] = useState<LessonFormData>({
    lessonDate: '',
    instructorId: '',
    locationId: '',
    lessonType: 'Group',
    lessonContent: '',
    customers: [{ firstName: '', lastName: '', email: '', phone: '', symptoms: '', improvements: '' }]
  })

  // State management for customer search
  const [customerSearchTerm, setCustomerSearchTerm] = useState('')
  const [customerSearchResults, setCustomerSearchResults] = useState<Customer[]>([])
  const [isCustomerSearching, setIsCustomerSearching] = useState(false)

  // Load initial data
  useEffect(() => {
    if (isLoggedIn) {
      fetchInstructors()
      fetchLocations()
    }
  }, [isLoggedIn])

  // Fetch instructors for dropdown
  const fetchInstructors = async () => {
    try {
      const response = await fetch('/api/users/instructors')
      if (response.ok) {
        const data = await response.json()
        setInstructors(data.instructors || [])
      }
    } catch (error) {
      console.error('Error fetching instructors:', error)
      setInstructors([]) // Ensure instructors is always an array
    }
  }

  // Fetch locations for dropdown
  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/locations')
      if (response.ok) {
        const data = await response.json()
        setLocations(data.locations || [])
      }
    } catch (error) {
      console.error('Error fetching locations:', error)
      setLocations([]) // Ensure locations is always an array
    }
  }

  // Handle login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      })

      if (response.ok) {
        const data = await response.json()
        setCurrentUser(data.user)
        setIsLoggedIn(true)
        setShowLoginDialog(false)
        setLoginForm({ username: '', password: '' })
      } else {
        const errorData = await response.json()
        setErrorMessage(errorData.error)
      }
    } catch (error) {
      setErrorMessage('Login failed. Please try again.')
    }
  }

  // Handle user creation
  const handleUserCreation = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userForm)
      })

      if (response.ok) {
        const data = await response.json()
        setShowUserDialog(false)
        setUserForm({
          username: '',
          password: '',
          role: 'INSTRUCTOR',
          firstName: '',
          lastName: '',
          email: ''
        })
        fetchInstructors() // Refresh instructors list
        alert('User created successfully!')
      } else {
        const errorData = await response.json()
        alert(errorData.error)
      }
    } catch (error) {
      alert('Failed to create user. Please try again.')
    }
  }

  // Handle location creation
  const handleLocationCreation = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(locationForm)
      })

      if (response.ok) {
        const data = await response.json()
        setShowLocationDialog(false)
        setLocationForm({ name: '' })
        fetchLocations() // Refresh locations list
        alert('Location created successfully!')
      } else {
        const errorData = await response.json()
        alert(errorData.error)
      }
    } catch (error) {
      alert('Failed to create location. Please try again.')
    }
  }

  // Handle customer search
  const handleCustomerSearch = async (searchTerm: string) => {
    if (searchTerm.length < 2) {
      setCustomerSearchResults([])
      return
    }

    setIsCustomerSearching(true)
    try {
      const response = await fetch(`/api/customers/search?name=${encodeURIComponent(searchTerm)}`)
      if (response.ok) {
        const data = await response.json()
        setCustomerSearchResults(data.customers)
      }
    } catch (error) {
      console.error('Error searching customers:', error)
    } finally {
      setIsCustomerSearching(false)
    }
  }

  // Handle customer selection
  const handleCustomerSelection = (customer: Customer, index: number) => {
    const updatedCustomers = [...lessonForm.customers]
    updatedCustomers[index] = {
      ...updatedCustomers[index],
      id: customer.id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      phone: customer.phone || ''
    }
    setLessonForm({ ...lessonForm, customers: updatedCustomers })
    setCustomerSearchResults([])
    setCustomerSearchTerm('')
  }

  // Add new customer row
  const addCustomer = () => {
    setLessonForm({
      ...lessonForm,
      customers: [...lessonForm.customers, { firstName: '', lastName: '', email: '', phone: '', symptoms: '', improvements: '' }]
    })
  }

  // Remove customer row
  const removeCustomer = (index: number) => {
    if (lessonForm.customers.length > 1) {
      const updatedCustomers = lessonForm.customers.filter((_, i) => i !== index)
      setLessonForm({ ...lessonForm, customers: updatedCustomers })
    }
  }

  // Update customer field
  const updateCustomer = (index: number, field: keyof CustomerFormData, value: string) => {
    const updatedCustomers = [...lessonForm.customers]
    updatedCustomers[index] = { ...updatedCustomers[index], [field]: value }
    setLessonForm({ ...lessonForm, customers: updatedCustomers })
  }

  // Handle lesson form submission
  const handleLessonSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Implement lesson submission API
    console.log('Lesson form data:', lessonForm)
  }

  // Handle search
  const handleSearch = async () => {
    if (!searchTerm.trim()) return

    setIsLoading(true)
    setIsError(false)
    setErrorMessage('')

    try {
      let endpoint = ''
      switch (searchType) {
        case 'customer':
          endpoint = `/api/customers/search?name=${encodeURIComponent(searchTerm)}`
          break
        case 'instructor':
          endpoint = `/api/users?role=INSTRUCTOR&search=${encodeURIComponent(searchTerm)}`
          break
        case 'location':
          endpoint = `/api/locations?search=${encodeURIComponent(searchTerm)}`
          break
      }

      const response = await fetch(endpoint)
      if (response.ok) {
        const data = await response.json()
        setSearchResults(data.customers || data.users || data.locations || [])
      } else {
        setIsError(true)
        setErrorMessage('Search failed. Please try again.')
      }
    } catch (error) {
      setIsError(true)
      setErrorMessage('An error occurred during search.')
    } finally {
      setIsLoading(false)
    }
  }

  // Function to format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Function to handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setImportError('') // Clear previous errors when new file is selected
    }
  }

  // Function to handle CSV import
  const handleCSVImport = async () => {
    if (!selectedFile) return

    // Reset messages
    setImportMessage('')
    setImportError('')
    setIsImporting(true)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await fetch('/api/import-csv', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (response.ok) {
        setImportMessage(data.message)
        setShowImportDialog(false) // Close dialog on success
        setSelectedFile(null) // Reset selected file
        // Refresh search results if needed
        if (searchResults.length > 0) {
          handleSearch()
        }
      } else {
        setImportError(data.error || 'Import failed')
      }
    } catch (error) {
      setImportError('An error occurred during import')
    } finally {
      setIsImporting(false)
    }
  }

  // Function to close import dialog and reset state
  const closeImportDialog = () => {
    setShowImportDialog(false)
    setSelectedFile(null)
    setImportError('')
    setImportMessage('')
  }

  // Logout function
  const handleLogout = () => {
    setIsLoggedIn(false)
    setCurrentUser(null)
    setSearchResults([])
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-semibold text-gray-900">
              Ankh Client Record Database
            </h1>
            <div className="flex items-center gap-4">
              {isLoggedIn ? (
                <>
                  <span className="text-sm text-gray-600">
                    Welcome, {currentUser?.firstName} {currentUser?.lastName} ({currentUser?.role})
                  </span>
                  <Button variant="outline" onClick={handleLogout}>
                    Logout
                  </Button>
                </>
              ) : (
                <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <LogIn className="mr-2 h-4 w-4" />
                      Login
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Login</DialogTitle>
                      <DialogDescription>
                        Enter your credentials to access the system
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleLogin} className="space-y-4">
                      <div>
                        <Label htmlFor="username">Username</Label>
                        <Input
                          id="username"
                          value={loginForm.username}
                          onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="password">Password</Label>
                        <Input
                          id="password"
                          type="password"
                          value={loginForm.password}
                          onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                          required
                        />
                      </div>
                      {errorMessage && (
                        <p className="text-red-600 text-sm">{errorMessage}</p>
                      )}
                      <Button type="submit" className="w-full">
                        Login
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Main Content */}
        {!isLoggedIn ? (
          <Card className="text-center">
            <CardHeader>
              <CardTitle>Welcome to Ankh Client Record Database</CardTitle>
              <CardDescription>
                Please login to access the system and manage client records
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            {/* Action Buttons */}
            <div className="flex justify-center gap-4 mb-8">
              <Button
                onClick={() => window.location.href = '/add-record'}
                className="px-6"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add New Record
              </Button>
              <a
                href="/api/export-csv"
                download="customer_records.csv"
                className="inline-block"
              >
                <Button variant="outline" className="px-6">
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </a>
              <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="px-6">
                    <Upload className="mr-2 h-4 w-4" />
                    Import CSV
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Import Customer Records</DialogTitle>
                    <DialogDescription>
                      Upload a CSV file to import customer lesson records into the database.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    {/* CSV Requirements */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">CSV File Requirements:</h4>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>The CSV file must have the following headers exactly:</p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li>Customer ID</li>
                          <li>Customer Name</li>
                          <li>Initial Symptom</li>
                          <li>Lesson ID</li>
                          <li>Lesson Date</li>
                          <li>Instructor Name</li>
                          <li>Lesson Type</li>
                          <li>Lesson Content</li>
                          <li>Customer Symptoms</li>
                          <li>Customer Improvements</li>
                          <li>Course Completion Status</li>
                        </ul>
                      </div>
                    </div>

                    {/* File Upload */}
                    <div className="space-y-2">
                      <Label htmlFor="csv-file">Select CSV File</Label>
                      <Input
                        id="csv-file"
                        type="file"
                        accept=".csv"
                        onChange={handleFileSelect}
                        disabled={isImporting}
                      />
                      {selectedFile && (
                        <p className="text-sm text-muted-foreground">
                          Selected: {selectedFile.name}
                        </p>
                      )}
                    </div>

                    {/* Error Display */}
                    {importError && (
                      <div className="p-3 border border-red-200 rounded-md bg-red-50">
                        <p className="text-red-800 text-sm">{importError}</p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex justify-end space-x-2">
                      <Button
                        variant="outline"
                        onClick={closeImportDialog}
                        disabled={isImporting}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleCSVImport}
                        disabled={!selectedFile || isImporting}
                      >
                        {isImporting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Importing...
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            Import
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Success Message (shown outside dialog) */}
            {importMessage && (
              <div className="mt-4 p-4 border border-green-200 rounded-md bg-green-50">
                <p className="text-green-800 text-sm">{importMessage}</p>
              </div>
            )}

            {/* Search Section */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Search Records</CardTitle>
                <CardDescription>
                  Search for customers, instructors, or lesson locations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 mb-4">
                  <Select value={searchType} onValueChange={(value: SearchType) => setSearchType(value)}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer">Customer</SelectItem>
                      <SelectItem value="instructor">Instructor</SelectItem>
                      <SelectItem value="location">Location</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder={`Search ${searchType}...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={handleSearch} disabled={isLoading || !searchTerm.trim()}>
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="mr-2 h-4 w-4" />
                    )}
                    Search
                  </Button>
                </div>

                {/* Search Results */}
                {isError && (
                  <div className="flex items-center gap-2 text-red-600 mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {searchResults.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-lg font-medium mb-4">Search Results</h3>
                    <Table>
                      <TableHeader>
                        {searchType === 'customer' && (
                          <>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Lessons</TableHead>
                          </>
                        )}
                        {searchType === 'instructor' && (
                          <>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Role</TableHead>
                          </>
                        )}
                        {searchType === 'location' && (
                          <>
                            <TableHead>Location Name</TableHead>
                            <TableHead>Created</TableHead>
                          </>
                        )}
                      </TableHeader>
                      <TableBody>
                        {searchResults.map((result, index) => (
                          <TableRow key={result.id || index}>
                            {searchType === 'customer' && (
                              <>
                                <TableCell>{`${result.firstName} ${result.lastName}`}</TableCell>
                                <TableCell>{result.email}</TableCell>
                                <TableCell>{result.phone || 'N/A'}</TableCell>
                                <TableCell>{result.lessonParticipants?.length || 0}</TableCell>
                              </>
                            )}
                            {searchType === 'instructor' && (
                              <>
                                <TableCell>{`${result.firstName} ${result.lastName}`}</TableCell>
                                <TableCell>{result.email}</TableCell>
                                <TableCell>{result.role}</TableCell>
                              </>
                            )}
                            {searchType === 'location' && (
                              <>
                                <TableCell>{result.name}</TableCell>
                                <TableCell>{formatDate(result.createdAt)}</TableCell>
                              </>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserPlus className="h-5 w-5" />
                    Add New User
                  </CardTitle>
                  <CardDescription>
                    Create new instructor or manager accounts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
                    <DialogTrigger asChild>
                      <Button className="w-full">
                        <UserPlus className="mr-2 h-4 w-4" />
                        Create User
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Create New User</DialogTitle>
                        <DialogDescription>
                          Add a new instructor or manager to the system
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleUserCreation} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="firstName">First Name</Label>
                            <Input
                              id="firstName"
                              value={userForm.firstName}
                              onChange={(e) => setUserForm({ ...userForm, firstName: e.target.value })}
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="lastName">Last Name</Label>
                            <Input
                              id="lastName"
                              value={userForm.lastName}
                              onChange={(e) => setUserForm({ ...userForm, lastName: e.target.value })}
                              required
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="username">Username</Label>
                          <Input
                            id="username"
                            value={userForm.username}
                            onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            value={userForm.email}
                            onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="password">Password</Label>
                          <Input
                            id="password"
                            type="password"
                            value={userForm.password}
                            onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="role">Role</Label>
                          <Select
                            value={userForm.role}
                            onValueChange={(value: UserRole) => setUserForm({ ...userForm, role: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="INSTRUCTOR">Instructor</SelectItem>
                              <SelectItem value="MANAGER">Manager</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button type="submit" className="w-full">
                          Create User
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPinPlus className="h-5 w-5" />
                    Add New Location
                  </CardTitle>
                  <CardDescription>
                    Create new lesson locations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Dialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
                    <DialogTrigger asChild>
                      <Button className="w-full">
                        <MapPinPlus className="mr-2 h-4 w-4" />
                        Add Location
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add New Location</DialogTitle>
                        <DialogDescription>
                          Create a new location for lessons
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleLocationCreation} className="space-y-4">
                        <div>
                          <Label htmlFor="locationName">Location Name</Label>
                          <Input
                            id="locationName"
                            value={locationForm.name}
                            onChange={(e) => setLocationForm({ name: e.target.value })}
                            placeholder="e.g., Studio A, Conference Room"
                            required
                          />
                        </div>
                        <Button type="submit" className="w-full">
                          Add Location
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    System Status
                  </CardTitle>
                  <CardDescription>
                    Current system information
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span>Instructors:</span>
                    <span className="font-medium">{instructors?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Locations:</span>
                    <span className="font-medium">{locations?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>User Role:</span>
                    <span className="font-medium">{currentUser?.role}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
