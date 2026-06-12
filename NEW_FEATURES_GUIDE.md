# New Features Guide

## For Registrars Using the System

### 1. Dashboard Improvements
- **What's New**: The "Camping" statistic is now clearly visible with blue text on a light blue background
- **Where**: Main dashboard page (home page after login)

### 2. Duplicate Detection 🆕
When registering a new guest, the system will automatically warn you if:
- A guest with the same phone number already exists
- A guest with the same name (first + last) already exists

**How it works**:
1. Start typing the guest's name or phone number
2. After a brief pause, the system checks for duplicates
3. If found, you'll see an orange warning banner: "⚠️ A guest with phone number X is already registered"
4. You can review the information to confirm it's not a duplicate
5. If you try to save anyway, the system will prevent it and show an error

**Benefits**:
- Prevents accidental double registrations
- Catches typos in existing guest records
- Maintains data integrity

### 3. Real-Time Notifications 🆕
When multiple registrars are using the system simultaneously, you'll see instant notifications:

**Notification Types**:
- 🟢 **Green notification**: "New guest registered: [Name]" - Someone just added a new guest
- 🔵 **Blue notification**: "Guest updated: [Name]" - Someone modified guest information
- 🟠 **Orange notification**: "Guest removed: [Name]" - Someone deleted a guest
- 💡 **Info notification**: "This guest was just updated by another registrar" - On guest detail page

**Where you'll see them**:
- Dashboard - notifications for new registrations
- Guest list page - notifications for all changes
- Guest detail page - notifications when viewing a guest that someone else is editing

**Benefits**:
- Know immediately when changes happen
- Avoid editing conflicts
- Stay coordinated with your team

### 4. International Phone Number Support 🆕
- **No more country code restrictions**: Enter phone numbers from any country
- **Examples**: +1 (USA), +44 (UK), +255 (Tanzania), +91 (India), +86 (China), etc.
- **Flexible format**: The system accepts any format as long as it includes the country code

**How to use**:
- Always include the country code (e.g., +255 for Tanzania)
- Format doesn't matter: "+1 555-000-0000", "+1 (555) 000-0000", or "+15550000000" all work
- The placeholder shows examples: "e.g., +1 555 000 0000 or +255 123 456 789"

### 5. Full Edit Capabilities ✅
You can now fully manage guest records:

**On the Guest Detail Page**:
1. Click "Edit" button
2. Modify any field (name, origin, phone, status)
3. Click "Save" to update
4. All changes are tracked in the edit history below

**Quick Status Toggle**:
- Click the status badge at the top to quickly switch between "Camping" and "Not camping"

**Delete Guest**:
- Use the "Delete guest" link at the bottom
- Confirmation required to prevent accidents

---

## For Administrators

### Database Features

**Audit Trail**:
- Every change is logged in the `guest_edits` table
- Tracks: who, when, what changed
- View complete history on each guest's detail page

**Real-Time Sync**:
- Uses Supabase real-time subscriptions
- Changes propagate instantly to all connected clients
- No polling required - efficient and instant

**Data Integrity**:
- Duplicate detection prevents data corruption
- Optimistic locking prevents concurrent edit conflicts (using `updated_at` field)
- Row-level security ensures only authenticated users can access data

**Performance**:
- Indexed queries on `event_id`, `status`, and `created_at`
- Efficient Supabase channels per event
- Minimal database load

### Technical Details

**Real-Time Channels**:
```
dashboard-{eventId}  - For dashboard updates
guests-{eventId}     - For guest list updates
guest-{guestId}      - For individual guest updates
```

**Duplicate Check Logic**:
- Checks phone number (exact match)
- Checks name combination (case-insensitive)
- Scoped to current event only
- Debounced to avoid excessive queries (500ms)

**Notification System**:
- Uses Sonner toast library
- Non-intrusive, auto-dismissing
- Different colors for different actions
- Accessible and mobile-friendly

---

## Troubleshooting

**Q: I don't see notifications when others make changes**
- Check your internet connection
- Refresh the page to re-establish the real-time connection
- Ensure you're both working on the same event

**Q: Duplicate warning appears but I know it's a different person**
- Double-check the phone number - it might be correct but already registered
- Check the spelling of the name
- If truly different, contact an administrator to check the database

**Q: Changes aren't saving**
- Check for error messages at the top of the form
- Ensure all required fields are filled
- If another registrar just updated the same guest, refresh and try again

**Q: Can't edit a guest record**
- Make sure you're logged in
- Check that you have the necessary permissions
- If the edit button is missing, refresh the page

---

## Best Practices

1. **Always include country codes** in phone numbers
2. **Check for duplicates** before saving - the system will warn you
3. **Review notifications** to stay aware of team changes
4. **Use edit history** to see who made what changes and when
5. **Communicate with your team** when making bulk changes

---

## Support

If you encounter any issues or have questions:
1. Check this guide first
2. Review the IMPLEMENTATION_SUMMARY.md for technical details
3. Contact your system administrator
