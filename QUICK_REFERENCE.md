# Quick Reference Card

## 🚀 Getting Started

```bash
npm install
npm run dev
# Open http://localhost:3000
```

---

## ✨ New Features at a Glance

### 1️⃣ Day Selection
**Where**: Registration form  
**How**: Click Day 1, 2, or 3 buttons  
**Why**: Track multi-day attendance

### 2️⃣ Guest Search
**Where**: Top of registration form  
**How**: Type name or phone → Click result  
**Why**: Quick re-registration for returning guests

### 3️⃣ Inline Edit
**Where**: Guest list table  
**How**: Click Edit → Modify → Save  
**Why**: Quick corrections without page navigation

### 4️⃣ Quick Delete
**Where**: Guest list table  
**How**: Click Delete → Confirm  
**Why**: Fast guest removal

---

## 📋 Common Tasks

### Register New Guest
```
1. Go to Register page
2. Fill in details
3. Select day (optional)
4. Click "Save & view"
```

### Register Returning Guest
```
1. Go to Register page
2. Search guest's name in top box
3. Click their name from dropdown
4. Change day to new attendance
5. Click "Save & view"
```

### Edit Guest Info
```
Quick way:
1. Go to Guests list
2. Click Edit button
3. Make changes
4. Click Save

Full way:
1. Click guest name
2. Click Edit button
3. Make changes
4. Click Save
```

### Delete Guest
```
From list:
1. Go to Guests list
2. Click Delete button
3. Confirm

From detail:
1. Click guest name
2. Scroll to bottom
3. Click "Delete guest"
4. Confirm
```

### View Statistics
```
1. Go to Dashboard
2. View cards:
   - Total guests
   - Camping / Not camping
   - Day 1 / Day 2 / Day 3
```

---

## 🗂️ Data Storage

### Location
```
data/
├── guests.json       ← Your guest data
├── events.json       ← Event info
├── profiles.json     ← User accounts
├── session.json      ← Current session
└── guest-edits.json  ← Change history
```

### Backup
```bash
cp -r data data-backup
```

### Reset
```bash
rm -rf data
# App will recreate on next start
```

### Export
```
Visit: http://localhost:3000/api/storage/export
or
Click "⋯" menu → Export All Data (CSV)
```

---

## 🔍 Search & Filter

### Guest Search (Registration)
- Minimum: 2 characters
- Matches: First name, last name, phone
- Results: Up to 5 guests
- Case: Insensitive

### Guest List Filters
- All / Camping / Not camping
- Sort: Newest or By name
- Search bar: Searches all fields

---

## 📊 Dashboard

### Statistics Shown
```
Row 1:
┌──────────┐ ┌──────────┐ ┌──────────┐
│ Total    │ │ Camping  │ │ Not      │
│ Guests   │ │          │ │ Camping  │
└──────────┘ └──────────┘ └──────────┘

Row 2:
┌──────────┐ ┌──────────┐ ┌──────────┐
│ Day 1    │ │ Day 2    │ │ Day 3    │
│          │ │          │ │          │
└──────────┘ └──────────┘ └──────────┘
```

### Recent Items
- Last 5 registrations
- Last 8 edits across all users

---

## 💾 Data Fields

### Guest Record
```typescript
{
  first_name: string       // Required
  middle_name: string?     // Optional
  last_name: string        // Required
  origin: string           // Required (City, country)
  phone: string            // Required (with country code)
  status: "camping" | "not_camping"
  day: 1 | 2 | 3 | null    // Optional (Day of attendance)
}
```

### Validation Rules
- First name: 1-80 characters
- Last name: 1-80 characters
- Origin: 1-120 characters
- Phone: 4-40 characters
- Day: 1, 2, 3, or blank

---

## ⚠️ Important Notes

### Real-Time Sync
- ❌ Does NOT sync across browsers (JSON storage limitation)
- ✅ Will work when you migrate to Supabase
- ℹ️ Toast notifications show for local actions only

### Duplicate Detection
- Checks: Phone number (exact match)
- Checks: Name (first + last, case-insensitive)
- Warns: Shows orange banner
- Blocks: Prevents submission if duplicate found

### Concurrency
- ⚠️ Last write wins (no conflict resolution)
- ⚠️ Not suitable for multiple simultaneous users
- ✅ Fine for single user or sequential use

### Performance
- ✅ Fast for <500 guests
- ⚠️ May slow down with >500 guests
- 💡 Archive old events to maintain performance

---

## 🔧 Troubleshooting

### Problem: Search not working
**Solution**: Type at least 2 characters, check data/guests.json exists

### Problem: Changes not saving
**Solution**: Check browser console, verify data/ folder is writable

### Problem: Day stats wrong
**Solution**: Refresh dashboard, check guests have day field set

### Problem: Can't edit inline
**Solution**: Refresh page, try editing from detail page instead

### Problem: Deleted by accident
**Solution**: Restore from backup (data-backup/ folder)

---

## 📱 Keyboard Shortcuts

```
Tab          → Next field
Shift+Tab    → Previous field
Enter        → Submit (when on button)
Escape       → Cancel inline edit
```

---

## 🌍 International Support

### Phone Numbers
- ✅ All countries supported
- ✅ No default prefix
- ✅ Always include country code
- Examples:
  - +1 555-000-0000 (USA)
  - +255 123 456 789 (Tanzania)
  - +44 20 1234 5678 (UK)
  - +91 98765 43210 (India)

---

## 📈 Best Practices

### Registration
1. ✅ Use guest search for returning guests
2. ✅ Select day when known
3. ✅ Always include country code in phone
4. ✅ Use "Save & add another" for batch registration

### Data Management
1. ✅ Backup data/ folder regularly
2. ✅ Export CSV periodically
3. ✅ Review dashboard stats for insights
4. ✅ Use inline edit for quick fixes
5. ✅ Check for duplicates before saving

### Multi-Day Events
1. ✅ Register guest for Day 1
2. ✅ Search guest for Day 2/3 registration
3. ✅ Keep separate records per day
4. ✅ Use dashboard to track attendance per day

---

## 🔄 Migration to Supabase (Future)

### When to Migrate
- Need real-time sync
- Multiple concurrent users
- Large datasets (>500 guests)
- Production deployment

### How to Migrate
1. Export data: `/api/storage/export`
2. Create Supabase project
3. Run migrations from `/supabase/migrations/`
4. Import data
5. Update configuration
6. Deploy

**Full guide**: See `JSON_STORAGE_MODE.md`

---

## 📚 Documentation

### User Guides
- `QUICK_START_NEW_FEATURES.md` - Visual workflows
- `NEW_FEATURES_GUIDE.md` - Feature descriptions

### Technical Docs
- `JSON_STORAGE_MODE.md` - Storage details
- `DAY_TRACKING_FEATURES.md` - Day tracking specs
- `LATEST_UPDATES_SUMMARY.md` - Changes & migration

### Status Reports
- `FINAL_IMPLEMENTATION_STATUS.md` - Current status
- `COMPLETE_IMPLEMENTATION_REPORT.md` - Full report

---

## 🆘 Quick Help

| Issue | Solution |
|-------|----------|
| Can't login | Check data/profiles.json exists |
| No guests showing | Check event selected in header |
| Search returns nothing | Type more characters (min 2) |
| Edit button not working | Refresh page, check console |
| Duplicate not detected | Verify same event, case-insensitive |
| Stats not updating | Refresh dashboard |
| File error | Check data/ folder permissions |

---

## ✅ Feature Checklist

- [x] Register guests
- [x] Edit guests (inline & detail)
- [x] Delete guests
- [x] Search guests
- [x] Select day (1, 2, 3)
- [x] View statistics
- [x] Duplicate detection
- [x] Export CSV
- [x] Audit trail
- [x] International phones
- [ ] Real-time sync (needs Supabase)

---

## 🎯 Status

**Mode**: JSON Storage (File-based)  
**Status**: ✅ Fully Functional  
**Users**: Single user / Development  
**Performance**: Fast for <500 guests  
**Real-time**: ❌ (needs Supabase)

---

**Everything works! Start using the app now! 🚀**

For detailed help, see the full documentation files in the project root.
