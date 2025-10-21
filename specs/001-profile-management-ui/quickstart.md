# Quickstart: Profile Management UI

**Feature**: 001-profile-management-ui
**Date**: 2025-10-21
**Purpose**: Manual validation scenarios for Profile Management UI

## Prerequisites

- Electron app running (`npm run dev`)
- Database initialized with migrations (`npm run migrate:latest`)
- No previous profile data (or use "Delete Profile" to start fresh)

---

## Scenario 1: First-Time Profile Creation (Auto-save)

**Goal**: Validate auto-save behavior for basic profile fields

**Steps**:

1. Launch application
2. Navigate to Profile page
3. Observe: Profile completion indicator shows 0%
4. Enter first name: "Max"
5. Wait 1 second
6. Enter last name: "Mustermann"
7. Wait 3 seconds (trigger auto-save after 2s debounce)
8. Check database: `SELECT * FROM user_profile WHERE id = 1`

**Expected Result**:

- ✅ Data saved automatically after 2 seconds
- ✅ Profile completion indicator shows 100% (first name + last name present)
- ✅ Success notification appears: "Profile saved successfully!"
- ✅ Database contains: `first_name='Max', last_name='Mustermann'`

---

## Scenario 2: Add Skill with Category

**Goal**: Validate skill creation with category and level

**Steps**:

1. Navigate to Profile → Skills tab
2. Click "Add Skill" button
3. Enter skill name: "React"
4. Select category: "Frameworks & Libraries"
5. Move level slider to 7
6. (Optional) Enter years of experience: 3
7. Click "Add" button
8. Observe: Skill appears grouped under "Frameworks & Libraries"
9. Click "Save Changes" button
10. Check database: `SELECT * FROM skills WHERE name = 'React'`

**Expected Result**:

- ✅ Skill displayed with "Level 7/10" badge
- ✅ Skill grouped under correct category
- ✅ "Save Changes" button enabled (unsaved changes detected)
- ✅ After save: Success notification "Skills saved successfully!"
- ✅ Database contains: `name='React', level=7, years_experience=3`

---

## Scenario 3: Custom Skill Category

**Goal**: Validate custom category creation

**Steps**:

1. Navigate to Profile → Skills tab
2. Click "Add Skill"
3. Select category: "Custom Category"
4. Enter custom category name: "DevOps Tools"
5. Enter skill name: "Docker"
6. Set level: 5
7. Click "Add"
8. Add another skill: "Kubernetes", category "DevOps Tools", level 4
9. Click "Save Changes"

**Expected Result**:

- ✅ Custom category "DevOps Tools" appears in category list
- ✅ Both skills grouped under "DevOps Tools"
- ✅ Category persists after save and page reload

---

## Scenario 4: Max 500 Skills Limit

**Goal**: Validate skill limit enforcement

**Prerequisites**: Create script to insert 500 skills into database

**Steps**:

1. Navigate to Profile → Skills tab
2. Observe: Counter shows "500 / 500"
3. Try to click "Add Skill" button
4. Observe: Button is disabled

**Expected Result**:

- ✅ "Add Skill" button disabled when at limit
- ✅ Error message: "Maximum 500 skills reached"

---

## Scenario 5: Remote Work Range Validation

**Goal**: Validate remote percentage range constraint

**Steps**:

1. Navigate to Profile → Preferences tab
2. Enter:
   - Preferred remote percentage: 60%
   - Acceptable minimum: 40%
   - Acceptable maximum: 80%
3. Click "Save Changes"
4. Observe: Success notification

**Invalid Case**:

5. Change preferred to 90% (outside acceptable range 40-80%)
6. Try to save

**Expected Result**:

- ✅ Valid case (40 ≤ 60 ≤ 80): Saves successfully
- ✅ Invalid case (40 ≤ 90 > 80): Error message "Remote range validation failed: min ≤ preferred ≤ max"
- ✅ Save button disabled while validation fails

---

## Scenario 6: Salary Range Validation

**Goal**: Validate salary min ≤ max constraint

**Steps**:

1. Navigate to Profile → Preferences tab
2. Enter min salary: 60000
3. Enter max salary: 50000 (invalid: less than min)
4. Try to save

**Expected Result**:

- ✅ Error message: "Minimum salary cannot be greater than maximum salary"
- ✅ Save button disabled
- ✅ After fixing (max = 80000): Save succeeds

---

## Scenario 7: Unsaved Changes Warning

**Goal**: Validate unsaved changes detection

**Steps**:

1. Navigate to Profile → Skills tab
2. Add a new skill (do NOT save)
3. Try to navigate away (e.g., click "Preferences" tab)

**Expected Result**:

- ✅ Warning alert: "You have unsaved changes. Click 'Save Changes' to persist your updates."
- ✅ On browser close (beforeunload event): Browser warns before closing
- ✅ After saving: Navigation works without warning

---

## Scenario 8: Profile Deletion

**Goal**: Validate complete profile deletion with confirmation

**Steps**:

1. Navigate to Profile → Settings (or wherever Delete button is located)
2. Click "Delete Profile" button
3. Observe: Confirmation dialog appears
4. Dialog text includes warning: "This will permanently delete all your data"
5. Click "Cancel" → Nothing happens
6. Click "Delete Profile" again
7. Click "Confirm" in dialog
8. Check database: `SELECT * FROM user_profile, skills, user_preferences`

**Expected Result**:

- ✅ Confirmation dialog prevents accidental deletion
- ✅ After confirmation: All user data removed
- ✅ Database shows: 0 rows in user_profile, skills, user_preferences
- ✅ UI returns to empty/initial state

---

## Scenario 9: Profile Completion Indicator

**Goal**: Validate completion percentage calculation

**Test Cases**:

| First Name | Last Name | Expected Completion |
|------------|-----------|---------------------|
| (empty) | (empty) | 0% |
| "Max" | (empty) | 0% |
| (empty) | "Mustermann" | 0% |
| "Max" | "Mustermann" | 100% |

**Steps**:

1. Clear profile data
2. Test each combination above
3. Observe progress bar

**Expected Result**:

- ✅ Only when BOTH first name AND last name present: 100%
- ✅ Otherwise: 0%
- ✅ Email, skills, preferences do NOT affect percentage

---

## Scenario 10: Skill Level Semantics Display

**Goal**: Verify level labels are shown correctly

**Steps**:

1. Add skills with levels: 1, 4, 7, 10
2. Observe level labels/badges

**Expected Result**:

- Level 1: Shows "Beginner" (0-2 range)
- Level 4: Shows "Intermediate" (3-5 range)
- Level 7: Shows "Advanced" (6-8 range)
- Level 10: Shows "Expert" (9-10 range)

---

## Integration Test Scenarios

### Full Profile Flow (End-to-End)

1. **Create Profile**: Enter first name, last name, email → auto-save after 2s
2. **Add Skills**: Add 5 skills across 3 categories → explicit save
3. **Set Preferences**: Configure salary range + remote percentage → explicit save
4. **Verify Persistence**: Close and reopen app → all data preserved
5. **Update Profile**: Change email → auto-save after 2s
6. **Delete Skill**: Remove 1 skill → explicit save
7. **Update Preferences**: Change remote range → explicit save
8. **Delete Profile**: Confirm deletion → all data removed

**Expected**: All operations succeed, data persists correctly, no errors.

---

## Performance Validation

- **Auto-save debounce**: Measure time from last keystroke to save (should be ~2 seconds)
- **UI responsiveness**: Skill list with 100 skills should render in <100ms
- **Database queries**: Profile load should complete in <50ms

---

## Error Cases to Test

1. **Empty required fields**: Edit profile with only first name (auto-save should succeed as an incomplete draft at 0% completion; profile completion indicator should remain at 0% until both first and last name are provided)
2. **Invalid email format**: Enter "notanemail" → validation error
3. **Out of range skill level**: Try to set level to 11 (UI should prevent via slider)
4. **Concurrent edits**: Edit profile in two tabs simultaneously (not supported, but shouldn't corrupt data)

---

**Completion Checklist**:

- [ ] All 10 manual scenarios validated
- [ ] Integration test passed
- [ ] Performance benchmarks met
- [ ] Error cases handled gracefully
- [ ] All acceptance scenarios from spec.md verified

**Status**: Ready for manual testing after T011B completion.
