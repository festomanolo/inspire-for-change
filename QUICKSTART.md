# Quick Start Guide

## 🚀 Get Started in 3 Steps

### 1. Install Dependencies
```bash
npm install
# or if you prefer bun
bun install
```

### 2. Start the Development Server
```bash
npm run dev
# or
bun run dev
```

The app will start at `http://localhost:3000` (or another port if 3000 is busy)

### 3. Create Your Account
1. Navigate to the auth page (you'll be redirected automatically)
2. Click **"Create an account"**
3. Fill in:
   - Display Name: Your name
   - Email: Any email (e.g., `admin@test.com`)
   - Password: Any password (e.g., `password123`)
4. Click **"Create account"**

✅ Done! Sample data will be automatically created.

## 📊 Using the App

### Register a Guest
1. Go to **"Register"** in the nav
2. Fill in guest details:
   - First Name, Last Name
   - Origin (where they're from)
   - Phone number
   - Status (Camping or Not camping)
3. Click **"Register guest"**

### View Guests
1. Go to **"Guests"** in the nav
2. Search, filter, and sort guests
3. Click on any guest to view/edit details

### Export Data

**Export Current Event:**
- On Guests page, click **"Download CSV"**

**Export All Data:**
1. Click the **"⋯"** menu (top right)
2. Select **"Export All Data (CSV)"**
3. You'll get 4 CSV files:
   - guests-[date].csv
   - events-[date].csv
   - profiles-[date].csv
   - guest-edits-[date].csv

### Create New Event Year
1. Click the event dropdown (shows current year)
2. Select **"+ New year"**
3. Enter the year
4. Click **"Create"**

## 📁 Data Storage

All data is stored in JSON files in the `data/` directory:
- `data/session.json` - Your login session
- `data/profiles.json` - User accounts
- `data/events.json` - Event years
- `data/guests.json` - Guest registrations
- `data/guest-edits.json` - Edit history

### Reset All Data
To start fresh, simply delete the `data/` directory:
```bash
rm -rf data/
```

Then restart the server and create a new account.

## 🔄 Switch to Supabase

To use a real database instead of JSON files:

1. Open `src/integrations/supabase/client.ts`
2. Change line 5:
   ```typescript
   const USE_JSON_STORAGE = false; // Change to false
   ```
3. Create a `.env` file with your Supabase credentials:
   ```
   VITE_SUPABASE_URL=your-project-url
   VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
   ```
4. Restart the dev server

## ⚠️ Important Notes

- This JSON storage is **for testing only**
- No password security (any password works)
- Not suitable for production
- Data persists between restarts
- The `data/` folder is gitignored

## 🆘 Troubleshooting

**Can't sign in?**
- Make sure you created an account first
- Any password works, it's not validated

**No data showing?**
- Create a new account - sample data is auto-created on first signup

**Port already in use?**
- The dev server will use an available port
- Check the terminal output for the actual URL

**Want to start over?**
- Delete the `data/` folder
- Restart the server
- Create a new account

## 📚 More Information

See `JSON_STORAGE_README.md` for detailed technical information about the storage system.
