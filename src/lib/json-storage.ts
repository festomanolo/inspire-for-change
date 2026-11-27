// JSON file-based storage client (mirrors Supabase fluent API + church event extensions)
import type { Profile, Guest, EventRow, GuestEdit } from "./types";

const API_BASE = "/api/storage";

export type JsonUser = {
  id: string;
  email: string;
  created_at: string;
};

export type JsonSession = {
  user: JsonUser;
  access_token: string;
  expires_at: number;
};

async function apiGet<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`);
  if (!response.ok) throw new Error(`Failed to fetch ${endpoint}`);
  return response.json();
}

async function apiPost<T>(endpoint: string, data: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || "Request failed");
  }
  return response.json();
}

async function apiPut<T>(endpoint: string, data: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: `Failed to update ${endpoint}` }));
    throw new Error(error.message || `Failed to update ${endpoint}`);
  }
  return response.json();
}

async function apiDelete(endpoint: string): Promise<void> {
  const response = await fetch(`${API_BASE}${endpoint}`, { method: "DELETE" });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: `Failed to delete ${endpoint}` }));
    throw new Error(error.message || `Failed to delete ${endpoint}`);
  }
}

type AuthListener = (event: string, session: JsonSession | null) => void;
const authListeners = new Set<AuthListener>();

function notifyAuthListeners(event: string, session: JsonSession | null) {
  authListeners.forEach((listener) => listener(event, session));
}

// Local broadcast bus so open tabs/components react immediately to mutations in JSON mode
type TableChangeCallback = (payload: { eventType: string; new: any; old: any }) => void;
const tableSubscribers = new Map<string, Set<TableChangeCallback>>();

function emitTableChange(table: string, eventType: string, newRow: any, oldRow: any = null) {
  const subs = tableSubscribers.get(table);
  if (subs) {
    subs.forEach((cb) => cb({ eventType, new: newRow, old: oldRow }));
  }
}

export const jsonAuth = {
  getSession: async () => {
    try {
      const session = await apiGet<JsonSession | null>("/auth/session");
      return { data: { session }, error: null };
    } catch {
      return { data: { session: null }, error: null };
    }
  },

  getUser: async () => {
    try {
      const session = await apiGet<JsonSession | null>("/auth/session");
      return { data: { user: session?.user || null }, error: null };
    } catch {
      return { data: { user: null }, error: null };
    }
  },

  signUp: async (params: {
    email: string;
    password: string;
    options?: { emailRedirectTo?: string; data?: { display_name?: string } };
  }) => {
    try {
      const result = await apiPost<{ user: JsonUser; session: JsonSession }>("/auth/signup", params);
      notifyAuthListeners("SIGNED_IN", result.session);
      return { data: result, error: null };
    } catch (error: any) {
      return { data: { user: null, session: null }, error: { message: error.message } };
    }
  },

  signInWithPassword: async (params: { email: string; password: string }) => {
    try {
      const result = await apiPost<{ user: JsonUser; session: JsonSession }>("/auth/signin", params);
      notifyAuthListeners("SIGNED_IN", result.session);
      return { data: result, error: null };
    } catch (error: any) {
      return { data: { user: null, session: null }, error: { message: error.message } };
    }
  },

  signOut: async () => {
    try {
      await apiPost("/auth/signout", {});
      notifyAuthListeners("SIGNED_OUT", null);
      return { error: null };
    } catch (error: any) {
      return { error: { message: error.message } };
    }
  },

  onAuthStateChange: (callback: AuthListener) => {
    authListeners.add(callback);
    jsonAuth.getSession().then(({ data }) => callback("INITIAL_SESSION", data.session));

    return {
      data: {
        subscription: {
          unsubscribe: () => authListeners.delete(callback),
        },
      },
    };
  },
};

function makeGuestEditBuilder(params: URLSearchParams) {
  const builder: any = {
    _params: params,

    eq(field: string, value: string) {
      this._params.set(field, value);
      return this;
    },

    order(field: string, options?: { ascending?: boolean }) {
      this._params.set("orderBy", field);
      this._params.set("asc", String(options?.ascending !== false));
      return this;
    },

    limit(n: number) {
      this._params.set("limit", String(n));
      return this;
    },

    async then(resolve: (v: any) => void, reject?: (e: any) => void) {
      try {
        const qs = this._params.toString() ? "?" + this._params.toString() : "";
        const raw = await apiGet<any[]>(`/guest-edits${qs}`);
        const joinGuest = this._params.get("_joinGuest") === "true";
        let data: any[] = raw;
        if (joinGuest) {
          const guests = await apiGet<Guest[]>("/guests").catch(() => [] as Guest[]);
          data = raw.map((e) => ({
            ...e,
            guest: guests.find((g) => g.id === e.guest_id) ?? null,
          }));
        }
        const limit = this._params.get("limit");
        if (limit) data = data.slice(0, parseInt(limit, 10));
        resolve({ data, error: null });
      } catch (err: any) {
        if (reject) reject(err);
        else resolve({ data: null, error: { message: err.message } });
      }
    },
  };
  return builder;
}

function makeEventBuilder(params: URLSearchParams) {
  const builder: any = {
    _params: params,
    _updatePayload: null as any,
    _isDelete: false,

    eq(field: string, value: string) {
      this._params.set(field, value);
      return this;
    },

    order(field: string, options?: { ascending?: boolean }) {
      this._params.set("orderBy", field);
      this._params.set("asc", String(options?.ascending !== false));
      return this;
    },

    select() {
      return this;
    },

    single() {
      const id = this._params.get("id");
      if (this._updatePayload !== null) {
        return apiPut<EventRow>(`/events/${id}`, this._updatePayload)
          .then((data) => {
            emitTableChange("events", "UPDATE", data);
            return { data, error: null };
          })
          .catch((err) => ({ data: null, error: { message: err.message } }));
      }
      return Promise.resolve({ data: null, error: { message: "Unsupported single query" } });
    },

    async then(resolve: (v: any) => void, reject?: (e: any) => void) {
      try {
        if (this._isDelete) {
          const id = this._params.get("id");
          await apiDelete(`/events/${id}`);
          emitTableChange("events", "DELETE", null, { id });
          resolve({ error: null });
          return;
        }
        if (this._updatePayload !== null) {
          const id = this._params.get("id");
          const data = await apiPut<EventRow>(`/events/${id}`, this._updatePayload);
          emitTableChange("events", "UPDATE", data);
          resolve({ data, error: null });
          return;
        }
        const orderBy = this._params.get("orderBy") || "year";
        const asc = this._params.get("asc") !== "false";
        const data = await apiGet<EventRow[]>(`/events?orderBy=${orderBy}&asc=${asc}`);
        resolve({ data, error: null });
      } catch (err: any) {
        if (reject) reject(err);
        else resolve({ data: null, error: { message: err.message } });
      }
    },
  };
  return builder;
}

function makeGuestBuilder(params: URLSearchParams) {
  const builder: any = {
    _params: params,
    _updatePayload: null as any,
    _isDelete: false,

    eq(field: string, value: string) {
      if (this._updatePayload !== null || this._isDelete) {
        if (!this._params.has("id") && field === "id") this._params.set("id", value);
        return this;
      }
      this._params.set(field, value);
      return this;
    },

    order(field: string, options?: { ascending?: boolean }) {
      this._params.set("orderBy", field);
      this._params.set("asc", String(options?.ascending !== false));
      return this;
    },

    limit(n: number) {
      this._params.set("limit", String(n));
      return this;
    },

    maybeSingle() {
      const id = this._params.get("id");
      return apiGet<Guest>(`/guests/${id}`)
        .then((data) => ({ data, error: null }))
        .catch(() => ({ data: null, error: null }));
    },

    single() {
      const id = this._params.get("id");
      if (this._updatePayload !== null) {
        return apiPut<Guest>(`/guests/${id}`, this._updatePayload)
          .then((data) => {
            emitTableChange("guests", "UPDATE", data);
            emitTableChange("guest_edits", "INSERT", {});
            return { data, error: null };
          })
          .catch((err) => ({ data: null, error: { message: err.message } }));
      }
      return apiGet<Guest>(`/guests/${id}`)
        .then((data) => ({ data, error: null }))
        .catch((err) => ({ data: null, error: { message: err.message } }));
    },

    select(_cols?: string) {
      return this;
    },

    async then(resolve: (v: any) => void, reject?: (e: any) => void) {
      try {
        if (this._isDelete) {
          const id = this._params.get("id");
          await apiDelete(`/guests/${id}`);
          emitTableChange("guests", "DELETE", null, { id });
          emitTableChange("guest_edits", "INSERT", {});
          resolve({ error: null });
          return;
        }
        if (this._updatePayload !== null) {
          const id = this._params.get("id");
          const data = await apiPut<Guest>(`/guests/${id}`, this._updatePayload);
          emitTableChange("guests", "UPDATE", data);
          emitTableChange("guest_edits", "INSERT", {});
          resolve({ data, error: null });
          return;
        }
        const qs = this._params.toString() ? "?" + this._params.toString() : "";
        const data = await apiGet<Guest[]>(`/guests${qs}`);
        resolve({ data, error: null });
      } catch (err: any) {
        if (reject) reject(err);
        else resolve({ data: null, error: { message: err.message } });
      }
    },
  };
  return builder;
}

function makeProfileBuilder(params: URLSearchParams) {
  const builder: any = {
    _params: params,

    eq(field: string, value: string) {
      this._params.set(field, value);
      return this;
    },

    maybeSingle() {
      const field = [...this._params.keys()][0];
      const value = this._params.get(field) ?? "";
      return apiGet<Profile>(`/profiles?${field}=${value}`)
        .then((data) => ({ data, error: null }))
        .catch(() => ({ data: null, error: null }));
    },

    async then(resolve: (v: any) => void, reject?: (e: any) => void) {
      try {
        const qs = this._params.toString() ? "?" + this._params.toString() : "";
        const data = await apiGet<Profile[]>(`/profiles${qs}`);
        resolve({ data, error: null });
      } catch (err: any) {
        if (reject) reject(err);
        else resolve({ data: null, error: { message: err.message } });
      }
    },
  };
  return builder;
}

export const jsonDb = {
  profiles: {
    select(_cols?: string) {
      return makeProfileBuilder(new URLSearchParams());
    },
  },

  events: {
    select(_cols?: string) {
      return makeEventBuilder(new URLSearchParams());
    },

    insert: (row: Partial<EventRow> & { year: number; name: string }) => ({
      select: () => ({
        single: () =>
          apiPost<EventRow>("/events", row)
            .then((data) => {
              emitTableChange("events", "INSERT", data);
              return { data, error: null };
            })
            .catch((err) => ({ data: null, error: { message: err.message } })),
      }),
    }),

    update: (updates: Partial<EventRow>) => {
      const builder = makeEventBuilder(new URLSearchParams());
      builder._updatePayload = updates;
      return builder;
    },

    delete: () => {
      const builder = makeEventBuilder(new URLSearchParams());
      builder._isDelete = true;
      return builder;
    },
  },

  guests: {
    select(_cols?: string) {
      return makeGuestBuilder(new URLSearchParams());
    },

    insert: (row: Partial<Guest> & { event_id: string; first_name: string; last_name: string }) => ({
      select: (_cols?: string) => ({
        single: () => apiPost<Guest>("/guests", row).then((data) => ({ data, error: null })),
      }),
    }),

    update: (updates: Partial<Guest>) => {
      const builder = makeGuestBuilder(new URLSearchParams());
      builder._updatePayload = updates;
      return builder;
    },

    delete: () => {
      const builder = makeGuestBuilder(new URLSearchParams());
      builder._isDelete = true;
      return builder;
    },
  },

  guest_edits: {
    select(cols?: string) {
      const params = new URLSearchParams();
      if (cols && cols.includes("guest:guests")) {
        params.set("_joinGuest", "true");
      }
      return makeGuestEditBuilder(params);
    },

    insert: (row: Omit<GuestEdit, "id" | "edited_at">) => {
      return apiPost<GuestEdit>("/guest-edits", row).then((data) => ({ data, error: null }));
    },
  },
};

// ─── No-op Realtime Channel (Supabase Realtime not available in JSON mode) ──
class MockChannel {
  on(_event: string, _filter: any, _callback: any) {
    return this; // chainable
  }
  subscribe() {
    return this;
  }
}

// JSON Supabase client structure
export const jsonSupabase = {
  auth: jsonAuth,

  from: (table: string) => {
    if (table === "profiles") return jsonDb.profiles;
    if (table === "events") return jsonDb.events;
    if (table === "guests") return jsonDb.guests;
    if (table === "guest_edits") return jsonDb.guest_edits;
    throw new Error(`Unknown table: ${table}`);
  },

  // Realtime — no-op for local JSON mode
  channel(_name: string) {
    return new MockChannel();
  },

  removeChannel(_channel: any) {
    // no-op
  },
};
