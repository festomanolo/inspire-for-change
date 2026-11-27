// Server-side JSON storage API for Church Events Management System
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  suggestAccommodationZone,
  type Profile,
  type Guest,
  type EventRow,
  type GuestEdit,
} from "./types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "../../data");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const FILES = {
  session: path.join(DATA_DIR, "session.json"),
  profiles: path.join(DATA_DIR, "profiles.json"),
  events: path.join(DATA_DIR, "events.json"),
  guests: path.join(DATA_DIR, "guests.json"),
  guest_edits: path.join(DATA_DIR, "guest-edits.json"),
};

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

function writeJson<T>(filePath: string, data: T): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error(`Error writing ${filePath}:`, error);
    throw error;
  }
}

function buildEventCode(name: string, year: number): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 4);
  const prefix = initials.length >= 2 ? initials : "IFC";
  return `${prefix}-${String(year).slice(-2)}`;
}

function normalizeEvent(raw: Partial<EventRow> & { id: string; year: number; name: string; created_at: string }): EventRow {
  return {
    id: raw.id,
    code: raw.code || buildEventCode(raw.name, raw.year),
    year: raw.year,
    name: raw.name,
    category: raw.category || "conference",
    subtitle: raw.subtitle ?? "Inspired for Change Fellowship Gathering",
    venue: raw.venue ?? "Main Sanctuary & Campgrounds",
    start_date: raw.start_date ?? null,
    end_date: raw.end_date ?? null,
    total_days: typeof raw.total_days === "number" && raw.total_days >= 1 ? raw.total_days : 3,
    capacity: typeof raw.capacity === "number" ? raw.capacity : 500,
    camping_enabled: raw.camping_enabled !== false,
    status: raw.status || "active",
    created_at: raw.created_at,
  };
}

function generateRegCode(eventCode: string, sequenceNumber: number): string {
  const cleanPrefix = (eventCode || "IFC-26").toUpperCase().replace(/[^A-Z0-9-]/g, "");
  return `${cleanPrefix}-${String(sequenceNumber).padStart(4, "0")}`;
}

function normalizeGuest(
  raw: Partial<Guest> & { id: string; event_id: string; first_name: string; last_name: string },
  fallbackIndex: number,
  eventCodeMap: Record<string, string>,
): Guest {
  const days = Array.isArray(raw.days_registered) && raw.days_registered.length > 0
    ? Array.from(new Set(raw.days_registered.filter((d) => typeof d === "number" && d >= 1))).sort((a, b) => a - b)
    : typeof raw.day === "number" && raw.day >= 1
      ? [raw.day]
      : [1];

  const gender = raw.gender === "male" || raw.gender === "female" ? raw.gender : "unspecified";
  const status = raw.status === "camping" ? "camping" : "not_camping";
  const ageGroup = raw.age_group || "adult";
  const evCode = eventCodeMap[raw.event_id] || "IFC-26";

  return {
    id: raw.id || crypto.randomUUID(),
    reg_code: raw.reg_code || generateRegCode(evCode, fallbackIndex + 1),
    event_id: raw.event_id,
    household_id: raw.household_id ?? null,
    first_name: (raw.first_name ?? "").trim(),
    middle_name: raw.middle_name ? raw.middle_name.trim() : null,
    last_name: (raw.last_name ?? "").trim(),
    gender,
    age_group: ageGroup,
    origin: (raw.origin ?? "").trim(),
    church_name: raw.church_name ? raw.church_name.trim() : null,
    ministry_role: raw.ministry_role || "member",
    phone: (raw.phone ?? "").trim(),
    is_shared_phone: Boolean(raw.is_shared_phone),
    guardian_name: raw.guardian_name ? raw.guardian_name.trim() : null,
    email: raw.email ? raw.email.trim() : null,
    status,
    accommodation_zone:
      raw.accommodation_zone !== undefined
        ? raw.accommodation_zone
        : suggestAccommodationZone(gender, status, ageGroup),
    dietary_medical: raw.dietary_medical ? raw.dietary_medical.trim() : null,
    day: days[0] ?? null,
    days_registered: days,
    check_ins: raw.check_ins && typeof raw.check_ins === "object" ? raw.check_ins : {},
    created_by: raw.created_by ?? null,
    updated_by: raw.updated_by ?? null,
    created_at: raw.created_at || new Date().toISOString(),
    updated_at: raw.updated_at || new Date().toISOString(),
  };
}

function loadNormalizedEvents(): EventRow[] {
  const rawEvents = readJson<any[]>(FILES.events, []);
  let mutated = false;
  const normalized = rawEvents.map((ev) => {
    const n = normalizeEvent(ev);
    if (!ev.code || !ev.category || !ev.total_days) mutated = true;
    return n;
  });
  if (mutated) {
    writeJson(FILES.events, normalized);
  }
  return normalized;
}

function loadNormalizedGuests(): Guest[] {
  const events = loadNormalizedEvents();
  const eventCodeMap: Record<string, string> = {};
  events.forEach((e) => {
    eventCodeMap[e.id] = e.code;
  });

  const rawGuests = readJson<any[]>(FILES.guests, []);
  let mutated = false;
  const perEventCounter: Record<string, number> = {};

  const normalized = rawGuests.map((g) => {
    const count = perEventCounter[g.event_id] ?? 0;
    perEventCounter[g.event_id] = count + 1;
    const n = normalizeGuest(g, count, eventCodeMap);
    if (!g.reg_code || !Array.isArray(g.days_registered) || !g.gender) {
      mutated = true;
    }
    return n;
  });

  if (mutated) {
    writeJson(FILES.guests, normalized);
  }
  return normalized;
}

function appendAuditLog(entry: Omit<GuestEdit, "id" | "edited_at">) {
  const edits = readJson<GuestEdit[]>(FILES.guest_edits, []);
  const newEdit: GuestEdit = {
    id: crypto.randomUUID(),
    ...entry,
    edited_at: new Date().toISOString(),
  };
  edits.push(newEdit);
  writeJson(FILES.guest_edits, edits);
  return newEdit;
}

function initializeSampleData() {
  const events = loadNormalizedEvents();
  if (events.length === 0) {
    const year = new Date().getFullYear();
    const sampleEvent: EventRow = normalizeEvent({
      id: crypto.randomUUID(),
      code: `IFC-${String(year).slice(-2)}`,
      year,
      name: "Annual Gathering",
      category: "conference",
      subtitle: "Inspired for Change — Sanctuary Convocation",
      venue: "Main Sanctuary & Campgrounds",
      total_days: 3,
      capacity: 500,
      camping_enabled: true,
      status: "active",
      created_at: new Date().toISOString(),
    });
    writeJson(FILES.events, [sampleEvent]);
  }
}

export const authHandlers = {
  getSession: () => {
    const session = readJson<any>(FILES.session, null);
    if (session && session.expires_at && session.expires_at < Date.now()) {
      // Auto-renew local session token so active registrars aren't abruptly dropped mid-service
      const renewed = { ...session, expires_at: Date.now() + 86400000 * 7 };
      writeJson(FILES.session, renewed);
      return renewed;
    }
    return session;
  },

  signUp: (params: { email: string; password: string; options?: { data?: { display_name?: string } } }) => {
    const { email, options } = params;
    const profiles = readJson<Profile[]>(FILES.profiles, []);

    if (profiles.find((p) => p.email.toLowerCase() === email.toLowerCase())) {
      throw new Error("An account with this email already exists.");
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
      expires_at: Date.now() + 86400000 * 7,
    };

    writeJson(FILES.session, session);

    const profile: Profile = {
      id: userId,
      email,
      display_name: options?.data?.display_name || email.split("@")[0],
      role: profiles.length === 0 ? "admin" : "registrar",
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
