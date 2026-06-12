# Quick Start: New Features

## 🎯 Registration Page - New Features

### 1. Search & Load Existing Guest (Top of Form)

```
┌─────────────────────────────────────────────────────────┐
│ Load existing guest (optional)                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🔍 Search by name or phone...                       │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                           │
│ Dropdown appears with matching guests:                   │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ John Doe                                            │ │
│ │ +255 123 456 789 • Dar es Salaam • Day 1           │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ Jane Smith                                          │ │
│ │ +1 555 000 0000 • New York • Day 2                 │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**How to use**:
1. Type guest's name or phone
2. Click on result
3. Form auto-fills with their info
4. Change day to new attendance day
5. Click Save

---

### 2. Day Selection (Below Status)

```
┌─────────────────────────────────────────────────────────┐
│ Day of attendance (optional)                            │
│                                                           │
│ ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│ │  Day 1   │  │  Day 2   │  │  Day 3   │               │
│ │    ✓     │  │          │  │          │               │
│ └──────────┘  └──────────┘  └──────────┘               │
│                                                           │
│ Select which day of the event this guest will attend     │
└─────────────────────────────────────────────────────────┘
```

**Tips**:
- Click to select
- Click again to deselect
- Optional - can leave blank
- Useful for multi-day event planning

---

## 📋 Guest List - New Features

### Table Layout (Now with Actions)

```
┌──────────────┬───────────┬──────────────┬─────┬─────────────┬─────────────────┐
│ Name         │ Origin    │ Phone        │ Day │ Status      │ Actions         │
├──────────────┼───────────┼──────────────┼─────┼─────────────┼─────────────────┤
│ John Doe     │ Nairobi   │ +254 123 456 │ [1] │ Camping     │ [Edit] [Delete] │
│ Jane Smith   │ Kampala   │ +256 789 012 │ [2] │ Not camping │ [Edit] [Delete] │
│ Bob Johnson  │ Kigali    │ +250 555 111 │ [-] │ Camping     │ [Edit] [Delete] │
└──────────────┴───────────┴──────────────┴─────┴─────────────┴─────────────────┘
```

---

### Inline Editing

**Before clicking Edit**:
```
│ John Doe     │ Nairobi   │ +254 123 456 │ [1] │ Camping     │ [Edit] [Delete] │
```

**After clicking Edit** (row becomes editable):
```
┌────────────────────────────────────────────────────────────────────────────────┐
│ [John____] [Doe____] │ [Nairobi___] │ [+254 123 456] │ [▼1] │ [▼Camping]     │
│                                                          [Save] [Cancel]        │
└────────────────────────────────────────────────────────────────────────────────┘
```

**What you can edit**:
- ✅ First name
- ✅ Last name
- ✅ Origin
- ✅ Phone
- ✅ Day (dropdown: -, 1, 2, 3)
- ✅ Status (dropdown: Camping, Not camping)

---

### Quick Actions

#### Edit Guest
```
1. Click [Edit] button
2. Row becomes editable
3. Make changes
4. Click [Save] or [Cancel]
```

#### Delete Guest
```
1. Click [Delete] button
2. Confirm deletion
3. Guest removed permanently
```

**⚠️ Warning**: Deletion is permanent and cannot be undone!

---

## 📊 Dashboard - New Statistics

### Before (3 cards):
```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ Total       │  │ Camping     │  │ Not camping │
│    89       │  │    56       │  │     33      │
└─────────────┘  └─────────────┘  └─────────────┘
```

### After (6 cards):
```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ Total       │  │ Camping     │  │ Not camping │
│    89       │  │    56       │  │     33      │
└─────────────┘  └─────────────┘  └─────────────┘

┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ Day 1       │  │ Day 2       │  │ Day 3       │
│    42       │  │    38       │  │     45      │
└─────────────┘  └─────────────┘  └─────────────┘
```

Now you can see:
- Total attendance
- Camping vs Not camping split
- **NEW**: Guests per day

---

## 🎬 Common Workflows

### Workflow 1: Register Returning Guest

```
Day 1: Guest attends → Register normally with Day 1 selected
     ↓
Day 2: Guest returns
     ↓
1. Go to registration
2. Search guest's name in "Load existing guest"
3. Click on their name
4. Form auto-fills
5. Change day from 1 to 2
6. Click "Save & add another"
     ↓
✅ Guest registered for Day 2 with same info
```

---

### Workflow 2: Fix Typo in Guest List

```
See typo in phone number
     ↓
1. Find guest in list
2. Click [Edit]
3. Fix phone number
4. Click [Save]
     ↓
✅ Updated instantly
✅ All users see the change
✅ Change logged in history
```

---

### Workflow 3: Remove Duplicate Entry

```
Notice duplicate guest
     ↓
1. Find duplicate in list
2. Click [Delete]
3. Confirm deletion
     ↓
✅ Duplicate removed
✅ Original guest remains
✅ Notification sent to all users
```

---

## 🎨 Visual Indicators

### Day Badges
```
[1]  = Day 1 (blue circle)
[2]  = Day 2 (blue circle)
[3]  = Day 3 (blue circle)
[-]  = No day specified
```

### Status Badges
```
🏕️ Camping      = Green background
🏠 Not camping  = Gray background
```

### Action Buttons
```
[Edit]    = Gray button, opens inline editor
[Delete]  = Red button, confirms then deletes
```

---

## 💡 Pro Tips

### For Speed
1. **Use keyboard**: Tab through form fields
2. **Use guest search**: Save time for returning guests
3. **Use inline edit**: Quick fixes without navigation
4. **Use "Save & add another"**: Batch registrations

### For Accuracy
1. **Double-check day**: Ensure correct day selected
2. **Verify before delete**: Deletion cannot be undone
3. **Check duplicates**: Warning will show if guest exists
4. **Watch notifications**: See when others make changes

### For Planning
1. **Monitor day stats**: Dashboard shows attendance per day
2. **Use guest list**: Sort and filter to see patterns
3. **Check history**: Guest detail page shows all changes
4. **Export CSV**: Download for external analysis

---

## 🔔 Notifications You'll See

```
🟢 "New guest registered: John Doe"
   → Someone added a guest

🔵 "Guest updated: Jane Smith"
   → Someone edited a guest

🟠 "Guest removed: Bob Johnson"
   → Someone deleted a guest

💡 "This guest was just updated by another registrar"
   → You're viewing a guest that was just edited
```

---

## ⚡ Keyboard Shortcuts (in forms)

```
Tab          → Move to next field
Shift+Tab    → Move to previous field
Enter        → Submit form (when on button)
Escape       → Cancel inline edit (when editing)
```

---

## 📱 Mobile Behavior

### Registration Form
- Guest search works on mobile
- Day buttons stack vertically
- Touch-friendly tap targets

### Guest List
- Simplified layout on mobile
- Edit/Delete buttons clearly visible
- Inline editing still works

### Dashboard
- Cards stack in single column
- All stats visible
- Touch-friendly

---

## 🚨 Important Notes

### Data Integrity
- ✅ All changes are logged in audit trail
- ✅ Can see who made what changes and when
- ✅ Real-time sync prevents conflicts
- ⚠️ Deletion is permanent - no undo

### Multi-Day Guests
- Create **separate records** for each day
- Use guest search to quickly register for additional days
- Each day tracks independently
- Reports can aggregate by guest name

### Day Field
- **Optional** - can leave blank
- Can update anytime via edit
- Useful for planning and reporting
- Shows "-" if not specified

---

## 🆘 Need Help?

### Common Issues

**Can't find guest in search?**
- Check spelling
- Try phone number instead
- Minimum 2 characters required

**Edit button not responding?**
- Refresh the page
- Check internet connection
- Try on detail page instead

**Accidental deletion?**
- Contact administrator immediately
- Check backups if available
- Re-register guest if needed

**Day stats don't match?**
- Some guests may have no day specified
- Refresh dashboard
- Check guest list filter settings

---

## ✅ Checklist: First Time Using New Features

- [ ] Try guest search with a returning guest
- [ ] Register a guest with day selection
- [ ] Edit a guest inline from the list
- [ ] View day statistics on dashboard
- [ ] Check edit history on guest detail page
- [ ] Practice the "Save & add another" workflow
- [ ] Understand notification system

---

## 🎓 Training Tip

**5-Minute Practice Session**:
1. Register a test guest for Day 1
2. Search and load that guest
3. Register them for Day 2
4. Go to guest list
5. Edit one of the records inline
6. Delete one test record
7. Check dashboard statistics

You're now ready to use all the new features! 🎉
