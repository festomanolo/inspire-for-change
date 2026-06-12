# Multi-Day Registration Guide

## How Multi-Day Registration Works

### ✅ Correct Behavior (Now Fixed!)

**The same person CAN register for multiple days**

```
Example:
- John Doe registers for Day 1 ✅
- John Doe registers for Day 2 ✅ (Allowed!)
- John Doe registers for Day 3 ✅ (Allowed!)
```

**Result**: 3 separate guest records, one for each day

---

## Duplicate Detection Logic

### ⚠️ Blocks Registration When:
- Same phone number + Same day
- Same name + Same day

### ✅ Allows Registration When:
- Same phone number + Different day
- Same name + Different day

### ℹ️ Shows Information When:
- Guest exists for another day (blue info message)

---

## Example Scenarios

### Scenario 1: Guest Attends Day 1 and Day 2 ✅

**Day 1 Registration:**
```
Name: John Doe
Phone: +255 784 953 866
Day: Day 1
Status: Camping
```
**Result**: ✅ Saved successfully

**Day 2 Registration (Same Guest):**
```
1. Search "John Doe" in guest search box
2. Click his name to auto-fill
3. Change day from 1 to 2
4. Save
```
**Shows**: ℹ️ Note: This guest is registered for Day 1. You're registering them for Day 2.
**Result**: ✅ Saved successfully - 2nd record created

---

### Scenario 2: Accidental Duplicate on Same Day ⚠️

**Day 1 Registration:**
```
Name: Jane Smith
Phone: +254 123 456 789
Day: Day 1
```
**Result**: ✅ Saved successfully

**Trying to Register Again for Day 1:**
```
Name: Jane Smith
Phone: +254 123 456 789
Day: Day 1
```
**Shows**: ⚠️ This guest with phone +254 123 456 789 is already registered for Day 1.
**Result**: ❌ Blocked - cannot save

---

### Scenario 3: Different Guest, Same Phone, Same Day ⚠️

**First Registration:**
```
Name: John Doe
Phone: +255 111 222 333
Day: Day 2
```
**Result**: ✅ Saved

**Second Registration (Same Day):**
```
Name: Mary Johnson
Phone: +255 111 222 333  (Same phone!)
Day: Day 2
```
**Shows**: ⚠️ This guest with phone +255 111 222 333 is already registered for Day 2.
**Result**: ❌ Blocked - shared phones not allowed on same day

---

### Scenario 4: Different Guest, Same Phone, Different Day ✅

**First Registration:**
```
Name: John Doe
Phone: +255 111 222 333
Day: Day 1
```
**Result**: ✅ Saved

**Second Registration (Different Day):**
```
Name: Mary Johnson
Phone: +255 111 222 333  (Same phone!)
Day: Day 2
```
**Shows**: ℹ️ Note: This guest is registered for Day 1. You're registering them for Day 2.
**Result**: ✅ Allowed (maybe they're family members sharing a phone)

---

## Visual Indicators

### Warning Messages

#### 🟠 Orange Warning (Blocks Save)
```
⚠️ This guest with phone +255 123... is already registered for Day 2.
```
**Meaning**: Duplicate on same day - cannot save

#### 🔵 Blue Info (Allows Save)
```
ℹ️ Note: This guest is registered for Day 1. You're registering them for Day 2.
```
**Meaning**: Guest exists for another day - just informational

#### 🔴 Red Error (Blocks Save)
```
A guest with phone number +255 123... is already registered for Day 2. Please verify the information.
```
**Meaning**: Tried to save duplicate on same day

---

## Best Practices

### For Registrars

1. **Use Guest Search for Returning Guests**
   ```
   Day 1 → Register normally
   Day 2 → Search guest → Auto-fill → Change day → Save
   Day 3 → Search guest → Auto-fill → Change day → Save
   ```

2. **Always Select the Day**
   - Day field is optional but highly recommended
   - Without day selection, system can't detect duplicates properly
   - Blank day means "unspecified" - can lead to confusion

3. **Verify Before Override**
   - If you see an orange warning, double-check the information
   - Make sure it's not an accidental duplicate
   - If intentional, change the day to a different one

4. **Check Blue Info Messages**
   - Blue messages are just informational
   - They help you know the guest is returning
   - You can proceed with the registration

---

## Data Structure

### Single Guest, Multiple Days

**In database (data/guests.json):**
```json
[
  {
    "id": "uuid-1",
    "first_name": "John",
    "last_name": "Doe",
    "phone": "+255 784 953 866",
    "day": 1,
    "event_id": "event-2026",
    ...
  },
  {
    "id": "uuid-2",
    "first_name": "John",
    "last_name": "Doe",
    "phone": "+255 784 953 866",
    "day": 2,
    "event_id": "event-2026",
    ...
  },
  {
    "id": "uuid-3",
    "first_name": "John",
    "last_name": "Doe",
    "phone": "+255 784 953 866",
    "day": 3,
    "event_id": "event-2026",
    ...
  }
]
```

**Result**: 3 separate records, one per day

---

## Dashboard Statistics

### How Days Are Counted

```
Day 1: 42 guests  ← Counts records with day=1
Day 2: 38 guests  ← Counts records with day=2
Day 3: 45 guests  ← Counts records with day=3
```

**Important**: If the same person attends all 3 days, they count towards all 3 statistics.

**Example**:
- John Doe: Day 1 + Day 2 + Day 3
- He appears in all 3 day counts
- Total unique people ≠ sum of day counts

---

## Reporting

### Guest List View

Each day's attendance shows as a separate row:

```
┌──────────────┬─────┬──────────────┐
│ Name         │ Day │ Status       │
├──────────────┼─────┼──────────────┤
│ John Doe     │ [1] │ Camping      │
│ John Doe     │ [2] │ Camping      │
│ John Doe     │ [3] │ Not camping  │
└──────────────┴─────┴──────────────┘
```

**Note**: Same person appears multiple times if registered for multiple days

### CSV Export

**When you export CSV:**
- Each row is a separate registration
- Same person appears multiple times if they attended multiple days
- Filter/pivot in Excel to count unique guests

**Example CSV:**
```csv
first_name,last_name,phone,day,status
John,Doe,+255784953866,1,camping
John,Doe,+255784953866,2,camping
John,Doe,+255784953866,3,not_camping
```

---

## Troubleshooting

### Q: I get "already registered" error but it's a different day

**A**: Make sure you selected the correct day before submitting. The error only appears if:
1. Same phone + same day, OR
2. Same name + same day

### Q: Can I register someone without selecting a day?

**A**: Yes, day is optional. However:
- ⚠️ Without day, duplicate detection won't work properly
- 💡 Best practice: always select a day for multi-day events

### Q: What if someone changes their mind about camping between days?

**A**: Perfect! Each day is independent:
```
Day 1: Camping
Day 2: Not camping
Day 3: Camping
```
Each registration can have different status.

### Q: How do I see all days a person is registered for?

**A**: 
1. Go to guest list
2. Search for their name
3. All their registrations appear
4. Check the day badges

### Q: Can I delete just one day's registration?

**A**: Yes! Each day is a separate record:
1. Find the specific day's record
2. Click Delete
3. Other days remain intact

---

## Edge Cases

### Case 1: Guest Registered for Day 1, Now Wants Day 2 Only

**Solution**: 
1. Register for Day 2 (new record)
2. Delete Day 1 record if they're not attending

### Case 2: Guest Registered Without Day, Now Specifying

**Solution**:
1. Edit the original record
2. Set the day field
3. Or register again with day specified

### Case 3: Group Registration - Multiple Days

**Solution**:
1. Register all people for Day 1
2. Use guest search to register same people for Day 2
3. Repeat for Day 3

---

## Summary

### ✅ Key Takeaways

1. **Same person CAN register for multiple days** - each day is separate
2. **Same person CANNOT register for same day twice** - blocked by system
3. **Always select the day** - helps with duplicate detection
4. **Use guest search** - fastest way to register for additional days
5. **Blue info = OK** - orange warning = stop and check
6. **Each day counts separately** - affects statistics
7. **Independent records** - can edit/delete per day

### 🎯 Workflow for Multi-Day Guests

```
Registration Day 1:
├─ Fill form completely
├─ Select "Day 1"
└─ Save ✅

Registration Day 2 (Same Guest):
├─ Search guest name
├─ Click to auto-fill
├─ Change to "Day 2"
├─ See blue info message (OK!)
└─ Save ✅

Registration Day 3 (Same Guest):
├─ Search guest name
├─ Click to auto-fill
├─ Change to "Day 3"
├─ See blue info message (OK!)
└─ Save ✅

Result: 3 records for same person, different days ✅
```

---

**Everything now works correctly! You can register the same guest for multiple days without errors.** 🎉
