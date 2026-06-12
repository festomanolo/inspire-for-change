# JSON Storage Mode

## Overview

The application currently runs in **JSON Storage Mode**, using local JSON files for data persistence instead of Supabase. This is perfect for development, testing, or small-scale deployments without requiring a database server.

---

## How It Works

### Data Storage
All data is stored in JSON files located in the `/data` directory:

```
data/
├── session.json        # Current user session
├── profiles.json       # User profiles
├── events.json         # Events
├── guests.json         # Guest registrations
└── guest-edits.json    # Audit trail
```

### API Layer
- **Client-side**: Uses `jsonSupabase` from `/src/lib/json-storage.ts`
- **Server-side**: API routes handle CRUD operations via `/src/routes/api.storage.$.ts`
- **Storage**: File operations in `/src/lib/storage-api.ts`

---

## Current Features (JSON Mode)

### ✅ Fully Working Features

1. **Authentication**
   - User signup
   - User login
   - Session management
   - Profile creation

2. **Guest Management**
   - Create guests with all fields (including day)
   - Read/list guests
   - Update guests (inline and detail page)
   - Delete guests
   - Search guests by name or phone
   - Duplicate detection

3. **Event Management**
   - List events
   - Create events
   - Event selection

4. **Audit Trail**
   - Track all guest changes
   - View edit history
   - Log who made changes

5. **Dashboard**
   - Statistics (total, camping, days)
   - Recent registrations
   - Recent edits

### ⚠️ Known Limitations (JSON Mode)

1. **No Real-Time Sync**
   - Changes don't automatically update in other browser windows
   - Real-time subscriptions are no-op (MockChannel)
   - Toast notifications still work but only for local actions

2. **No Complex Queries**
   - `.or()` method not supported (use client-side filtering instead)
   - `.ilike` not supported (use `.toLowerCase().includes()`)
   - Limited sorting options (client-side sorting works)

3. **Concurrency**
   - No optimistic locking for concurrent edits
   - Last write wins (file overwrites previous data)
   - Not suitable for multiple simultaneous users

4. **Performance**
   - Loads entire tables into memory
   - Client-side filtering for complex queries
   - Not suitable for large datasets (>1000 guests)

5. **Search Functionality**
   - Guest search loads all guests then filters client-side
   - Works fine for small datasets
   - May be slow with 1000+ guests

---

## Code Differences

### Before (Supabase with .or())
```typescript
const { data } = await supabase
  .from("guests")
  .select("*")
  .eq("event_id", selected.id)
  .or(`phone.eq.${phone},and(first_name.ilike.${name})`);
```

### After (JSON Storage)
```typescript
// Get all guests for the event
const { data } = await supabase
  .from("guests")
  .select("*")
  .eq("event_id", selected.id);

// Filter client-side
const filtered = data?.filter(g => 
  g.phone === phone || 
  (g.first_name.toLowerCase() === name.toLowerCase())
);
```

---

## Migration to Supabase (Future)

When you're ready to switch to Supabase, here's the plan:

### Step 1: Export Current Data
```bash
# Access the export endpoint
curl http://localhost:3000/api/storage/export > backup.json
```

### Step 2: Set Up Supabase
1. Create a Supabase project
2. Run migrations from `/supabase/migrations/`
3. Import data using SQL or Supabase dashboard

### Step 3: Update Configuration
```typescript
// In src/integrations/supabase/client.ts
// Switch from jsonSupabase to actual supabase client

import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)
```

### Step 4: Update Code
The following files use JSON storage-specific patterns that need updating:

1. **src/routes/_authenticated/register.tsx**
   - Lines with client-side filtering
   - Replace with proper `.or()` queries

2. **src/routes/_authenticated/guests.tsx**
   - Real-time subscription (currently MockChannel)
   - Will automatically work with Supabase

3. **src/routes/_authenticated/index.tsx**
   - Real-time subscription (currently MockChannel)
   - Will automatically work with Supabase

### Step 5: Enable Real-Time
```typescript
// Real-time will automatically work in Supabase
const channel = supabase
  .channel("guests-" + selected.id)
  .on("postgres_changes", { 
    event: "INSERT", 
    schema: "public", 
    table: "guests" 
  }, (payload) => {
    // Handle real-time update
    toast.success(`New guest registered`);
  })
  .subscribe();
```

---

## Development Workflow

### Starting the App
```bash
npm run dev
# or
npm run start
```

### Viewing Data
Data files are in human-readable JSON format:
```bash
cat data/guests.json
cat data/events.json
cat data/profiles.json
```

### Resetting Data
```bash
# Backup first (optional)
cp -r data data-backup

# Clear data
rm data/*.json

# App will recreate files on next run
```

### Exporting Data
Access the export endpoint:
```
http://localhost:3000/api/storage/export
```

Returns all data in a single JSON object with timestamp.

---

## File Structure

### session.json
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "created_at": "ISO timestamp"
  },
  "access_token": "token_uuid",
  "expires_at": 1234567890
}
```

### profiles.json
```json
[
  {
    "id": "uuid",
    "email": "user@example.com",
    "display_name": "User Name",
    "created_at": "ISO timestamp"
  }
]
```

### events.json
```json
[
  {
    "id": "uuid",
    "year": 2026,
    "name": "Annual Gathering",
    "created_at": "ISO timestamp"
  }
]
```

### guests.json
```json
[
  {
    "id": "uuid",
    "event_id": "uuid",
    "first_name": "John",
    "middle_name": null,
    "last_name": "Doe",
    "origin": "Nairobi",
    "phone": "+254 123 456 789",
    "status": "camping",
    "day": 1,
    "created_by": "uuid",
    "updated_by": "uuid",
    "created_at": "ISO timestamp",
    "updated_at": "ISO timestamp"
  }
]
```

### guest-edits.json
```json
[
  {
    "id": "uuid",
    "guest_id": "uuid",
    "edited_by": "uuid",
    "edited_at": "ISO timestamp",
    "action": "create",
    "changes": {}
  }
]
```

---

## Testing Guide

### Testing New Features

1. **Day Selection**
   ```
   1. Register guest with Day 1 selected
   2. Check data/guests.json - should have "day": 1
   3. View dashboard - Day 1 count should show 1
   ```

2. **Guest Search**
   ```
   1. Register a guest (e.g., John Doe, +254 123 456)
   2. Go to register page
   3. Search "John" in guest search box
   4. Should show dropdown with John Doe
   5. Click result - form should auto-fill
   ```

3. **Inline Edit**
   ```
   1. Go to guest list
   2. Click Edit on any guest
   3. Change phone number
   4. Click Save
   5. Check data/guests.json - should be updated
   ```

4. **Delete Guest**
   ```
   1. Go to guest list
   2. Click Delete on any guest
   3. Confirm deletion
   4. Check data/guests.json - guest should be removed
   ```

5. **Duplicate Detection**
   ```
   1. Register guest with phone +254 123 456
   2. Try registering another guest with same phone
   3. Should show warning message
   4. Should prevent submission
   ```

---

## Troubleshooting

### Issue: Changes not saving
**Solution**: Check browser console for errors. Verify data files exist and are writable.

### Issue: Guest search not working
**Solution**: 
1. Check if guests exist in data/guests.json
2. Search requires minimum 2 characters
3. Check browser console for errors

### Issue: Duplicate detection not working
**Solution**:
1. Verify guests are in the same event
2. Check browser console for filtering errors
3. Clear browser cache and reload

### Issue: Data files corrupted
**Solution**:
```bash
# Reset data files
rm data/*.json

# Or restore from backup
cp data-backup/*.json data/
```

### Issue: Session expired
**Solution**:
```bash
# Clear session
rm data/session.json

# Login again
```

---

## Performance Considerations

### Recommended Limits
- **Events**: Up to 10 events
- **Guests**: Up to 500 guests per event
- **Users**: Up to 10 concurrent users
- **Edits**: Unlimited (pruning recommended)

### Optimization Tips
1. **Limit guest search results**: Already limited to 5
2. **Paginate guest list**: Consider adding pagination for >100 guests
3. **Archive old events**: Move old event data to backup files
4. **Prune edit history**: Keep last 100 edits per guest

---

## Backup Strategy

### Manual Backup
```bash
# Create timestamped backup
mkdir -p backups
cp -r data "backups/data-$(date +%Y%m%d-%H%M%S)"
```

### Automated Backup (Optional)
```bash
# Add to cron (Linux/Mac)
0 * * * * cp -r /path/to/data /path/to/backups/data-$(date +\%Y\%m\%d-\%H\%M\%S)
```

### Backup Before Updates
Always backup before:
- Updating code
- Making bulk changes
- Testing new features
- Migrating to Supabase

---

## Advantages of JSON Storage

### Pros ✅
1. **No database setup required**
2. **Easy to inspect and debug** (human-readable)
3. **Simple backup/restore** (just copy files)
4. **No external dependencies**
5. **Perfect for development and testing**
6. **Works offline**
7. **Fast for small datasets**
8. **Free (no database hosting costs)**

### Cons ⚠️
1. **No real-time sync**
2. **Not suitable for large datasets**
3. **No concurrent user support**
4. **Manual backup required**
5. **No advanced querying**
6. **File system limitations**

---

## When to Switch to Supabase

Consider switching when you need:
- Real-time collaboration (multiple users)
- Large datasets (>500 guests)
- Advanced queries and filtering
- Automatic backups
- Better concurrency handling
- Production-grade reliability
- Row-level security

---

## Support & Documentation

### JSON Storage Files
- **Implementation**: `/src/lib/json-storage.ts`
- **Server API**: `/src/lib/storage-api.ts`
- **API Routes**: `/src/routes/api.storage.$.ts`

### Migration Documentation
- **Supabase Migrations**: `/supabase/migrations/`
- **Schema Documentation**: Check migration SQL files

### Additional Resources
- JSON Storage API: See code comments in `json-storage.ts`
- Guest Types: `/src/lib/types.ts`
- Database Types: `/src/integrations/supabase/types.ts`

---

## Summary

**Current Mode**: JSON Storage (File-based)
**Status**: ✅ Fully functional for single-user development
**Limitations**: No real-time sync, limited concurrency
**Future**: Ready to migrate to Supabase when needed

All core features work perfectly in JSON mode, including the new day tracking, guest search, and inline editing. The only missing feature is real-time sync across multiple browsers/users, which will automatically work once you switch to Supabase.

**You can safely use the app in JSON mode for development and small-scale deployments!** 🎉
