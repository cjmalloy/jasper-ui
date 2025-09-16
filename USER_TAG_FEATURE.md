# User Tag Selector Feature

## Overview

The User Tag Selector allows authenticated users to change their active user tag to any valid sub tag. This selected tag is automatically sent as the `User-Tag` header in all API requests, enabling users to operate under different sub-identities without requiring separate authentication.

## Problem Statement

After the initial `whoAmI` call, users know their authenticated user tag (e.g., `+user/chris@`). However, they may want to set their user tag to any sub tag (e.g., `+user/chris@/admin`, `+user/chris@/work`) for different contexts or roles. This feature adds a user input that saves the selected sub tag in local storage and sets the `User-Tag` header accordingly.

## Implementation

### Components

1. **UserTagService** (`src/app/service/user-tag.service.ts`)
   - Manages user tag selection and validation
   - Provides reactive observable for current selected tag
   - Handles local storage persistence
   - Validates sub tags to ensure they are valid children of the authenticated user tag

2. **UserTagSelectorComponent** (`src/app/component/user-tag-selector/`)
   - UI component with dropdown selector for predefined common sub tags
   - Custom sub tag creation with input validation
   - Real-time display of currently active tag
   - Located in Settings → Me page

3. **AuthInterceptor** (updated in `src/app/http/auth.interceptor.ts`)
   - Enhanced to include `User-Tag` header in API requests
   - Only adds header to requests targeting the API (`/api/` URLs)
   - Falls back to authenticated user tag when no sub tag is selected

4. **LocalStore** (updated in `src/app/store/local.ts`)
   - Added methods to persist selected user tag in localStorage
   - Provides getter/setter for `selectedUserTag`

### Features

- ✅ Dropdown selector with predefined common sub tags (admin, work, personal, bot, test, etc.)
- ✅ Custom sub tag creation with input validation
- ✅ Local storage persistence of selected tag
- ✅ HTTP interceptor that adds User-Tag header to API requests
- ✅ Sub tag validation ensures only valid sub tags are allowed
- ✅ Fallback to authenticated user tag when no sub tag is selected
- ✅ Real-time display of currently active tag

### Usage

1. Navigate to **Settings → Me**
2. Use the "Active User Tag" dropdown to select from predefined sub tags
3. Or select "Create custom sub tag..." to create a new sub tag
4. The selected tag is automatically saved and used for all API requests
5. Clear selection to return to the default authenticated user tag

### HTTP Header Example

When a sub tag is selected, all API requests will include the User-Tag header:

```http
POST /api/v1/ref HTTP/1.1
Host: localhost:8081
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
User-Tag: +user/chris@/admin
Content-Type: application/json

{ "url": "example.com", "tags": ["public"] }
```

### Sub Tag Validation

Sub tags must follow these rules:
- Must be the same as the authenticated user tag OR start with the authenticated user tag followed by `/`
- Examples for user `+user/chris@`:
  - ✅ Valid: `+user/chris@`, `+user/chris@/admin`, `+user/chris@/work/project1`
  - ❌ Invalid: `+user/other@/admin`, `invalid`, `+admin`

### Security Considerations

- Sub tags are validated on the client side to prevent invalid tags from being sent
- The backend should also validate that the User-Tag header represents a valid sub tag of the authenticated user
- Local storage is used for persistence, so selections are per-browser/device

## Testing

The implementation includes:
- Comprehensive validation logic for sub tag format
- HTTP interceptor tests for header injection
- Component tests for UI interactions
- Manual functionality verification

## Files Changed

- `src/app/service/user-tag.service.ts` (new)
- `src/app/service/user-tag.service.spec.ts` (new)
- `src/app/component/user-tag-selector/` (new directory)
- `src/app/http/auth.interceptor.ts` (updated)
- `src/app/store/local.ts` (updated)
- `src/app/page/settings/me/me.component.html` (updated)
- `src/app/app.module.ts` (updated)

## Future Enhancements

- Dynamic loading of existing sub tags from the backend
- User tag history and recent selections
- Tag-specific settings and preferences
- Integration with role-based access control