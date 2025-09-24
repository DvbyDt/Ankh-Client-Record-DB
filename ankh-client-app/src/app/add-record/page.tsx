'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CalendarIcon, Loader2, Plus, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { DatePicker } from '@/components/ui/date-picker'

// Define the form schema using Zod
const lessonRecordSchema = z.object({
  lessonDate: z.date(),
  instructorId: z.string().min(1, "Please select an instructor").refine(
    (val) => val !== "loading" && val !== "no-instructors" && val !== "placeholder",
    "Please select a valid instructor"
  ),
  location: z.string().min(1, "Location is required"),
  lessonType: z.enum(["Group", "Individual"]),
  customers: z.array(z.object({
    id: z.string().optional(),
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.string().email("Invalid email address"),
    phone: z.string().optional(),
    symptoms: z.string().min(1, "Symptoms description is required"),
    improvements: z.string().min(1, "Improvements description is required"),
  })).min(1, "At least one customer is required"),
})

// Type aliases for cleaner code and better parsing
type LessonRecordForm = z.infer<typeof lessonRecordSchema>
type CustomerFormFields = z.infer<typeof lessonRecordSchema>['customers'][0]

// Instructor interface
interface Instructor {
  id: string
  firstName: string
  lastName: string
  email: string
  specialization?: string
}

export default function AddRecordPage() {
  const router = useRouter()
  const [instructors, setInstructors] = useState<Instructor[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Initialize the form with react-hook-form and zod validation
  const form = useForm<LessonRecordForm>({
    resolver: zodResolver(lessonRecordSchema),
    defaultValues: {
      lessonDate: new Date(),
      instructorId: 'placeholder',
      location: '',
      lessonType: 'Group',
      customers: [
        {
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          symptoms: '',
          improvements: '',
        }
      ],
    },
  })

  // Fetch instructors on component mount
  useEffect(() => {
    const fetchInstructors = async () => {
      setIsLoading(true)
      try {
        const response = await fetch('/api/users/instructors')
        
        // Log the full response for debugging
        console.log('Instructors API response status:', response.status)
        console.log('Instructors API response ok:', response.ok)
        
        if (!response.ok) {
          // Try to get error details from response body
          let errorMessage = 'Failed to fetch instructors'
          try {
            const errorData = await response.json()
            console.log('Error response data:', errorData)
            errorMessage = errorData.error || errorData.message || errorMessage
          } catch (parseError) {
            console.log('Could not parse error response:', parseError)
          }
          throw new Error(`${errorMessage} (Status: ${response.status})`)
        }
        
        const data = await response.json()
        console.log('Instructors API response data:', data)
        
        // Check if results array exists
        if (!data.results || !Array.isArray(data.results)) {
          console.error('Invalid response format - missing results array:', data)
          throw new Error('Invalid response format from instructors API')
        }
        
        setInstructors(data.results)
        setError('') // Clear any previous errors
      } catch (error) {
        console.error('Error fetching instructors:', error)
        const errorMessage = error instanceof Error ? error.message : 'Failed to load instructors'
        setError(errorMessage)
        setInstructors([]) // Ensure instructors array is empty on error
      } finally {
        setIsLoading(false)
      }
    }

    fetchInstructors()
  }, [])

  // Handle form submission
  const onSubmit = async (data: LessonRecordForm) => {
    setIsSubmitting(true)
    setError('')

    try {
      const response = await fetch('/api/lessons/new', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      console.log('Lesson record created:', result)
      
      // Redirect to main page with success message
      router.push('/?success=record-added')
    } catch (error) {
      console.error('Error submitting form:', error)
      setError(error instanceof Error ? error.message : 'Failed to create lesson record')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Add new customer field
  const addCustomer = () => {
    const currentCustomers = form.getValues('customers')
    form.setValue('customers', [
      ...currentCustomers,
      {
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        symptoms: '',
        improvements: '',
      }
    ])
  }

  // Remove customer field
  const removeCustomer = (index: number) => {
    const currentCustomers = form.getValues('customers')
    if (currentCustomers.length > 1) {
      form.setValue('customers', currentCustomers.filter((_, i) => i !== index))
    }
  }

  // Update customer field
  const updateCustomer = (index: number, field: keyof CustomerFormFields, value: string) => {
    const currentCustomers = form.getValues('customers')
    const updatedCustomers = [...currentCustomers]
    updatedCustomers[index] = { ...updatedCustomers[index], [field]: value }
    form.setValue('customers', updatedCustomers)
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          
          <h1 className="text-4xl font-bold tracking-tight mb-2">
            Add New Lesson Record
          </h1>
          <p className="text-xl text-muted-foreground">
            Create a new lesson record with customer information and progress notes
          </p>
        </div>

        {/* Main Form */}
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle>Lesson Information</CardTitle>
            <CardDescription>
              Fill in the lesson details and customer information below
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Lesson Details Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Lesson Date */}
                  <FormField
                    control={form.control}
                    name="lessonDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lesson Date *</FormLabel>
                        <FormControl>
                          <DatePicker
                            date={field.value}
                            onDateChange={field.onChange}
                            placeholder="Select lesson date"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Instructor */}
                  <FormField
                    control={form.control}
                    name="instructorId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Instructor *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={isLoading ? "Loading instructors..." : "Select an instructor"} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="placeholder" disabled>
                              Select an instructor
                            </SelectItem>
                            {isLoading ? (
                              <SelectItem value="loading" disabled>
                                <div className="flex items-center">
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Loading instructors...
                                </div>
                              </SelectItem>
                            ) : instructors.length === 0 ? (
                              <SelectItem value="no-instructors" disabled>
                                No instructors available
                              </SelectItem>
                            ) : (
                              instructors.map((instructor) => (
                                <SelectItem key={instructor.id} value={instructor.id}>
                                  {instructor.firstName} {instructor.lastName}
                                  {instructor.specialization && ` (${instructor.specialization})`}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                        {isLoading && (
                          <FormDescription>
                            Loading available instructors...
                          </FormDescription>
                        )}
                      </FormItem>
                    )}
                  />

                  {/* Location */}
                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Main Studio, Gym A" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Lesson Type */}
                  <FormField
                    control={form.control}
                    name="lessonType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lesson Type *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select lesson type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Group">Group Lesson</SelectItem>
                            <SelectItem value="Individual">Individual Lesson</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Customers Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Customer Information</h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addCustomer}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Customer
                    </Button>
                  </div>

                  {form.watch('customers').map((_, index) => (
                    <Card key={index} className="p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium">Customer {index + 1}</h4>
                        {form.watch('customers').length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeCustomer(index)}
                            className="text-destructive hover:text-destructive"
                          >
                            Remove
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <Label htmlFor={`firstName-${index}`}>First Name *</Label>
                          <Input
                            id={`firstName-${index}`}
                            value={form.watch(`customers.${index}.firstName`)}
                            onChange={(e) => updateCustomer(index, 'firstName', e.target.value)}
                            placeholder="First name"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`lastName-${index}`}>Last Name *</Label>
                          <Input
                            id={`lastName-${index}`}
                            value={form.watch(`customers.${index}.lastName`)}
                            onChange={(e) => updateCustomer(index, 'lastName', e.target.value)}
                            placeholder="Last name"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`email-${index}`}>Email *</Label>
                          <Input
                            id={`email-${index}`}
                            type="email"
                            value={form.watch(`customers.${index}.email`)}
                            onChange={(e) => updateCustomer(index, 'email', e.target.value)}
                            placeholder="email@example.com"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`phone-${index}`}>Phone</Label>
                          <Input
                            id={`phone-${index}`}
                            value={form.watch(`customers.${index}.phone`)}
                            onChange={(e) => updateCustomer(index, 'phone', e.target.value)}
                            placeholder="Phone number"
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <Label htmlFor={`symptoms-${index}`}>Symptoms/Issues *</Label>
                          <Textarea
                            id={`symptoms-${index}`}
                            value={form.watch(`customers.${index}.symptoms`)}
                            onChange={(e) => updateCustomer(index, 'symptoms', e.target.value)}
                            placeholder="Describe the customer's current symptoms or issues..."
                            rows={3}
                          />
                        </div>
                        <div>
                          <Label htmlFor={`improvements-${index}`}>Improvements/Progress *</Label>
                          <Textarea
                            id={`improvements-${index}`}
                            value={form.watch(`customers.${index}.improvements`)}
                            onChange={(e) => updateCustomer(index, 'improvements', e.target.value)}
                            placeholder="Describe the improvements or progress made during this lesson..."
                            rows={3}
                          />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                {/* Error Display */}
                {error && (
                  <div className="p-4 border border-destructive rounded-md bg-destructive/10">
                    <p className="text-destructive text-sm">{error}</p>
                  </div>
                )}

                {/* Form Actions */}
                <div className="flex justify-end space-x-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.back()}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting || isLoading}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating Record...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Create Lesson Record
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
