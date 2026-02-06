'use client'

import { useState, useEffect } from 'react'
import { Search, Loader2, AlertCircle, Users, Plus, Download, Upload, LogIn, UserPlus, MapPinPlus, Trash2 } from 'lucide-react'
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
import Cookies from 'js-cookie';
import React from 'react'
// import { toast } from '@/components/ui/toast';

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
  lessonParticipants?: CustomerLessonParticipant[]
}

interface CustomerLessonParticipant {
  lesson: {
    id: string
    lessonType?: string
    createdAt?: string
    instructor: {
      firstName: string
      lastName: string
    }
  }
  customerSymptoms?: string
  customerImprovements?: string
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

const Toast = ({ message, onClose }: { message: string; onClose: () => void }) => {
  return (
    <div className="fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg">
      <span>{message}</span>
      <button
        className="ml-4 text-sm underline"
        onClick={onClose}
      >
        Close
      </button>
    </div>
  );
};

export default function HomePage() {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations();
  const locale = pathname.split('/')[1] || 'en';

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

  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);
  const [isDeletingCustomer, setIsDeletingCustomer] = useState(false);
  const [isDeletingLesson, setIsDeletingLesson] = useState(false);

  // View all users dialog state
  const [showAllUsersDialog, setShowAllUsersDialog] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userRoleFilter, setUserRoleFilter] = useState<'ALL' | 'MANAGER' | 'INSTRUCTOR'>('ALL');
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [selectedUserInfo, setSelectedUserInfo] = useState<User | null>(null);

  // View all customers dialog state
  const [showAllCustomersDialog, setShowAllCustomersDialog] = useState(false);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [selectedCustomerInfo, setSelectedCustomerInfo] = useState<Customer | null>(null);
  const [isLoadingCustomerDetails, setIsLoadingCustomerDetails] = useState(false);
  const [customerCount, setCustomerCount] = useState<number | null>(null);

  // Confirmation dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmDialogData, setConfirmDialogData] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const toggleExpandCustomer = (customerId: string) => {
    setExpandedCustomerId((prev) => (prev === customerId ? null : customerId));
  };

  // Handle customer deletion
  const handleDeleteCustomer = async (customerId: string, customerName: string) => {
    setConfirmDialogData({
      title: 'Delete Customer',
      message: `Are you sure you want to delete customer "${customerName}"? This will also delete all their lesson records.`,
      onConfirm: async () => {
        const token = Cookies.get('jwt-token')
        if (!token) {
          setToastMessage('You must be logged in as a manager to delete customers.')
          return
        }

        setIsDeletingCustomer(true);
        try {

          const response = await fetch(`/api/customers/${customerId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          });

          if (response.ok) {
            setToastMessage('Customer deleted successfully!');
            // Remove from search results
            setSearchResults(searchResults.filter(r => r.id !== customerId));
          } else {
            const errorData = await response.json();
            setToastMessage(errorData.error || 'Failed to delete customer.');
          }
        } catch (error) {
          setToastMessage('An unexpected error occurred while deleting customer.');
        } finally {
          setIsDeletingCustomer(false);
          setShowConfirmDialog(false);
        }
      }
    });
    setShowConfirmDialog(true);
  };

  // Handle lesson participant deletion
  const handleDeleteLessonParticipant = async (customerId: string, lessonId: string, customerName: string) => {
    setConfirmDialogData({
      title: 'Delete Lesson Record',
      message: `Are you sure you want to delete this lesson record for "${customerName}"?`,
      onConfirm: async () => {
        const token = Cookies.get('jwt-token')
        if (!token) {
          setToastMessage('You must be logged in as a manager to delete lesson records.')
          return
        }

        setIsDeletingLesson(true);
        try {

          const response = await fetch(`/api/lessons/${lessonId}/participants/${customerId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          });

          if (response.ok) {
            setToastMessage('Lesson record deleted successfully!');
            // Refresh the search to update the data
            handleSearch();
          } else {
            const errorData = await response.json();
            setToastMessage(errorData.error || 'Failed to delete lesson record.');
          }
        } catch (error) {
          setToastMessage('An unexpected error occurred while deleting lesson record.');
        } finally {
          setIsDeletingLesson(false);
          setShowConfirmDialog(false);
        }
      }
    });
    setShowConfirmDialog(true);
  };


  // This runs ONLY once when the page loads
  useEffect(() => {
    const token = Cookies.get('jwt-token')
    
    if (token) {
      // 1. Decode the token to get the user's data (without hitting the server)
      //    (You might need to install 'jsonwebtoken' for this or just pass essential data)
      //    For simplicity, let's assume we store the essential user data in another cookie too.
      
      const userData = Cookies.get('current-user-data'); 
      
      if (userData) {
          // 2. Restore the state from the persistent storage
          setCurrentUser(JSON.parse(userData));
          setIsLoggedIn(true);
      }
    }
    
    // NOTE: If you don't use a separate user data cookie, you'll need to hit 
    // an API endpoint to fetch user details based on the JWT here.
  }, []);

  // Load initial data
  useEffect(() => {
    if (isLoggedIn) {
      fetchInstructors()
      fetchLocations()
      fetchCustomerCount()
    }
  }, [isLoggedIn])

  // Fetch instructors for dropdown
  const fetchInstructors = async () => {
    const token = Cookies.get('jwt-token'); 
    if (!token) {
        // Handle unauthenticated state if necessary
        return;
    }
    try {
      const response = await fetch('/api/users/instructors',{
        // Include your Authorization header here!
        headers: { 'Authorization': `Bearer ${token}` } 
      })
      console.log('Instructors response:', response);
      const data = await response.json(); // Await the response.json() here
      console.log('data.Instructors:', data.results);
      console.log('Data', data);
      if (response.ok) {
        //const data = await response.json()
        setInstructors(data.results || [])
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
        const data = await response.json();

        // 🔑 1. SAVE THE SESSION KEY (JWT)
        Cookies.set('jwt-token', data.token, { expires: 1 }); // Expires in 1 day
        
        // 🔑 2. SAVE THE ESSENTIAL USER DATA (for quick reload/display)
        const userToStore = { 
          firstName: data.user.firstName, 
          lastName: data.user.lastName, 
          role: data.user.role 
        };
        Cookies.set('current-user-data', JSON.stringify(userToStore), { expires: 7 }); 

        setCurrentUser(data.user)
        setIsLoggedIn(true)
        setShowLoginDialog(false)
        setLoginForm({ username: '', password: '' })
        // router.replace('/'); // Refresh the page to load authenticated content
      } else {
        const errorData = await response.json()
        setErrorMessage(errorData.error)
      }
    } catch (error) {
      setErrorMessage(t('HomePage.loginFailed'))
    }
  }

  // Fetch all users for manager view
  const fetchAllUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const response = await fetch('/api/users');
      if (response.ok) {
        const data = await response.json();
        setAllUsers(data.users || []);
      } else {
        setToastMessage('Failed to fetch users');
      }
    } catch (error) {
      setToastMessage('Error fetching users');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Fetch all customers
  const fetchAllCustomers = async () => {
    setIsLoadingCustomers(true);
    try {
      const response = await fetch('/api/customers');
      if (response.ok) {
        const data = await response.json();
        setAllCustomers(data.customers || []);
      } else {
        setToastMessage('Failed to fetch customers');
      }
    } catch (error) {
      setToastMessage('Error fetching customers');
    } finally {
      setIsLoadingCustomers(false);
    }
  };

  // Fetch customer count for system status
  const fetchCustomerCount = async () => {
    try {
      const response = await fetch('/api/customers?countOnly=true');
      if (response.ok) {
        const data = await response.json();
        setCustomerCount(data.count ?? 0);
      }
    } catch (error) {
      setCustomerCount(null);
    }
  };

  // Fetch selected customer details with records
  const handleViewCustomerDetails = async (customerId: string) => {
    setIsLoadingCustomerDetails(true);
    const basicCustomer = allCustomers.find((customer) => customer.id === customerId) || null;
    if (basicCustomer) {
      setSelectedCustomerInfo(basicCustomer);
    }
    try {
      const token = Cookies.get('jwt-token')
      if (!token) {
        setToastMessage('Authentication required')
        setIsLoadingCustomerDetails(false)
        return
      }

      const response = await fetch(`/api/customers/${customerId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedCustomerInfo(data.customer || null);
      } else {
        setToastMessage('Failed to load customer details');
      }
    } catch (error) {
      setToastMessage('Error loading customer details');
    } finally {
      setIsLoadingCustomerDetails(false);
    }
  };

  // Handle user deletion
  const handleDeleteUser = async (userId: string, userName: string) => {
    setConfirmDialogData({
      title: 'Delete User',
      message: `Are you sure you want to delete user "${userName}"? This action cannot be undone.`,
      onConfirm: async () => {
        const token = Cookies.get('jwt-token')
        if (!token) {
          setToastMessage('Authentication required')
          return
        }
        setIsDeletingUser(true);
        try {
          const response = await fetch(`/api/users/${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          })
          if (response.ok) {
            setToastMessage(`User "${userName}" deleted successfully`);
            fetchAllUsers(); // Refresh the list
            setSelectedUserInfo(null);
          } else {
            const data = await response.json();
            setToastMessage(data.error || 'Failed to delete user');
          }
        } catch (error) {
          setToastMessage('Error deleting user');
        } finally {
          setIsDeletingUser(false);
        }
      }
    });
    setShowConfirmDialog(true);
  };

  // Handle user creation
  const handleUserCreation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userForm),
      });

      if (response.ok) {
        const data = await response.json();
        setShowUserDialog(false);
        setUserForm({
          username: '',
          password: '',
          role: 'INSTRUCTOR',
          firstName: '',
          lastName: '',
          email: '',
        });
        fetchInstructors(); // Refresh instructors list

        // Show custom toast notification
        setToastMessage(t('HomePage.userCreatedSuccess'));
      } else {
        const errorData = await response.json();
        setToastMessage(errorData.error || t('UserManagement.errorMessage'));
      }
    } catch (error) {
      setToastMessage(t('HomePage.unexpectedError'));
    }
  };

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Handle location creation
  const handleLocationCreation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(locationForm),
      });

      if (response.ok) {
        setShowLocationDialog(false);
        setLocationForm({ name: '' });
        fetchLocations(); // Refresh locations list

        // Show custom toast notification
        setToastMessage('Location created successfully!');
      } else {
        const errorData = await response.json();
        setToastMessage(errorData.error || 'Failed to create location.');
      }
    } catch (error) {
      setToastMessage('An unexpected error occurred.');
    }
  };

  // Handle customer search

  // Handle customer selection

  // Add new customer row

  // Remove customer row

  // Update customer field

  // Handle lesson form submission

  // Handle search
  const handleSearch = async () => {
    console.log('Search triggered with term:', searchTerm)
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

      console.log('API endpoint:', endpoint)

      const response = await fetch(endpoint)
      if (response.ok) {
        const data = await response.json()
        console.log('Search results:', data)
        const results = data.customers || data.users || data.locations || []
        setSearchResults(results)
        
        // Check if results are empty and set appropriate error message
        if (results.length === 0) {
          setIsError(true)
          let errorKey = ''
          switch (searchType) {
            case 'customer':
              errorKey = 'HomePage.searchFailedCustomer'
              break
            case 'instructor':
              errorKey = 'HomePage.searchFailedInstructor'
              break
            case 'location':
              errorKey = 'HomePage.searchFailedLocation'
              break
          }
          setErrorMessage(t(errorKey))
        }
      } else {
        setIsError(true)
        setErrorMessage('Search failed. Please try again.')
      }
    } catch (error) {
      console.error('Error during search:', error)
      setIsError(true)
      setErrorMessage('An error occurred during search.')
    } finally {
      setIsLoading(false)
    }
  }

  // Update the searchType state and clear search results
  const handleSearchTypeChange = (value: SearchType) => {
    setSearchType(value);
    setSearchResults([]); // Clear previous search results
    setIsError(false); // Clear error state
    setErrorMessage(''); // Clear error message
  };

  // Function to format date for display

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
        setImportError(data.error || t('CSVImport.errorMessage'))
      }
    } catch (error) {
      setImportError(t('HomePage.importError'))
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
    Cookies.remove('jwt-token');
  }

  console.log('Current Instructor:', instructors)
  console.log('Current Locations:', locations)
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-semibold text-gray-900">
              {t('Common.appName')}
            </h1>
            <div className="flex items-center gap-4">
              <LanguageSwitcher />
              {isLoggedIn ? (
                <>
                  <span className="text-sm text-gray-600">
                    Welcome, {currentUser?.firstName} {currentUser?.lastName} ({currentUser?.role})
                  </span>
                  <Button variant="outline" onClick={handleLogout}>
                    {t('Auth.logout')}
                  </Button>
                </>
              ) : (
                <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <LogIn className="mr-2 h-4 w-4" />
                      {t('Auth.login')}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t('Auth.login')}</DialogTitle>
                      <DialogDescription>
                        {t('HomePage.loginCredentials')}
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleLogin} className="space-y-4">
                      <div>
                        <Label htmlFor="username">{t('Auth.username')}</Label>
                        <Input
                          id="username"
                          value={loginForm.username}
                          className='my-4'
                          onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="password">{t('Auth.password')}</Label>
                        <Input
                          id="password"
                          className='my-4'
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
                        {t('Auth.login')}
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
              <CardTitle>{t('HomePage.welcomeTitle')}</CardTitle>
              <CardDescription>
                {t('HomePage.welcomeDesc')}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            {/* Action Buttons */}
            <div className="flex justify-center gap-4 mb-8">
              <Button
                onClick={() => router.push(`/${locale}/add-record`)}
                className="px-6"
              >
                <Plus className="mr-2 h-4 w-4" />
                {t('HomePage.addNewRecord')}
              </Button>
              <a
                href="/api/export-csv"
                download="customer_records.csv"
                className="inline-block"
              >
                <Button variant="outline" className="px-6">
                  <Download className="mr-2 h-4 w-4" />
                  {t('HomePage.exportCSV')}
                </Button>
              </a>
              {currentUser?.role === 'MANAGER' && (
                <Button
                  variant="outline"
                  className="px-6"
                  onClick={() => {
                    setShowAllUsersDialog(!showAllUsersDialog);
                    if (!showAllUsersDialog && allUsers.length === 0) {
                      fetchAllUsers();
                    }
                  }}
                >
                  <Users className="mr-2 h-4 w-4" />
                  {showAllUsersDialog ? 'Hide All Users' : 'View All Users'}
                </Button>
              )}
              {currentUser?.role === 'MANAGER' && (
                <Button
                  variant="outline"
                  className="px-6"
                  onClick={() => {
                    setShowAllCustomersDialog(!showAllCustomersDialog);
                    if (!showAllCustomersDialog && allCustomers.length === 0) {
                      fetchAllCustomers();
                    }
                  }}
                >
                  <Users className="mr-2 h-4 w-4" />
                  {showAllCustomersDialog ? 'Hide All Customers' : 'View All Customers'}
                </Button>
              )}
              <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="px-6">
                    <Upload className="mr-2 h-4 w-4" />
                    {t('HomePage.importCSV')}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>{t('HomePage.importRecordsTitle')}</DialogTitle>
                    <DialogDescription>
                      {t('HomePage.importRecordsDesc')}
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    {/* File Format Requirements */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">📁 {t('HomePage.csvRequirements')}</h4>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p><strong>Supported formats:</strong> CSV (.csv), Excel (.xlsx, .xls)</p>
                        <p>{t('HomePage.csvRequirementsDesc')}</p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li>{t('HomePage.csvHeaders.customerId')}</li>
                          <li>{t('HomePage.csvHeaders.customerName')}</li>
                          <li>{t('HomePage.csvHeaders.initialSymptom')}</li>
                          <li>{t('HomePage.csvHeaders.lessonId')}</li>
                          <li>{t('HomePage.csvHeaders.lessonDate')}</li>
                          <li>{t('HomePage.csvHeaders.instructorName')}</li>
                          <li>{t('HomePage.csvHeaders.lessonType')}</li>
                          <li>{t('HomePage.csvHeaders.lessonContent')}</li>
                          <li>{t('HomePage.csvHeaders.customerSymptoms')}</li>
                          <li>{t('HomePage.csvHeaders.customerImprovements')}</li>
                          <li>{t('HomePage.csvHeaders.courseCompletion')}</li>
                        </ul>
                      </div>
                    </div>

                    {/* File Upload */}
                    <div className="space-y-2">
                      <Label htmlFor="csv-file">{t('HomePage.selectCSVFile')}</Label>
                      <Input
                        id="csv-file"
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        onChange={handleFileSelect}
                        disabled={isImporting}
                      />
                      {selectedFile && (
                        <p className="text-sm text-muted-foreground">
                          {t('HomePage.selected', { fileName: selectedFile.name })}
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
                        {t('Common.cancel')}
                      </Button>
                      <Button
                        onClick={handleCSVImport}
                        disabled={!selectedFile || isImporting}
                      >
                        {isImporting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {t('HomePage.importing')}
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            {t('HomePage.import')}
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

            {/* All Users Table */}
            {currentUser?.role === 'MANAGER' && showAllUsersDialog && (
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle>All Users</CardTitle>
                  <CardDescription>View all users in the system</CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Role Filter Tabs */}
                  <div className="flex gap-2 mb-6 border-b">
                    {(['ALL', 'MANAGER', 'INSTRUCTOR'] as const).map((role) => (
                      <button
                        key={role}
                        onClick={() => setUserRoleFilter(role)}
                        className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                          userRoleFilter === role
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        {role === 'ALL' ? 'All Users' : role}
                        <span className="ml-2 text-xs font-normal">
                          ({allUsers.filter(u => role === 'ALL' || u.role === role).length})
                        </span>
                      </button>
                    ))}
                  </div>

                  {isLoadingUsers ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table className="table-fixed w-full">
                        <TableHeader>
                          <TableHead className="w-[18%] px-4 py-3 font-semibold">Name</TableHead>
                          <TableHead className="w-[18%] px-4 py-3 font-semibold">Username</TableHead>
                          <TableHead className="w-[18%] px-4 py-3 font-semibold">Email</TableHead>
                          <TableHead className="w-[13%] px-4 py-3 font-semibold">Role</TableHead>
                          <TableHead className="w-[16%] px-4 py-3 font-semibold">Created At</TableHead>
                          <TableHead className="w-[17%] px-4 py-3 font-semibold text-center">Action</TableHead>
                        </TableHeader>
                        <TableBody>
                          {allUsers
                            .filter(user => userRoleFilter === 'ALL' || user.role === userRoleFilter)
                            .length > 0 ? (
                            allUsers
                              .filter(user => userRoleFilter === 'ALL' || user.role === userRoleFilter)
                              .map((user) => (
                                <TableRow key={user.id}>
                                  <TableCell className="w-[18%] px-4 py-3">
                                    <button
                                      onClick={() => setSelectedUserInfo(user)}
                                      className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                                    >
                                      {`${user.firstName} ${user.lastName}`}
                                    </button>
                                  </TableCell>
                                  <TableCell className="w-[18%] px-4 py-3">{user.username}</TableCell>
                                  <TableCell className="w-[18%] px-4 py-3 break-all">{user.email}</TableCell>
                                  <TableCell className="w-[13%] px-4 py-3">
                                    <span className={`px-2 py-1 rounded text-xs ${
                                      user.role === 'MANAGER' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                                    }`}>
                                      {user.role}
                                    </span>
                                  </TableCell>
                                  <TableCell className="w-[16%] px-4 py-3">{new Date(user.createdAt || '').toLocaleDateString()}</TableCell>
                                  <TableCell className="w-[17%] px-4 py-3 text-center">
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => handleDeleteUser(user.id, `${user.firstName} ${user.lastName}`)}
                                      disabled={isDeletingUser}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                                No users found
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* All Customers Table */}
            {currentUser?.role === 'MANAGER' && showAllCustomersDialog && (
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle>All Customers</CardTitle>
                  <CardDescription>View all customers in the system</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingCustomers ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table className="table-fixed w-full">
                        <TableHeader>
                          <TableHead className="w-[28%] px-4 py-3 font-semibold">Name</TableHead>
                          <TableHead className="w-[28%] px-4 py-3 font-semibold">Email</TableHead>
                          <TableHead className="w-[20%] px-4 py-3 font-semibold">Phone</TableHead>
                          <TableHead className="w-[24%] px-4 py-3 font-semibold">Created At</TableHead>
                        </TableHeader>
                        <TableBody>
                          {allCustomers.length > 0 ? (
                            allCustomers.map((customer) => (
                              <TableRow key={customer.id}>
                                <TableCell className="w-[28%] px-4 py-3">
                                  <button
                                    onClick={() => handleViewCustomerDetails(customer.id)}
                                    className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                                  >
                                    {`${customer.firstName} ${customer.lastName}`}
                                  </button>
                                </TableCell>
                                <TableCell className="w-[28%] px-4 py-3 break-all">{customer.email}</TableCell>
                                <TableCell className="w-[20%] px-4 py-3">{customer.phone || 'N/A'}</TableCell>
                                <TableCell className="w-[24%] px-4 py-3">
                                  {customer.createdAt ? new Date(customer.createdAt).toLocaleDateString() : 'N/A'}
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                                No customers found
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* User Info Modal */}
            {selectedUserInfo && (
              <Dialog open={!!selectedUserInfo} onOpenChange={(open) => !open && setSelectedUserInfo(null)}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>{selectedUserInfo.firstName} {selectedUserInfo.lastName}</DialogTitle>
                    <DialogDescription>
                      User Information
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs text-gray-600">Username</Label>
                      <p className="font-medium">{selectedUserInfo.username}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Email</Label>
                      <p className="font-medium break-all">{selectedUserInfo.email}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Role</Label>
                      <p className="font-medium">
                        <span className={`px-2 py-1 rounded text-xs ${
                          selectedUserInfo.role === 'MANAGER' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {selectedUserInfo.role}
                        </span>
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Created At</Label>
                      <p className="font-medium">{new Date(selectedUserInfo.createdAt || '').toLocaleString()}</p>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {/* Customer Info Modal */}
            {selectedCustomerInfo && (
              <Dialog open={!!selectedCustomerInfo} onOpenChange={(open) => !open && setSelectedCustomerInfo(null)}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>{selectedCustomerInfo.firstName} {selectedCustomerInfo.lastName}</DialogTitle>
                    <DialogDescription>
                      Customer Information
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs text-gray-600">Email</Label>
                      <p className="font-medium break-all">{selectedCustomerInfo.email}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Phone</Label>
                      <p className="font-medium">{selectedCustomerInfo.phone || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Created At</Label>
                      <p className="font-medium">
                        {selectedCustomerInfo.createdAt ? new Date(selectedCustomerInfo.createdAt).toLocaleString() : 'N/A'}
                      </p>
                    </div>

                    <div className="border-t pt-4">
                      <h4 className="text-sm font-medium mb-2">{t('CustomerSearch.lessonDetails')}</h4>
                      {isLoadingCustomerDetails ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin" />
                        </div>
                      ) : selectedCustomerInfo.lessonParticipants && selectedCustomerInfo.lessonParticipants.length > 0 ? (
                        <div className="space-y-3">
                          <div className="text-sm text-gray-600">
                            <span className="font-medium">{t('CustomerSearch.lessons')}: </span>
                            {selectedCustomerInfo.lessonParticipants.length}
                          </div>

                          <div className="border border-gray-200 rounded-lg p-3">
                            <h5 className="text-sm font-medium mb-2">{t('CustomerSearch.initialCondition')}</h5>
                            <div className="grid gap-2 text-sm">
                              <div>
                                <span className="font-medium">{t('CustomerSearch.mainConcern')}: </span>
                                {selectedCustomerInfo.lessonParticipants[0]?.customerSymptoms || t('Common.na')}
                              </div>
                              <div>
                                <span className="font-medium">{t('CustomerSearch.currentHealthIssue')}: </span>
                                {selectedCustomerInfo.lessonParticipants[selectedCustomerInfo.lessonParticipants.length - 1]?.customerSymptoms || t('Common.na')}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2">
                            {selectedCustomerInfo.lessonParticipants.map((participant, index) => (
                              <div key={index} className="border border-gray-100 rounded-md p-2">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="text-sm font-medium">
                                    {`${participant.lesson.instructor.firstName} ${participant.lesson.instructor.lastName}`}
                                  </div>
                                  {currentUser?.role === 'MANAGER' && (
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => handleDeleteLessonParticipant(selectedCustomerInfo.id, participant.lesson.id, `${selectedCustomerInfo.firstName} ${selectedCustomerInfo.lastName}`)}
                                      disabled={isDeletingLesson}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                                <div className="text-sm text-gray-600 mt-2 leading-relaxed break-words">
                                  <span className="font-medium">{t('CustomerSearch.symptoms')}:</span> {participant.customerSymptoms || t('Common.na')}
                                </div>
                                <div className="text-sm text-gray-600 mt-2 leading-relaxed break-words">
                                  <span className="font-medium">{t('CustomerSearch.improvements')}:</span> {participant.customerImprovements || t('Common.na')}
                                </div>
                                <div className="text-xs text-gray-500 mt-2">
                                  {participant.lesson.lessonType ? `${t('CustomerSearch.lessonType')}: ${participant.lesson.lessonType}` : ''}
                                  {participant.lesson.createdAt ? ` · ${t('CustomerSearch.lessonDate')}: ${new Date(participant.lesson.createdAt).toLocaleDateString()}` : ''}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500 italic">No lessons found for this customer.</div>
                      )}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {/* Search Section */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>{t('HomePage.searchRecords')}</CardTitle>
                <CardDescription>
                  {t('HomePage.searchRecordsDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 mb-4">
                  <Select value={searchType} onValueChange={handleSearchTypeChange}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer">{t('HomePage.searchType.customer')}</SelectItem>
                      <SelectItem value="instructor">{t('HomePage.searchType.instructor')}</SelectItem>
                      <SelectItem value="location">{t('HomePage.searchType.location')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder={t('HomePage.searchPlaceholder2', { type: searchType })}
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value)
                      setIsError(false)
                      setErrorMessage('')
                    }}
                    className="flex-1"
                  />
                  <Button onClick={handleSearch} disabled={isLoading || !searchTerm.trim()}>
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="mr-2 h-4 w-4" />
                    )}
                    {t('Common.search')}
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
                  <>
                    <h3 className="text-lg font-medium mb-4 mt-6">{t('HomePage.searchResults')}</h3>
                    <div className="mt-6 flex justify-center">
                      <div className="w-full max-w-4xl">
                        <div className="space-y-4">
                      {searchResults.map((result) => (
                        <Card key={result.id} className="border border-gray-200">
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <CardTitle className="text-base">
                                  {`${result.firstName} ${result.lastName}`}
                                </CardTitle>
                                <CardDescription className="break-all">{result.email}</CardDescription>
                              </div>
                              {currentUser?.role === 'MANAGER' && searchType === 'customer' && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDeleteCustomer(result.id, `${result.firstName} ${result.lastName}`)}
                                  disabled={isDeletingCustomer}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="text-sm text-gray-700">
                              <span className="font-medium">
                                {searchType === 'customer' ? t('CustomerSearch.lessons') : t('CustomerSearch.customersCount')}: 
                              </span>
                              {searchType === 'customer'
                                ? (result.lessonParticipants?.length || 0)
                                : (result.lessons?.reduce((total: number, lesson: any) => 
                                    total + (lesson.lessonParticipants?.length || 0), 0) || 0)
                              }
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleExpandCustomer(result.id)}
                            >
                              {expandedCustomerId === result.id ? t('Common.close') : t('Common.view')}
                            </Button>

                            {expandedCustomerId === result.id && (
                              <div className="pt-2 space-y-4">
                                {searchType === 'customer' && (
                                  <>
                                    <div className="text-sm text-gray-600">
                                      <span className="font-medium">{t('CustomerSearch.phone')}: </span>
                                      {result.phone || t('Common.na')}
                                    </div>

                                    <div className="border border-gray-200 rounded-lg p-3">
                                      <h4 className="text-sm font-medium mb-2">{t('CustomerSearch.initialCondition')}</h4>
                                      <div className="grid gap-2 text-sm">
                                        <div>
                                          <span className="font-medium">{t('CustomerSearch.mainConcern')}: </span>
                                          {result?.lessonParticipants?.[0]?.customerSymptoms || t('Common.na')}
                                        </div>
                                        <div>
                                          <span className="font-medium">{t('CustomerSearch.currentHealthIssue')}: </span>
                                          {result?.lessonParticipants?.[result.lessonParticipants.length - 1]?.customerSymptoms || t('Common.na')}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="border border-gray-200 rounded-lg p-3">
                                      <h4 className="text-sm font-medium mb-2">{t('CustomerSearch.lessonDetails')}</h4>
                                      <div className="space-y-2">
                                        {result?.lessonParticipants?.map((participant: any, index: number) => (
                                          <div key={index} className="border border-gray-100 rounded-md p-2">
                                            <div className="flex items-start justify-between gap-3">
                                              <div className="text-sm font-medium">
                                                {`${participant.lesson.instructor.firstName} ${participant.lesson.instructor.lastName}`}
                                              </div>
                                              {currentUser?.role === 'MANAGER' && (
                                                <Button
                                                  variant="destructive"
                                                  size="sm"
                                                  onClick={() => handleDeleteLessonParticipant(result.id, participant.lesson.id, `${result.firstName} ${result.lastName}`)}
                                                  disabled={isDeletingLesson}
                                                >
                                                  <Trash2 className="h-4 w-4" />
                                                </Button>
                                              )}
                                            </div>
                                            <div className="text-sm text-gray-600 mt-2 leading-relaxed break-words">
                                              <span className="font-medium">{t('CustomerSearch.symptoms')}:</span> {participant.customerSymptoms}
                                            </div>
                                            <div className="text-sm text-gray-600 mt-2 leading-relaxed break-words">
                                              <span className="font-medium">{t('CustomerSearch.improvements')}:</span> {participant.customerImprovements}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </>
                                )}

                                {searchType === 'instructor' && (
                                  <div className="border border-gray-200 rounded-lg p-3">
                                    <h4 className="text-sm font-medium mb-2">{t('CustomerSearch.customersTrained')}</h4>
                                    <div className="space-y-2">
                                      {result?.lessons && result.lessons.length > 0 ? (
                                        result.lessons.some((lesson: any) => lesson.lessonParticipants && lesson.lessonParticipants.length > 0) ? (
                                          result.lessons.flatMap((lesson: any) => (
                                            lesson.lessonParticipants?.map((participant: any) => (
                                              <div key={`${lesson.id}-${participant.customerId}`} className="border border-gray-100 rounded-md p-2">
                                                <div className="text-sm font-medium">
                                                  {`${participant.customer.firstName} ${participant.customer.lastName}`}
                                                </div>
                                                <div className="text-sm text-gray-600">{participant.customer.email}</div>
                                                <div className="text-sm text-gray-600">{t('CustomerSearch.lessonType')}: {lesson.lessonType}</div>
                                                <div className="text-sm text-gray-600">
                                                  {t('CustomerSearch.lessonDate')}: {lesson.createdAt ? new Date(lesson.createdAt).toLocaleDateString() : t('Common.na')}
                                                </div>
                                              </div>
                                            )) || []
                                          ))
                                        ) : (
                                          <div className="text-sm text-gray-500 italic">No customers have been trained yet.</div>
                                        )
                                      ) : (
                                        <div className="text-sm text-gray-500 italic">No lessons found for this instructor.</div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserPlus className="h-5 w-5" />
                    {t('Dialogs.addNewUser')}
                  </CardTitle>
                  <CardDescription>
                    {t('Dialogs.addNewUserDesc')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
                    <DialogTrigger asChild>
                      <Button className="w-full">
                        <UserPlus className="mr-2 h-4 w-4" />
                        {t('Dialogs.createUser')}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>{t('Dialogs.createNewUser')}</DialogTitle>
                        <DialogDescription>
                          {t('Dialogs.createNewUserDesc')}
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleUserCreation} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="firstName">{t('Dialogs.firstName')}</Label>
                            <Input
                              id="firstName"
                              className='my-4'
                              value={userForm.firstName}
                              onChange={(e) => setUserForm({ ...userForm, firstName: e.target.value })}
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="lastName">{t('Dialogs.lastName')}</Label>
                            <Input
                              id="lastName"
                              className='my-4'
                              value={userForm.lastName}
                              onChange={(e) => setUserForm({ ...userForm, lastName: e.target.value })}
                              required
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="username">{t('Dialogs.username')}</Label>
                          <Input
                            id="username"
                            className='my-4'
                            value={userForm.username}
                            onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="email">{t('Dialogs.email')}</Label>
                          <Input
                            id="email"
                            type="email"
                            className='my-4'
                            value={userForm.email}
                            onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="password">{t('Dialogs.password')}</Label>
                          <Input
                            id="password"
                            type="password"
                            className='my-4'
                            value={userForm.password}
                            onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="role" className='mb-4'>{t('Dialogs.role')}</Label>
                          <Select
                            value={userForm.role}
                            onValueChange={(value: UserRole) => setUserForm({ ...userForm, role: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="INSTRUCTOR">{t('Dialogs.instructor')}</SelectItem>
                              <SelectItem value="MANAGER">{t('Dialogs.manager')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button type="submit" className="w-full">
                          {t('Dialogs.createUser')}
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
                    {t('Dialogs.addNewLocation')}
                  </CardTitle>
                  <CardDescription>
                    {t('Dialogs.addNewLocationDesc')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Dialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
                    <DialogTrigger asChild>
                      <Button className="w-full">
                        <MapPinPlus className="mr-2 h-4 w-4" />
                        {t('Dialogs.addLocation')}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{t('Dialogs.addNewLocation')}</DialogTitle>
                        <DialogDescription>
                          {t('Dialogs.createNewLocation')}
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleLocationCreation} className="space-y-4">
                        <div>
                          <Label htmlFor="locationName">{t('Dialogs.locationName')}</Label>
                          <Input
                            id="locationName"
                            value={locationForm.name}
                            className='my-4'
                            onChange={(e) => setLocationForm({ name: e.target.value })}
                            placeholder={t('Dialogs.locationPlaceholder')}
                            required
                          />
                        </div>
                        <Button type="submit" className="w-full">
                          {t('Dialogs.addLocation')}
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
                    {t('HomePage.systemStatus')}
                  </CardTitle>
                  <CardDescription>
                    {t('HomePage.systemStatusDesc')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span>{t('HomePage.instructors')}</span>
                    <span className="font-medium">
                      {instructors?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('HomePage.locations')}</span>
                    <span className="font-medium">{locations?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('HomePage.customers')}</span>
                    <span className="font-medium">{customerCount ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('HomePage.userRole')}</span>
                    <span className="font-medium">{currentUser?.role}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
      {toastMessage && (
        <Toast
          message={toastMessage}
          onClose={() => setToastMessage(null)}
        />
      )}

      {/* Confirmation Dialog */}
      {showConfirmDialog && confirmDialogData && (
        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{confirmDialogData.title}</DialogTitle>
              <DialogDescription>
                {confirmDialogData.message}
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowConfirmDialog(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  confirmDialogData.onConfirm();
                }}
                disabled={isDeletingCustomer || isDeletingLesson}
              >
                {isDeletingCustomer || isDeletingLesson ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

