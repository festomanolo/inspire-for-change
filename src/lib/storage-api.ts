// Server-side JSON storage API
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Profile, Guest, EventRow, GuestEdit } from "./types";

// Get the data directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "../../data");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// File paths
const FILES = {
  session: path.join(DATA_DIR, "session.json"),
  profiles: path.join(DATA_DIR, "profiles.json"),
  events: path.join(DATA_DIR, "events.json"),
  guests: path.join(DATA_DIR, "guests.json"),
  guest_edits: path.join(DATA_DIR, "guest-edits.json"),
};

// Helper to read JSON file
function readJson<T>(filePath: string, defaultValue: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
  }
  return defaultValue;
}

// Helper to write JSON file
function writeJson<T>(filePath: string, data: T): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error(`Error writing ${filePath}:`, error);
    throw error;
  }
}

// Initialize sample data
function initializeSampleData() {
  const events = readJson<EventRow[]>(FILES.events, []);
  if (events.length === 0) {
    const sampleEvent: EventRow = {
      id: crypto.randomUUID(),
      year: new Date().getFullYear(),
      name: "Annual Gathering",
      created_at: new Date().toISOString(),
    };
    writeJson(FILES.events, [sampleEvent]);
  }
}

// Auth API handlers
export const authHandlers = {
  getSession: () => {
    return readJson<any>(FILES.session, null);
  },

  signUp: (params: { email: string; password: string; options?: { data?: { display_name?: string } } }) => {
    const { email, options } = params;
    const profiles = readJson<Profile[]>(FILES.profiles, []);

    // Check if user already exists
    if (profiles.find((p) => p.email === email)) {
      throw new Error("User already exists");
    }

    const userId = crypto.randomUUID();
    const user = {
      id: userId,
      email,
      created_at: new Date().toISOString(),
    };

    const session = {
      user,
      access_token: `token_${userId}`,
      expires_at: Date.now() + 3600000,
    };

    // Save session
    writeJson(FILES.session, session);

    // Save profile
    const profile: Profile = {
      id: userId,
      email,
      display_name: options?.data?.display_name || email.split("@")[0],
      created_at: new Date().toISOString(),
    };
    profiles.push(profile);
    writeJson(FILES.profiles, profiles);

    initializeSampleData();
    return { user, session };
  },

  signIn: (params: { email: string; password: string }) => {
    const { email } = params;
    const profiles = readJson<Profile[]>(FILES.profiles, []);
    const profile = profiles.find((p) => p.email === email);

    if (!profile) {
      throw new Error("Invalid login credentials");
    }

    const user = {
      id: profile.id,
      email: profile.email,
      created_at: profile.created_at || new Date().toISOString(),
    };

    const session = {
      user,
      access_token: `token_${profile.id}`,
      expires_at: Date.now() + 3600000,
    };

    writeJson(FILES.session, session);
    initializeSampleData();
    return { user, session };
  },

  signOut: () => {
    if (fs.existsSync(FILES.session)) {
      fs.unlinkSync(FILES.session);
    }
  },
};

// Database API handlers
export const dbHandlers = {
  profiles: {
    getAll: () => {
      return readJson<Profile[]>(FILES.profiles, []);
    },

    getByField: (field: string, value: string) => {
      const profiles = readJson<Profile[]>(FILES.profiles, []);
      return profiles.find((p) => (p as any)[field] === value) || null;
    },
  },

  events: {
    getAll: (orderBy: string, ascending: boolean) => {
      const events = readJson<EventRow[]>(FILES.events, []);
      return events.sort((a, b) => {
        const aVal = (a as any)[orderBy] ?? "";
        const bVal = (b as any)[orderBy] ?? "";
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return ascending ? cmp : -cmp;
      });
    },

    create: (row: Omit<EventRow, "id" | "created_at">) => {
      const events = readJson<EventRow[]>(FILES.events, []);
      const newEvent: EventRow = {
        id: crypto.randomUUID(),
        ...row,
        created_at: new Date().toISOString(),
      };
      events.push(newEvent);
      writeJson(FILES.events, events);
      return newEvent;
    },
  },

  guests: {
    getAll: () => {
      return readJson<Guest[]>(FILES.guests, []);
    },

    getByField: (field: string, value: string, orderBy?: string, ascending?: boolean) => {
      const guests = readJson<Guest[]>(FILES.guests, []);
      let filtered = guests.filter((g) => (g as any)[field] === value);

      if (orderBy) {
        filtered = filtered.sort((a, b) => {
          const aVal = (a as any)[orderBy] ?? "";
          const bVal = (b as any)[orderBy] ?? "";
          const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
          return ascending ? cmp : -cmp;
        });
      }

      return filtered;
    },

    getById: (id: string) => {
      const guests = readJson<Guest[]>(FILES.guests, []);
      const guest = guests.find((g) => g.id === id);
      if (!guest) throw new Error("Guest not found");
      return guest;
    },

    create: (row: Omit<Guest, "id" | "created_at" | "updated_at">) => {
      const guests = readJson<Guest[]>(FILES.guests, []);
      const newGuest: Guest = {
        id: crypto.randomUUID(),
        ...row,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      guests.push(newGuest);
      writeJson(FILES.guests, guests);
      return newGuest;
    },

    update: (id: string, updates: Partial<Guest>) => {
      const guests = readJson<Guest[]>(FILES.guests, []);
      const index = guests.findIndex((g) => g.id === id);
      if (index === -1) throw new Error("Guest not found");

      guests[index] = {
        ...guests[index],
        ...updates,
        updated_at: new Date().toISOString(),
      };
      writeJson(FILES.guests, guests);
      return guests[index];
    },

    delete: (id: string) => {
      const guests = readJson<Guest[]>(FILES.guests, []);
      const filtered = guests.filter((g) => g.id !== id);
      writeJson(FILES.guests, filtered);
    },
  },

  guestEdits: {
    getAll: (orderBy: string, ascending: boolean) => {
      const edits = readJson<GuestEdit[]>(FILES.guest_edits, []);
      return edits.sort((a, b) => {
        const aVal = (a as any)[orderBy] ?? "";
        const bVal = (b as any)[orderBy] ?? "";
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return ascending ? cmp : -cmp;
      });
    },

    getByField: (field: string, value: string, orderBy: string, ascending: boolean) => {
      const edits = readJson<GuestEdit[]>(FILES.guest_edits, []);
      let filtered = edits.filter((e) => (e as any)[field] === value);

      filtered = filtered.sort((a, b) => {
        const aVal = (a as any)[orderBy] ?? "";
        const bVal = (b as any)[orderBy] ?? "";
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return ascending ? cmp : -cmp;
      });

      return filtered;
    },

    create: (row: Omit<GuestEdit, "id" | "edited_at">) => {
      const edits = readJson<GuestEdit[]>(FILES.guest_edits, []);
      const newEdit: GuestEdit = {
        id: crypto.randomUUID(),
        ...row,
        edited_at: new Date().toISOString(),
      };
      edits.push(newEdit);
      writeJson(FILES.guest_edits, edits);
      return newEdit;
    },
  },
};

// Export all data function
export function exportAllData() {
  return {
    profiles: readJson<Profile[]>(FILES.profiles, []),
    events: readJson<EventRow[]>(FILES.events, []),
    guests: readJson<Guest[]>(FILES.guests, []),
    guest_edits: readJson<GuestEdit[]>(FILES.guest_edits, []),
    exported_at: new Date().toISOString(),
  };
}
