# Data Model: Profile Management UI

**Feature**: 001-profile-management-ui
**Date**: 2025-10-21
**Status**: Design Complete

## Entities

### UserProfile

Represents job seeker's personal information.

**Fields**:

- `id` (INTEGER, PRIMARY KEY) - Always 1 (single-user app)
- `first_name` (TEXT, REQUIRED) - User's first name
- `last_name` (TEXT, REQUIRED) - User's last name
- `email` (TEXT, OPTIONAL) - Email address (validated format)
- `phone` (TEXT, OPTIONAL) - Phone number
- `location` (TEXT, OPTIONAL) - Current/preferred city
- `created_at` (DATETIME, AUTO) - Profile creation timestamp
- `updated_at` (DATETIME, AUTO) - Last modification timestamp

**Validation Rules**:

- `first_name` and `last_name` are required (cannot be empty)
- `email` must match regex pattern `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` if provided
- All other fields optional

**State Transitions**: None (simple CRUD)

---

### Skill

Represents a competency with proficiency level.

**Fields**:

- `id` (INTEGER, PRIMARY KEY, AUTO INCREMENT)
- `name` (TEXT, REQUIRED) - Skill name (e.g., "React", "TypeScript")
- `level` (INTEGER, REQUIRED) - Proficiency level 0-10
- `category_id` (INTEGER, FOREIGN KEY → SkillCategory.id, OPTIONAL)
- `years_experience` (INTEGER, OPTIONAL) - Years of experience with this skill
- `created_at` (DATETIME, AUTO)
- `updated_at` (DATETIME, AUTO)

**Validation Rules**:

- `name` cannot be empty
- `level` must be in range [0, 10]
- Maximum 500 skills per user profile (enforced in application logic)
- Duplicate skill names allowed across different categories

**Level Semantics**:

- 0-2: Beginner
- 3-5: Intermediate
- 6-8: Advanced
- 9-10: Expert

**Relationships**:

- `category_id` → SkillCategory.id (many-to-one, optional)

---

### SkillCategory

Categorization for skills (predefined + custom).

**Fields**:

- `id` (INTEGER, PRIMARY KEY, AUTO INCREMENT)
- `name` (TEXT, UNIQUE, REQUIRED) - Category name
- `sort_order` (INTEGER) - Display order
- `is_predefined` (BOOLEAN, DEFAULT false) - True for system categories

**Predefined Categories** (7 total):

1. Programming Languages
2. Frameworks & Libraries
3. Databases
4. DevOps & Cloud
5. Tools & IDEs
6. Soft Skills
7. Domain Knowledge

**Validation Rules**:

- `name` must be unique
- Cannot delete predefined categories
- Custom categories have `is_predefined = false`

**Relationships**:

- One-to-many with Skill

---

### UserPreferences

Job search criteria and preferences.

**Fields**:

- `id` (INTEGER, PRIMARY KEY) - Always 1 (single-user app)
- `desired_salary_min` (INTEGER, OPTIONAL) - Minimum desired salary
- `desired_salary_max` (INTEGER, OPTIONAL) - Maximum desired salary
- `desired_locations` (TEXT, OPTIONAL) - JSON array of preferred locations
- `remote_work_preference` (TEXT, REQUIRED) - One of: remote_only, hybrid, on_site, flexible
- `preferred_remote_percentage` (INTEGER, OPTIONAL) - Ideal remote work % (0-100)
- `acceptable_remote_min` (INTEGER, OPTIONAL) - Minimum acceptable remote % (0-100)
- `acceptable_remote_max` (INTEGER, OPTIONAL) - Maximum acceptable remote % (0-100)
- `created_at` (DATETIME, AUTO)
- `updated_at` (DATETIME, AUTO)
- `remote_work_updated_at` (DATETIME, AUTO) - Timestamp of last remote preference change

**Validation Rules**:

- **Salary Range**: If both set, `desired_salary_min ≤ desired_salary_max`
- **Remote Range**: If all three remote fields set, `acceptable_remote_min ≤ preferred_remote_percentage ≤ acceptable_remote_max`
- `remote_work_preference` must be one of: `remote_only`, `hybrid`, `on_site`, `flexible`
- Remote percentages must be in range [0, 100]

**State Transitions**: None (simple CRUD)

---

## Database Schema Changes

**Migration**: Already completed in T002 (`20251002000001_add_remote_preferences.js`)

- Added 3 new remote work fields to `user_preferences` table
- Added CHECK constraints for remote range validation
- Added trigger to auto-update `remote_work_updated_at` on change

**No additional migrations required for this feature.**

---

## Relationships Diagram

```text
UserProfile (1)
    └── (has many) Skills
            └── (belongs to) SkillCategory

UserPreferences (1)
    └── (independent, no relations)
```

---

## Data Access Patterns

### Create/Update Profile

- Auto-save after 2s debounce for basic fields
- Only `first_name` and `last_name` required
- Upsert pattern: `INSERT ... ON CONFLICT(id) DO UPDATE`

### Skill Management

- Explicit save required
- Add/edit/delete operations
- Validation: max 500 skills per profile
- Query pattern: `SELECT skills JOIN skill_categories ORDER BY category, skill_name`

### Preferences Management

- Explicit save required
- Real-time validation for salary and remote ranges
- Upsert pattern: `INSERT ... ON CONFLICT(id) DO UPDATE`

---

## Completion Criteria

**Profile Completion % Formula**:

```text
completion = 100% if (first_name AND last_name both non-empty)
           = 0% otherwise
```

Note: Email, skills, and preferences are optional and do not affect completion percentage.

---

**Status**: Data model complete and validated against requirements FR-001 through FR-011.
