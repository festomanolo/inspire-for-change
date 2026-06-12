# Day Tracking & Quick Edit Features

## New Features Implemented

### 1. Day Selection (Day 1, Day 2, Day 3) 🆕

**Purpose**: Track which day(s) of the multi-day event each guest attends.

**Where to use**:
- Registration form: Select which day the guest will attend
- Guest list: View day badges for all guests
- Guest detail page: View and edit day information

**How it works**:
```
Day 1 | Day 2 | Day 3
  ✓       ○       ○
```

**Benefits**:
- Track attendance across multiple days
- Plan resources per day (meals, camping spots, etc.)
- Generate day-specific reports
- See statistics on dashboard (Day 1, Day 2, Day 3 counts)

---

### 2. Guest Search & Auto-fill 🆕

**Purpose**: Quickly register returning guests by loading their previous information.

**How to use**:
1. Go to the registration form
2. In the "Load existing guest" search box, type:
   - Guest's name (first or last)
   - Phone number
3. Select the guest from the dropdown
4. Their information automatically fills the form
5. Change the day to the new attendance day
6. Save to create a new registration record

**Example Workflow**:
```
Day 1: John Doe registers for Day 1
Day 2: Search "John Doe" → Auto-fills his info → Select Day 2 → Save
```

**Benefits**:
- Saves time re-entering guest information
- Reduces data entry errors
- Maintains consistency across days
- Easy to track multi-day attendees

**Search matches on**:
- First name (partial match)
- Last name (partial match)
- Phone number (partial match)

---

### 3. Inline Edit & Delete in Guest List 🆕

**Purpose**: Quick editing and management without leaving the guest list page.

**Features**:

#### Edit Guest
1. Click "Edit" button on any row
2. Row transforms into editable fields:
   - First name
   - Last name
   - Origin
   - Phone
   - Day (dropdown: -, 1, 2, 3)
   - Status (dropdown: Camping, Not camping)
3. Click "Save" to update or "Cancel" to discard

#### Delete Guest
1. Click "Delete" button on any row
2. Confirm the deletion
3. Guest is permanently removed

**Benefits**:
- Quick corrections without navigating to detail page
- Batch updates easier (edit multiple guests in sequence)
- Immediate visual feedback
- Actions visible: Edit and Delete buttons on each row

**Security**:
- Delete requires confirmation
- All changes are tracked in audit log
- Only authenticated users can edit/delete

---

## Database Schema Changes

### New Field: `day`
```sql
ALTER TABLE public.guests ADD COLUMN day INTEGER;
```

**Properties**:
- Type: INTEGER
- Nullable: Yes (guests can have no day specified)
- Values: 1, 2, or 3 (representing event days)
- Indexed for performance

**Audit Trail**:
- Day changes are tracked in `guest_edits` table
- Shows "day" in change history with from/to values

---

## Dashboard Updates

### New Statistics Cards

**Day Attendance**:
```
┌─────────┐  ┌─────────┐  ┌─────────┐
│ Day 1   │  │ Day 2   │  │ Day 3   │
│   42    │  │   38    │  │   45    │
└─────────┘  └─────────┘  └─────────┘
```

Shows count of guests registered for each day.

**Combined View**:
```
Total guests: 89
Camping: 56
Not camping: 33

Day 1: 42
Day 2: 38
Day 3: 45
```

---

## User Interface Changes

### Registration Form

**New Sections**:

1. **Guest Search** (at top):
   ```
   ┌──────────────────────────────────────────────┐
   │ Load existing guest (optional)               │
   │ ┌──────────────────────────────────────────┐ │
   │ │ Search by name or phone...               │ │
   │ └──────────────────────────────────────────┘ │
   │ For returning guests, search to auto-fill    │
   └──────────────────────────────────────────────┘
   ```

2. **Day Selection** (after status):
   ```
   ┌──────────────────────────────────────────────┐
   │ Day of attendance (optional)                 │
   │ ┌──────┐  ┌──────┐  ┌──────┐                │
   │ │Day 1 │  │Day 2 │  │Day 3 │                │
   │ └──────┘  └──────┘  └──────┘                │
   │ Select which day this guest will attend      │
   └──────────────────────────────────────────────┘
   ```

### Guest List

**Updated Table Layout**:
```
| Name        | Origin    | Phone        | Day | Status      | Actions        |
|-------------|-----------|--------------|-----|-------------|----------------|
| John Doe    | Nairobi   | +254 123 456 | [1] | Camping     | [Edit][Delete] |
| Jane Smith  | Kampala   | +256 789 012 | [2] | Not camping | [Edit][Delete] |
```

**Day Badge**:
- Circular badge with day number
- Accent color (blue) background
- "-" if no day specified

**Action Buttons**:
- **Edit**: Opens inline editor
- **Delete**: Prompts confirmation then deletes

### Guest Detail Page

**New Field in View Mode**:
```
Phone:          +255 123 456 789
Origin:         Dar es Salaam
Day:            Day 2
Status:         Camping
```

**New Field in Edit Mode**:
```
Day: [Dropdown]
     - Not specified
     - Day 1
     - Day 2
     - Day 3
```

---

## Real-Time Synchronization

All changes sync in real-time across all users:

**Actions that trigger notifications**:
- ✅ Guest registered with day selection
- ✅ Guest day changed via inline edit
- ✅ Guest deleted from guest list
- ✅ Guest updated on detail page

**Notification examples**:
- "New guest registered: John Doe"
- "Guest updated: Jane Smith"
- "Guest deleted: Bob Johnson"

---

## Common Use Cases

### Use Case 1: Multi-Day Registration
**Scenario**: Guest attends Day 1 and Day 3

**Steps**:
1. Day 1: Register guest, select "Day 1"
2. Day 3: Search guest's name
3. Click on search result to auto-fill
4. Change day to "Day 3"
5. Click "Save & add another"

**Result**: Two records for same guest with different days

### Use Case 2: Day Change
**Scenario**: Guest registered for Day 2 but wants to change to Day 1

**Steps**:
1. Go to guest list
2. Find the guest
3. Click "Edit"
4. Change day dropdown from "2" to "1"
5. Click "Save"

**Result**: Guest's day is updated, change is logged in audit trail

### Use Case 3: Quick Corrections
**Scenario**: Multiple typos in guest list

**Steps**:
1. Go to guest list
2. Click "Edit" on first guest
3. Fix phone number
4. Click "Save"
5. Click "Edit" on next guest
6. Fix origin
7. Click "Save"
8. Repeat as needed

**Result**: Multiple guests corrected without page navigation

### Use Case 4: Day Statistics
**Scenario**: Planning meals for each day

**Steps**:
1. View dashboard
2. Check day statistics:
   - Day 1: 42 guests
   - Day 2: 38 guests
   - Day 3: 45 guests
3. Plan accordingly

**Result**: Know exactly how many guests per day

---

## Data Migration

**Existing guests**:
- Have `day = NULL` by default
- Can be updated anytime via edit function
- No breaking changes to existing data

**Backward compatibility**:
- System works with or without day specification
- Day is optional field
- Old registrations display "-" for day

---

## Performance Considerations

**Optimizations**:
- Database index on `day` column for fast filtering
- Search debounced (300ms) to avoid excessive queries
- Search limited to 5 results for performance
- Real-time updates only for current event

**Scalability**:
- Handles thousands of guests efficiently
- Search uses PostgreSQL's ilike (case-insensitive)
- Indexes ensure fast lookups

---

## Best Practices

### For Registrars

1. **Use guest search** for returning guests to save time
2. **Specify day** whenever possible for better planning
3. **Use inline edit** for quick corrections
4. **Double-check before delete** - deletion is permanent
5. **Review dashboard statistics** to track attendance patterns

### For Administrators

1. **Monitor day distribution** to balance resources
2. **Check audit trail** for changes to day field
3. **Run day-specific reports** for planning
4. **Backup database** before bulk edits
5. **Train registrars** on guest search feature

---

## Troubleshooting

**Q: Guest search returns too many results**
- Type more characters (minimum 2 required)
- Include phone number for exact match
- Search is limited to 5 results

**Q: Can't find guest in search**
- Check spelling
- Try searching by phone instead of name
- Ensure guest was registered for this event
- Search is case-insensitive but spelling must be close

**Q: Edit button not working**
- Check your internet connection
- Refresh the page
- Ensure you're logged in
- Check browser console for errors

**Q: Should I create duplicate records for multi-day attendance?**
- Yes! Each day gets its own record
- Use guest search to quickly fill info for new day
- This allows tracking individual day attendance

**Q: What if I don't know which day during registration?**
- Leave day unspecified (it's optional)
- Can be updated later via inline edit or detail page
- Shows "-" in the list until specified

---

## Migration Guide

### Applying the Database Migration

**Option 1: Via Supabase Dashboard**
1. Go to SQL Editor
2. Paste contents of `supabase/migrations/20260612000001_add_day_and_attendance_fields.sql`
3. Run the migration
4. Verify: `SELECT * FROM guests LIMIT 1;` should show `day` column

**Option 2: Via Supabase CLI**
```bash
supabase db push
```

**Verification**:
```sql
-- Check column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'guests' AND column_name = 'day';

-- Check index exists
SELECT indexname FROM pg_indexes WHERE tablename = 'guests' AND indexname = 'guests_day_idx';
```

---

## Future Enhancements (Potential)

- Filter guest list by day
- Day-specific check-in system
- Multi-day package pricing
- Day attendance analytics/charts
- Export day-specific CSV reports
- Bulk day assignment
- Day-specific badges/QR codes

---

## Summary

The new features provide:
- ✅ Day tracking (1, 2, 3) for multi-day events
- ✅ Guest search for quick returning guest registration
- ✅ Inline edit/delete in guest list
- ✅ Dashboard statistics by day
- ✅ Full audit trail of changes
- ✅ Real-time sync across all users
- ✅ Backward compatible with existing data

**Key Benefits**:
- Faster registration for returning guests
- Better event planning with day-specific data
- Quick corrections without page navigation
- Comprehensive attendance tracking
