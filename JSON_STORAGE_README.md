# JSON File Storage Setup

This application is configured to use **JSON file storage** instead of Supabase for testing purposes.

## How It Works

1. **Storage Location**: All data is stored in the `data/` directory as JSON files:
   - `data/session.json` - Current user session
   - `data/profiles.json` - User profiles
   - `data/events.json` - Event years
   - `data/guests.json` - Guest registrations
   - `data/guest-edits.json` - Edit history

2. **API Routes**: The app uses API routes at `/api/storage/*` to handle CRUD operations

3. **Auto-initialization**: When you create your first user, sample data is automatically created

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   # or
   bun install
   ```

2. **Start the development server**:
   ```bash
   npm run dev
   # or
   bun run dev
   ```

3. **Create your first account**:
   - Navigate to the auth page
   - Click "Create an account"
   - Enter your details and sign up
   - Sample event data will be automatically created

## Features

### CSV Export

The application includes comprehensive CSV export functionality:

1. **Export Current Event Guests**:
   - Go to the "Guests" page
   - Click "Download CSV" to export guests for the selected event
   - Includes all guest details with creator/updater information

2. **Export All Data**:
   - Click the "⋯" menu in the header
   - Select "Export All Data (CSV)"
   - Downloads 4 separate CSV files:
     - `guests-[date].csv` - All guest registrations
     - `events-[date].csv` - All events
     - `profiles-[date].csv` - All user profiles
     - `guest-edits-[date].csv` - All edit history

### Data Persistence

- Data persists between server restarts (stored in JSON files)
- The `data/` directory is gitignored to prevent accidental commits
- To reset all data, simply delete the `data/` directory

## Switching Back to Supabase

To switch back to Supabase:

1. Open `src/integrations/supabase/client.ts`
2. Change `const USE_JSON_STORAGE = true;` to `const USE_JSON_STORAGE = false;`
3. Set up your Supabase environment variables in `.env`:
   ```
   VITE_SUPABASE_URL=your-project-url
   VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
   ```

## Notes

- This JSON storage implementation is for **testing only**
- No password validation (any password works)
- No encryption or security features
- Not suitable for production use
- For production, use Supabase or another proper database
