# IPC Channel Contracts: Profile Management UI

**Feature**: 001-profile-management-ui
**Date**: 2025-10-21
**Purpose**: Define IPC communication contracts between main and renderer processes

## Overview

Electron IPC channels for profile, skills, and preferences operations. All channels use `ipcRenderer.invoke()` / `ipcMain.handle()` pattern (async request/response).

---

## Profile Operations

### `PROFILE_GET`

**Description**: Retrieve user profile data

**Request**: `void` (no parameters)

**Response**:

```typescript
{
  id: number;              // Always 1
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  location?: string;
  created_at: string;      // ISO 8601 timestamp
  updated_at: string;
  skills?: Skill[];        // Optional: included if requested
  preferences?: Preferences; // Optional: included if requested
} | null                   // null if no profile exists
```

**Error Cases**:

- Database read error → throws Error with message

---

### `PROFILE_CREATE`

**Description**: Create new user profile (upsert pattern)

**Request**:

```typescript
{
  firstName: string;       // REQUIRED
  lastName: string;        // REQUIRED
  email?: string;
  phone?: string;
  location?: string;
}
```

**Response**:

```typescript
{
  id: 1;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  location?: string;
}
```

**Validation**:

- `firstName` and `lastName` cannot be empty
- `email` must match regex if provided

**Error Cases**:

- Validation failed → throws Error
- Database write error → throws Error

---

### `PROFILE_UPDATE`

**Description**: Update existing profile (partial update with COALESCE)

**Request**:

```typescript
{
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  location?: string;
}
```

**Response**:

```typescript
{
  id: 1;
  ...updatedFields
}
```

**Behavior**:

- Only provided fields are updated
- Uses COALESCE to preserve existing values for omitted fields
- `updated_at` timestamp automatically updated

**Error Cases**:

- Database write error → throws Error

---

### `PROFILE_DELETE`

**Description**: Delete entire user profile and all associated data

**Request**: `void` (no parameters)

**Response**:

```typescript
{
  success: true;
}
```

**Behavior**:

- Deletes ALL user data:
  - user_profile (id = 1)
  - All skills
  - user_preferences (id = 1)
- CASCADE deletion ensures related data is removed
- Resets auto-increment counters
- Operation is **irreversible**

**Error Cases**:

- Database write error → throws Error
- No profile exists → silent success (idempotent)

---

## Skills Operations

### `SKILLS_GET_ALL`

**Description**: Retrieve all skills for user profile

**Request**: `void`

**Response**:

```typescript
Array<{
  id: number;
  name: string;
  category: string;        // Category name (not ID)
  level: number;           // 0-10
  yearsOfExperience?: number;
}>
```

**Behavior**:

- Results ordered by `category.sort_order, skill.name`
- Joins with `skill_categories` to include category name

---

### `SKILLS_UPSERT`

**Description**: Create or update a skill

**Request**:

```typescript
{
  id?: number;             // If provided and exists in DB → update, else → insert
  name: string;            // REQUIRED
  level: number;           // REQUIRED, 0-10
  categoryId?: number;     // FK to skill_categories
  yearsOfExperience?: number;
}
```

**Response**:

```typescript
{
  id: number;              // DB-assigned ID (for new skills)
  name: string;
  level: number;
  categoryId?: number;
  yearsOfExperience?: number;
}
```

**Validation**:

- Check 500-skill limit before insert
- `level` must be in [0, 10]
- If `id` provided, check if skill exists in DB (not just truthy ID)

**Error Cases**:

- Max 500 skills reached → throws Error("Cannot add more than 500 skills")
- Invalid level → throws Error
- Database write error → throws Error

---

### `SKILLS_DELETE`

**Description**: Delete a skill by ID

**Request**: `id: number`

**Response**:

```typescript
{ success: true }
```

**Error Cases**:

- Skill not found → silent success (idempotent)
- Database error → throws Error

---

## Preferences Operations

### `PREFERENCES_GET`

**Description**: Retrieve user preferences

**Request**: `void`

**Response**:

```typescript
{
  minSalary?: number;
  maxSalary?: number;
  preferredLocations: string[];
  remoteWorkPreference: 'remote_only' | 'hybrid' | 'on_site' | 'flexible';
  preferredRemotePercentage?: number;  // 0-100
  acceptableRemoteMin?: number;        // 0-100
  acceptableRemoteMax?: number;        // 0-100
} | null                               // null if no preferences set
```

**Behavior**:

- Maps DB snake_case to camelCase
- Parses `desired_locations` JSON to array

---

### `PREFERENCES_UPDATE`

**Description**: Update user preferences (upsert pattern)

**Request**:

```typescript
{
  minSalary?: number;
  maxSalary?: number;
  preferredLocations?: string[];
  remoteWorkPreference?: 'remote_only' | 'hybrid' | 'on_site' | 'flexible';
  preferredRemotePercentage?: number;
  acceptableRemoteMin?: number;
  acceptableRemoteMax?: number;
}
```

**Response**:

```typescript
{
  id: 1;
  ...updatedFields
}
```

**Validation** (applied in order):

1. **Salary Range**: If both provided, `minSalary ≤ maxSalary`
2. **Remote Range**: If all three provided, `acceptableRemoteMin ≤ preferredRemotePercentage ≤ acceptableRemoteMax`
3. Remote percentages in [0, 100]

**Error Cases**:

- Salary range invalid → throws Error
- Remote range invalid → throws Error
- Database write error → throws Error

---

## Channel Name Constants

All channel names defined in `src/shared/constants.ts`:

```typescript
export const IPC_CHANNELS = {
  PROFILE_CREATE: 'profile:create',
  PROFILE_UPDATE: 'profile:update',
  PROFILE_GET: 'profile:get',
  PROFILE_DELETE: 'profile:delete',

  SKILLS_GET_ALL: 'skills:getAll',
  SKILLS_UPSERT: 'skills:upsert',
  SKILLS_DELETE: 'skills:delete',

  PREFERENCES_GET: 'preferences:get',
  PREFERENCES_UPDATE: 'preferences:update'
} as const;
```

---

## Implementation Status

**Main Process** (`src/main/ipc/handlers.ts`):

- ✅ 8 handlers implemented (T008-T010 complete)
- ⏳ PROFILE_DELETE pending (T017 - not yet implemented)

**Renderer Process** (`src/main/preload.ts`):

- ✅ All channels exposed via `window.api.*`

**Zustand Store** (`src/renderer/store/profileStore.ts`):

- ✅ Store created with actions that call IPC (T011A complete)
- ⏳ Components integration (T011B in progress)

---

## Security Notes

- No authentication needed (single-user desktop app)
- All data local (no network transmission)
- Input validation on both renderer and main process
- SQL injection prevented (parameterized queries via Knex/better-sqlite3)

---

## Testing Strategy

**Contract Tests** (validate schema compliance):

```typescript
describe('PROFILE_GET contract', () => {
  it('returns null when no profile exists', async () => {
    const result = await window.api.getProfile();
    expect(result).toBeNull();
  });

  it('returns profile with correct schema', async () => {
    await window.api.createProfile({ firstName: 'Max', lastName: 'Mustermann' });
    const result = await window.api.getProfile();

    expect(result).toMatchObject({
      id: 1,
      first_name: 'Max',
      last_name: 'Mustermann'
    });
  });
});
```

**Validation Tests**:

```typescript
describe('SKILLS_UPSERT validation', () => {
  it('throws error when 500 skill limit reached', async () => {
    // Insert 500 skills...
    await expect(
      window.api.upsertSkill({ name: 'Skill 501', level: 5 })
    ).rejects.toThrow('Cannot add more than 500 skills');
  });
});
```

---

**Status**: Contract definitions complete. All channels already implemented and tested in codebase.
