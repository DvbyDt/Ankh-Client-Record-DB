# Translation Usage Examples

## 🎯 Common Patterns

### 1. Simple Text Translation

```typescript
// Before:
<h1>Add New Record</h1>

// After:
<h1>{t('AddRecord.title')}</h1>
```

### 2. Button Labels

```typescript
// Before:
<Button>Search</Button>

// After:
<Button>{t('Common.search')}</Button>
```

### 3. Input Placeholders

```typescript
// Before:
<Input placeholder="Search by name..." />

// After:
<Input placeholder={t('HomePage.searchPlaceholder')} />
```

### 4. Form Labels

```typescript
// Before:
<Label htmlFor="firstName">First Name</Label>

// After:
<Label htmlFor="firstName">{t('AddRecord.firstName')}</Label>
```

### 5. Select Options

```typescript
// Before:
<SelectItem value="Group">Group</SelectItem>
<SelectItem value="Individual">Individual</SelectItem>

// After:
<SelectItem value="Group">{t('AddRecord.lessonTypeGroup')}</SelectItem>
<SelectItem value="Individual">{t('AddRecord.lessonTypeIndividual')}</SelectItem>
```

### 6. Card Titles and Descriptions

```typescript
// Before:
<CardTitle>Customer Type</CardTitle>
<CardDescription>Is this a new customer or an existing customer?</CardDescription>

// After:
<CardTitle>{t('AddRecord.customerType')}</CardTitle>
<CardDescription>{t('AddRecord.customerTypeDesc')}</CardDescription>
```

### 7. Error/Success Messages

```typescript
// Before:
setSubmitMessage('Lesson record created successfully!')
setSubmitError('Failed to create lesson record')

// After:
setSubmitMessage(t('AddRecord.successMessage'))
setSubmitError(t('AddRecord.errorMessage'))
```

### 8. Dynamic Content with Parameters

```typescript
// Translation file:
{
  "AddRecord": {
    "lessonInfoForCustomer": "Adding lesson for {customerName}"
  }
}

// Component:
<CardDescription>
  {t('AddRecord.lessonInfoForCustomer', { 
    customerName: `${selectedCustomer.firstName} ${selectedCustomer.lastName}` 
  })}
</CardDescription>
```

### 9. Table Headers

```typescript
// Before:
<TableHead>Name</TableHead>
<TableHead>Email</TableHead>
<TableHead>Phone</TableHead>

// After:
<TableHead>{t('CustomerSearch.name')}</TableHead>
<TableHead>{t('CustomerSearch.email')}</TableHead>
<TableHead>{t('CustomerSearch.phone')}</TableHead>
```

### 10. Conditional Text

```typescript
// Before:
{isSubmitting ? 'Creating...' : 'Create Lesson Record'}

// After:
{isSubmitting ? t('AddRecord.creating') : t('AddRecord.createRecord')}
```

## 📝 Step-by-Step: Translating a Component

### Example: Search Results Section

**1. Identify all text strings:**
```typescript
"Customer Search Results"
"Name"
"Email"
"Phone"
"Lessons"
"No customers found"
```

**2. Add to translation files:**

`messages/en.json`:
```json
{
  "CustomerSearch": {
    "title": "Customer Search Results",
    "name": "Name",
    "email": "Email",
    "phone": "Phone",
    "lessons": "Lessons",
    "noResults": "No customers found"
  }
}
```

`messages/ko.json`:
```json
{
  "CustomerSearch": {
    "title": "고객 검색 결과",
    "name": "이름",
    "email": "이메일",
    "phone": "전화번호",
    "lessons": "수업",
    "noResults": "고객을 찾을 수 없습니다"
  }
}
```

**3. Update component:**
```typescript
<CardTitle>{t('CustomerSearch.title')}</CardTitle>
<TableHead>{t('CustomerSearch.name')}</TableHead>
<TableHead>{t('CustomerSearch.email')}</TableHead>
// ... etc
```

## 🚀 Quick Translation Checklist

For each page/component:

- [ ] Import `useTranslations` hook
- [ ] Add `const t = useTranslations()` 
- [ ] Replace all headings with `t('Section.key')`
- [ ] Replace all button labels with `t('Section.key')`
- [ ] Replace all form labels with `t('Section.key')`
- [ ] Replace all placeholders with `t('Section.key')`
- [ ] Replace all descriptions with `t('Section.key')`
- [ ] Replace all error/success messages with `t('Section.key')`
- [ ] Test both English and Korean

## 💡 Tips

1. **Group related translations** under a common namespace (e.g., `AddRecord.*`, `CustomerSearch.*`)
2. **Use descriptive keys** that indicate where/how the text is used
3. **Keep Korean translations professional** and appropriate for business context
4. **Test thoroughly** by switching languages and navigating through the app
5. **Add new keys to BOTH** `en.json` and `ko.json` files

## 🔍 Finding Hard-coded Text

Search your files for common patterns:
- `"...text..."` or `'...text...'` in JSX
- `placeholder="..."` attributes
- `<Label>...</Label>` content
- `<Button>...</Button>` content
- `<h1>...</h1>` and other headings
- Error/success message strings

Remember: API responses and database values don't need translation, only UI text!
