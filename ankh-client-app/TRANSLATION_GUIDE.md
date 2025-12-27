# next-intl Implementation Guide

## ✅ Setup Complete!

Your application now supports both English and Korean languages using next-intl.

## 📁 File Structure

```
ankh-client-app/
├── messages/
│   ├── en.json          # English translations
│   └── ko.json          # Korean translations
├── middleware.ts        # Handles locale routing
├── src/
│   ├── i18n.ts         # i18n configuration
│   ├── components/
│   │   └── LanguageSwitcher.tsx  # Language switcher component
│   └── app/
│       ├── api/        # API routes (stays outside [locale])
│       └── [locale]/   # Internationalized pages
│           ├── layout.tsx
│           ├── page.tsx
│           └── add-record/
```

## 🎯 How to Use Translations

### In Client Components ('use client')

```typescript
import { useTranslations } from 'next-intl';

export default function MyComponent() {
  const t = useTranslations();
  
  return (
    <div>
      <h1>{t('Common.appName')}</h1>
      <button>{t('Common.save')}</button>
    </div>
  );
}
```

### In Server Components

```typescript
import {useTranslations} from 'next-intl/server';

export default async function MyServerComponent() {
  const t = await useTranslations();
  
  return <h1>{t('Common.appName')}</h1>;
}
```

### With Parameters

```typescript
// In translation file:
{
  "AddRecord": {
    "lessonInfoForCustomer": "Adding lesson for {customerName}"
  }
}

// In component:
t('AddRecord.lessonInfoForCustomer', { customerName: 'John Doe' })
```

## 🌐 Language Switcher

The `LanguageSwitcher` component has been added to the header. It automatically:
- Detects the current language
- Switches between English and Korean
- Maintains the current page when switching languages

## 📝 Adding New Translations

1. **Add to English file** (`messages/en.json`):
```json
{
  "MySection": {
    "title": "My Title",
    "description": "My Description"
  }
}
```

2. **Add to Korean file** (`messages/ko.json`):
```json
{
  "MySection": {
    "title": "내 제목",
    "description": "내 설명"
  }
}
```

3. **Use in component**:
```typescript
t('MySection.title')
t('MySection.description')
```

## 🔄 Updating Existing Pages

To add translations to a page:

1. Import the translation hook:
```typescript
import { useTranslations } from 'next-intl';
```

2. Use the hook in your component:
```typescript
const t = useTranslations();
```

3. Replace hard-coded text:
```typescript
// Before:
<h1>Add New Record</h1>

// After:
<h1>{t('AddRecord.title')}</h1>
```

## 🛣️ URL Structure

- English: `http://localhost:3000/en/`
- Korean: `http://localhost:3000/ko/`
- Default (auto-detected): `http://localhost:3000/`

The middleware automatically:
- Detects the user's preferred language from browser settings
- Redirects to the appropriate locale
- Maintains locale across navigation

## 📋 Translation Keys Available

### Common
- `Common.appName`, `Common.back`, `Common.search`, etc.

### Auth
- `Auth.login`, `Auth.logout`, `Auth.username`, `Auth.password`

### HomePage
- `HomePage.welcome`, `HomePage.searchPlaceholder`

### CustomerSearch
- `CustomerSearch.title`, `CustomerSearch.name`, `CustomerSearch.email`
- `CustomerSearch.initialCondition`, `CustomerSearch.mainConcern`

### AddRecord
- `AddRecord.title`, `AddRecord.customerType`
- `AddRecord.firstName`, `AddRecord.lastName`

### UserManagement, LocationManagement, CSVImport, QuickActions
- Complete translations for all sections

## 🎨 Next Steps

1. **Update add-record page** with translations
2. **Update all dialog modals** with translations
3. **Update search results** with translations
4. **Test both languages** thoroughly
5. **Add more translations** as needed

## 🐛 Troubleshooting

### Build Errors
If you see build errors, restart the dev server:
```bash
npm run dev
```

### Missing Translations
If a translation key is missing, it will display the key itself. Add it to both `en.json` and `ko.json`.

### API Routes
API routes stay outside the `[locale]` folder and don't need translations (they return data, not UI).

## 📚 Resources

- [next-intl Documentation](https://next-intl-docs.vercel.app/)
- [Next.js i18n Routing](https://nextjs.org/docs/app/building-your-application/routing/internationalization)

---

**Note**: The main page header now includes the language switcher and some translations have been applied as examples. Continue applying translations to other components following the same pattern.
