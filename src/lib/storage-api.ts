// Server-side JSON storage API for Church Events Management System
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  buildSuggestedEventCode,
  suggestAccommodationZone,
  type Profile,
  type Guest,
  type EventRow,
  type GuestEdit,
} from "./types.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cwdDataDir = path.resolve(process.cwd(), "data");
const DATA_DIR = fs.existsSync(cwdDataDir) ? cwdDataDir : path.resolve(__dirname, "../../data");

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
  return buildSuggestedEventCode(name, year);
}

function normalizeEvent(
  raw: Partial<EventRow> & { id: string; year: number; name: string; created_at: string },
): EventRow {
  return {
    id: raw.id,
    code: raw.code?.trim() || buildEventCode(raw.name, raw.year),
    year: raw.year,
    name: raw.name,
    organizer: raw.organizer !== undefined ? (raw.organizer ? raw.organizer.trim() : null) : null,
    category: raw.category || "conference",
    subtitle: raw.subtitle !== undefined ? (raw.subtitle ? raw.subtitle.trim() : null) : null,
    venue: raw.venue !== undefined ? (raw.venue ? raw.venue.trim() : null) : "Main Venue & Grounds",
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
  const cleanPrefix = (eventCode || "EVT-26").toUpperCase().replace(/[^A-Z0-9-]/g, "");
  return `${cleanPrefix}-${String(sequenceNumber).padStart(4, "0")}`;
}

function normalizeGuest(
  raw: Partial<Guest> & { id: string; event_id: string; first_name: string; last_name: string },
  fallbackIndex: number,
  eventCodeMap: Record<string, string>,
): Guest {
  const days =
    Array.isArray(raw.days_registered) && raw.days_registered.length > 0
      ? Array.from(
          new Set(raw.days_registered.filter((d) => typeof d === "number" && d >= 1)),
        ).sort((a, b) => a - b)
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

  signUp: (params: {
    email: string;
    password: string;
    options?: { data?: { display_name?: string } };
  }) => {
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
    const profile = profiles.find((p) => p.email.toLowerCase() === email.toLowerCase());

    if (!profile) {
      throw new Error("Invalid email or password. Create a staff account if you are new.");
    }

    const user = {
      id: profile.id,
      email: profile.email,
      created_at: profile.created_at || new Date().toISOString(),
    };

    const session = {
      user,
      access_token: `token_${profile.id}`,
      expires_at: Date.now() + 86400000 * 7,
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

const TRACKED_GUEST_FIELDS: (keyof Guest)[] = [
  "first_name",
  "middle_name",
  "last_name",
  "gender",
  "age_group",
  "origin",
  "church_name",
  "ministry_role",
  "phone",
  "is_shared_phone",
  "guardian_name",
  "status",
  "accommodation_zone",
  "dietary_medical",
  "days_registered",
];

export const dbHandlers = {
  profiles: {
    getAll: () => readJson<Profile[]>(FILES.profiles, []),

    getByField: (field: string, value: string) => {
      const profiles = readJson<Profile[]>(FILES.profiles, []);
      return profiles.find((p) => (p as any)[field] === value) || null;
    },

    update: (id: string, updates: Partial<Profile>) => {
      const profiles = readJson<Profile[]>(FILES.profiles, []);
      const idx = profiles.findIndex((p) => p.id === id);
      if (idx === -1) throw new Error("Profile not found");
      profiles[idx] = { ...profiles[idx], ...updates };
      writeJson(FILES.profiles, profiles);
      return profiles[idx];
    },
  },

  events: {
    getAll: (orderBy: string, ascending: boolean) => {
      const events = loadNormalizedEvents();
      return [...events].sort((a, b) => {
        const aVal = (a as any)[orderBy] ?? "";
        const bVal = (b as any)[orderBy] ?? "";
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        if (cmp !== 0) return ascending ? cmp : -cmp;
        return a.created_at < b.created_at ? 1 : -1;
      });
    },

    create: (row: Partial<EventRow> & { year: number; name: string }) => {
      const events = loadNormalizedEvents();
      const baseCode = row.code?.trim() || buildEventCode(row.name, row.year);
      let uniqueCode = baseCode;
      let suffix = 2;
      while (events.some((e) => e.code.toUpperCase() === uniqueCode.toUpperCase())) {
        uniqueCode = `${baseCode}-${suffix++}`;
      }

      const newEvent = normalizeEvent({
        ...row,
        id: crypto.randomUUID(),
        code: uniqueCode,
        created_at: new Date().toISOString(),
      });
      events.push(newEvent);
      writeJson(FILES.events, events);
      return newEvent;
    },

    update: (id: string, updates: Partial<EventRow>) => {
      const events = loadNormalizedEvents();
      const idx = events.findIndex((e) => e.id === id);
      if (idx === -1) throw new Error("Event not found");
      events[idx] = normalizeEvent({ ...events[idx], ...updates });
      writeJson(FILES.events, events);
      return events[idx];
    },

    delete: (id: string) => {
      const events = loadNormalizedEvents();
      if (events.length <= 1) {
        throw new Error("Cannot delete the only remaining church event.");
      }
      const filtered = events.filter((e) => e.id !== id);
      writeJson(FILES.events, filtered);
      const guests = loadNormalizedGuests().filter((g) => g.event_id !== id);
      writeJson(FILES.guests, guests);
    },
  },

  guests: {
    getAll: () => loadNormalizedGuests(),

    getByField: (field: string, value: string, orderBy?: string, ascending?: boolean) => {
      const guests = loadNormalizedGuests();
      let filtered = guests.filter((g) => String((g as any)[field]) === String(value));

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
      const guests = loadNormalizedGuests();
      const guest = guests.find(
        (g) => g.id === id || g.reg_code.toLowerCase() === id.toLowerCase(),
      );
      if (!guest) throw new Error("Guest not found");
      return guest;
    },

    create: (row: Partial<Guest> & { event_id: string; first_name: string; last_name: string }) => {
      const events = loadNormalizedEvents();
      const event = events.find((e) => e.id === row.event_id);
      const eventCode = event?.code || "IFC-26";

      const guests = loadNormalizedGuests();
      const eventGuests = guests.filter((g) => g.event_id === row.event_id);

      // Compute next monotonic sequence number for reg_code (never reuses deleted numbers)
      let maxSeq = eventGuests.length;
      for (const eg of eventGuests) {
        const match = eg.reg_code.match(/-(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxSeq) maxSeq = num;
        }
      }

      const now = new Date().toISOString();
      const days =
        Array.isArray(row.days_registered) && row.days_registered.length > 0
          ? Array.from(new Set(row.days_registered)).sort((a, b) => a - b)
          : typeof row.day === "number" && row.day >= 1
            ? [row.day]
            : [1];

      const gender = row.gender === "male" || row.gender === "female" ? row.gender : "unspecified";
      const status = row.status === "camping" ? "camping" : "not_camping";
      const ageGroup = row.age_group || "adult";

      const newGuest: Guest = {
        id: crypto.randomUUID(),
        reg_code: row.reg_code || generateRegCode(eventCode, maxSeq + 1),
        event_id: row.event_id,
        household_id: row.household_id ?? null,
        first_name: row.first_name.trim(),
        middle_name: row.middle_name ? row.middle_name.trim() : null,
        last_name: row.last_name.trim(),
        gender,
        age_group: ageGroup,
        origin: (row.origin ?? "").trim(),
        church_name: row.church_name ? row.church_name.trim() : null,
        ministry_role: row.ministry_role || "member",
        phone: (row.phone ?? "").trim(),
        is_shared_phone: Boolean(row.is_shared_phone),
        guardian_name: row.guardian_name ? row.guardian_name.trim() : null,
        email: row.email ? row.email.trim() : null,
        status,
        accommodation_zone:
          row.accommodation_zone !== undefined
            ? row.accommodation_zone
            : suggestAccommodationZone(gender, status, ageGroup),
        dietary_medical: row.dietary_medical ? row.dietary_medical.trim() : null,
        day: days[0] ?? null,
        days_registered: days,
        check_ins: row.check_ins && typeof row.check_ins === "object" ? row.check_ins : {},
        created_by: row.created_by ?? null,
        updated_by: row.updated_by ?? row.created_by ?? null,
        created_at: now,
        updated_at: now,
      };

      guests.push(newGuest);
      writeJson(FILES.guests, guests);

      appendAuditLog({
        guest_id: newGuest.id,
        event_id: newGuest.event_id,
        edited_by: newGuest.created_by,
        action: "create",
        changes: {
          reg_code: newGuest.reg_code,
          name: `${newGuest.first_name} ${newGuest.last_name}`,
          gender: newGuest.gender,
          days_registered: newGuest.days_registered,
          status: newGuest.status,
        },
      });

      return newGuest;
    },

    update: (id: string, updates: Partial<Guest>) => {
      const guests = loadNormalizedGuests();
      const index = guests.findIndex((g) => g.id === id);
      if (index === -1) throw new Error("Guest not found");

      const prev = guests[index];
      const nextDays =
        Array.isArray(updates.days_registered) && updates.days_registered.length > 0
          ? Array.from(new Set(updates.days_registered)).sort((a, b) => a - b)
          : updates.day !== undefined
            ? updates.day
              ? Array.from(new Set([...(prev.days_registered || []), updates.day])).sort(
                  (a, b) => a - b,
                )
              : prev.days_registered
            : prev.days_registered;

      const nextGender = updates.gender ?? prev.gender;
      const nextStatus = updates.status ?? prev.status;
      const nextAge = updates.age_group ?? prev.age_group;
      const nextZone =
        updates.accommodation_zone !== undefined
          ? updates.accommodation_zone
          : nextStatus === "not_camping"
            ? null
            : prev.accommodation_zone || suggestAccommodationZone(nextGender, nextStatus, nextAge);

      const updated: Guest = {
        ...prev,
        ...updates,
        days_registered: nextDays,
        day: nextDays[0] ?? null,
        accommodation_zone: nextZone,
        updated_at: new Date().toISOString(),
      };

      // Compute audit diff
      const diff: Record<string, { from: unknown; to: unknown }> = {};
      for (const key of TRACKED_GUEST_FIELDS) {
        const beforeVal = prev[key];
        const afterVal = updated[key];
        if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
          diff[key] = { from: beforeVal, to: afterVal };
        }
      }

      const prevCheckIns = JSON.stringify(prev.check_ins || {});
      const nextCheckIns = JSON.stringify(updated.check_ins || {});
      const isCheckInAction = prevCheckIns !== nextCheckIns && Object.keys(diff).length <= 1;

      guests[index] = updated;
      writeJson(FILES.guests, guests);

      if (isCheckInAction) {
        appendAuditLog({
          guest_id: updated.id,
          event_id: updated.event_id,
          edited_by: updates.updated_by ?? prev.updated_by,
          action: "check_in",
          changes: { check_ins: { from: prev.check_ins, to: updated.check_ins } },
        });
      } else if (Object.keys(diff).length > 0) {
        appendAuditLog({
          guest_id: updated.id,
          event_id: updated.event_id,
          edited_by: updates.updated_by ?? prev.updated_by,
          action: "update",
          changes: diff,
        });
      }

      return updated;
    },

    delete: (id: string, deletedBy?: string | null) => {
      const guests = loadNormalizedGuests();
      const target = guests.find((g) => g.id === id);
      const filtered = guests.filter((g) => g.id !== id);
      writeJson(FILES.guests, filtered);
      if (target) {
        appendAuditLog({
          guest_id: target.id,
          event_id: target.event_id,
          edited_by: deletedBy ?? target.updated_by,
          action: "delete",
          changes: {
            reg_code: target.reg_code,
            deleted_guest: `${target.first_name} ${target.last_name}`,
          },
        });
      }
    },

    /** Consolidates legacy multi-row duplicate registrations of the exact same person into a single multi-day UUID record */
    consolidateDuplicates: (eventId: string, actorId?: string | null) => {
      const guests = loadNormalizedGuests();
      const inEvent = guests.filter((g) => g.event_id === eventId);
      const others = guests.filter((g) => g.event_id !== eventId);

      const byIdentity = new Map<string, Guest[]>();
      for (const g of inEvent) {
        const key = [
          g.first_name.trim().toLowerCase(),
          (g.middle_name ?? "").trim().toLowerCase(),
          g.last_name.trim().toLowerCase(),
          g.phone.trim().toLowerCase(),
        ].join("|");
        const arr = byIdentity.get(key) ?? [];
        arr.push(g);
        byIdentity.set(key, arr);
      }

      let mergedCount = 0;
      const consolidated: Guest[] = [];

      for (const group of byIdentity.values()) {
        if (group.length === 1) {
          consolidated.push(group[0]);
          continue;
        }
        // Sort oldest first so primary UUID & reg_code stay stable
        group.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
        const primary = { ...group[0] };
        const mergedDays = new Set<number>(primary.days_registered);
        const mergedCheckIns: Record<string, string> = { ...primary.check_ins };

        for (let i = 1; i < group.length; i++) {
          const dup = group[i];
          dup.days_registered.forEach((d) => mergedDays.add(d));
          if (dup.day) mergedDays.add(dup.day);
          Object.assign(mergedCheckIns, dup.check_ins);
          if (primary.gender === "unspecified" && dup.gender !== "unspecified")
            primary.gender = dup.gender;
          if (!primary.church_name && dup.church_name) primary.church_name = dup.church_name;
          if (dup.status === "camping") primary.status = "camping";
          mergedCount++;
        }

        const sortedDays = Array.from(mergedDays).sort((a, b) => a - b);
        primary.days_registered = sortedDays;
        primary.day = sortedDays[0] ?? 1;
        primary.check_ins = mergedCheckIns;
        primary.updated_at = new Date().toISOString();
        primary.updated_by = actorId ?? primary.updated_by;
        consolidated.push(primary);

        appendAuditLog({
          guest_id: primary.id,
          event_id: eventId,
          edited_by: actorId ?? primary.updated_by,
          action: "merge",
          changes: {
            merged_records: group.length,
            days_registered: sortedDays,
            reg_code: primary.reg_code,
          },
        });
      }

      if (mergedCount > 0) {
        writeJson(FILES.guests, [...others, ...consolidated]);
      }
      return { mergedCount, remainingCount: consolidated.length };
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
      const filtered = edits.filter((e) => (e as any)[field] === value);
      return filtered.sort((a, b) => {
        const aVal = (a as any)[orderBy] ?? "";
        const bVal = (b as any)[orderBy] ?? "";
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return ascending ? cmp : -cmp;
      });
    },

    create: (row: Omit<GuestEdit, "id" | "edited_at">) => appendAuditLog(row),
  },
};

export function exportAllData() {
  return {
    profiles: readJson<Profile[]>(FILES.profiles, []),
    events: loadNormalizedEvents(),
    guests: loadNormalizedGuests(),
    guest_edits: readJson<GuestEdit[]>(FILES.guest_edits, []),
    exported_at: new Date().toISOString(),
  };
}
