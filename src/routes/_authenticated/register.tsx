import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useEvents } from "@/hooks/use-events";
import { z } from "zod";
import type { Guest } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/register")({
  head: () => ({ meta: [{ title: "Register guest — Inspired for Change" }] }),
  component: RegisterPage,
});

const schema = z.object({
  first_name: z.string().trim().min(1, "Required").max(80),
  middle_name: z.string().trim().max(80).optional(),
  last_name: z.string().trim().min(1, "Required").max(80),
  origin: z.string().trim().min(1, "Required").max(120),
  phone: z.string().trim().min(4, "Required").max(40),
  status: z.enum(["camping", "not_camping"]),
  day: z.number().min(1).max(3).nullable(),
});

function RegisterPage() {
  const { selected } = useEvents();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    origin: "",
    phone: "",
    status: "not_camping" as "camping" | "not_camping",
    day: null as number | null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedToast, setSavedToast] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Guest[]>([]);
  const [showSearch, setShowSearch] = useState(false);

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Search for existing guests
  const searchGuests = async (query: string) => {
    if (!selected || query.length < 2) {
      setSearchResults([]);
      setShowSearch(false);
      return;
    }
    
    const { data } = await supabase
      .from("guests")
      .select("*")
      .eq("event_id", selected.id);
    
    if (!data) {
      setSearchResults([]);
      return;
    }

    // Filter client-side for name or phone match
    const lowerQuery = query.toLowerCase();
    const filtered = (data as Guest[]).filter(
      (g) =>
        g.first_name.toLowerCase().includes(lowerQuery) ||
        g.last_name.toLowerCase().includes(lowerQuery) ||
        g.phone.toLowerCase().includes(lowerQuery)
    ).slice(0, 5); // Limit to 5 results
    
    setSearchResults(filtered);
    setShowSearch(true);
  };

  // Load guest data from search result
  const loadGuestData = (guest: Guest) => {
    setForm({
      first_name: guest.first_name,
      middle_name: guest.middle_name || "",
      last_name: guest.last_name,
      origin: guest.origin,
      phone: guest.phone,
      status: guest.status,
      day: null, // New day for this attendance
    });
    setSearchQuery("");
    setSearchResults([]);
    setShowSearch(false);
    setDuplicateWarning("");
  };

  // Check for duplicates when phone or name changes
  const checkDuplicate = async (phone: string, firstName: string, lastName: string) => {
    if (!selected || !phone || !firstName || !lastName) {
      setDuplicateWarning("");
      return;
    }
    
    const { data } = await supabase
      .from("guests")
      .select("id, first_name, last_name, phone, day")
      .eq("event_id", selected.id);
    
    if (!data) {
      setDuplicateWarning("");
      return;
    }

    // Check for phone or name match on the SAME day only
    const currentDay = form.day;
    
    const phoneMatch = (data as Guest[]).find(
      (g) => g.phone === phone && g.day === currentDay
    );
    const nameMatch = (data as Guest[]).find(
      (g) => g.first_name.toLowerCase() === firstName.toLowerCase() && 
             g.last_name.toLowerCase() === lastName.toLowerCase() &&
             g.day === currentDay
    );
    
    if (phoneMatch) {
      setDuplicateWarning(`⚠️ This guest with phone ${phone} is already registered for Day ${currentDay}.`);
    } else if (nameMatch) {
      setDuplicateWarning(`⚠️ ${nameMatch.first_name} ${nameMatch.last_name} is already registered for Day ${currentDay}.`);
    } else {
      // Check if guest exists for other days (informational)
      const existsOtherDay = (data as Guest[]).find(
        (g) => g.phone === phone && g.day !== currentDay
      );
      if (existsOtherDay && currentDay) {
        setDuplicateWarning(`ℹ️ Note: This guest is registered for Day ${existsOtherDay.day}. You're registering them for Day ${currentDay}.`);
      } else {
        setDuplicateWarning("");
      }
    }
  };

  const onSubmit = async (e: React.FormEvent, andAnother = false) => {
    e.preventDefault();
    setError("");
    if (!selected || !user) return;
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    // Final duplicate check before submission - only block if SAME day
    const { data: existingGuests } = await supabase
      .from("guests")
      .select("id, first_name, last_name, phone, day")
      .eq("event_id", selected.id);
    
    if (existingGuests && existingGuests.length > 0) {
      // Check for duplicates on the SAME day only
      const currentDay = parsed.data.day;
      
      const phoneMatch = (existingGuests as Guest[]).find(
        (g) => g.phone === parsed.data.phone && g.day === currentDay
      );
      const nameMatch = (existingGuests as Guest[]).find(
        (g) => g.first_name.toLowerCase() === parsed.data.first_name.toLowerCase() && 
               g.last_name.toLowerCase() === parsed.data.last_name.toLowerCase() &&
               g.day === currentDay
      );
      
      if (phoneMatch) {
        setError(`A guest with phone number ${parsed.data.phone} is already registered for Day ${currentDay}. Please verify the information.`);
        return;
      }
      if (nameMatch) {
        setError(`${nameMatch.first_name} ${nameMatch.last_name} is already registered for Day ${currentDay}. Please verify the information.`);
        return;
      }
    }

    setSaving(true);
    const { data, error: err } = await supabase
      .from("guests")
      .insert({
        event_id: selected.id,
        first_name: parsed.data.first_name,
        middle_name: parsed.data.middle_name || null,
        last_name: parsed.data.last_name,
        origin: parsed.data.origin,
        phone: parsed.data.phone,
        status: parsed.data.status,
        day: parsed.data.day,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (andAnother) {
      setForm({
        first_name: "",
        middle_name: "",
        last_name: "",
        origin: form.origin,
        phone: "",
        status: form.status,
        day: form.day,
      });
      setDuplicateWarning("");
      setSavedToast(`${parsed.data.first_name} added`);
      setTimeout(() => setSavedToast(""), 2200);
    } else if (data) {
      navigate({ to: "/guests/$id", params: { id: (data as { id: string }).id } });
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <p className="text-sm text-muted-foreground">{selected?.name}</p>
        <h1 className="text-4xl mt-1">Register a guest</h1>
      </div>

      <form onSubmit={(e) => onSubmit(e, false)} className="surface-elevated p-8 space-y-5">
        {/* Guest Search */}
        <div className="mb-6 pb-6 border-b border-border">
          <label className="block text-sm font-medium mb-2">
            Load existing guest <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <div className="relative">
            <input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setTimeout(() => searchGuests(e.target.value), 300);
              }}
              onFocus={() => {
                if (searchResults.length > 0) setShowSearch(true);
              }}
              className={inputCls}
              placeholder="Search by name or phone to load previous info..."
            />
            {showSearch && searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-2 surface-elevated shadow-elevated rounded-xl overflow-hidden">
                {searchResults.map((guest) => (
                  <button
                    key={guest.id}
                    type="button"
                    onClick={() => loadGuestData(guest)}
                    className="w-full text-left px-4 py-3 hover:bg-secondary transition-colors border-b border-border last:border-0"
                  >
                    <div className="font-medium">
                      {[guest.first_name, guest.middle_name, guest.last_name].filter(Boolean).join(" ")}
                    </div>
                    <div className="text-xs text-muted-foreground flex gap-3 mt-1">
                      <span>{guest.phone}</span>
                      <span>•</span>
                      <span>{guest.origin}</span>
                      {guest.day && (
                        <>
                          <span>•</span>
                          <span>Day {guest.day}</span>
                        </>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            For returning guests, search their name to auto-fill their information for a new day
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="First name" required>
            <input
              autoFocus
              value={form.first_name}
              onChange={(e) => {
                update("first_name", e.target.value);
                setTimeout(() => checkDuplicate(form.phone, e.target.value, form.last_name), 500);
              }}
              className={inputCls}
            />
          </Field>
          <Field label="Middle name">
            <input
              value={form.middle_name}
              onChange={(e) => update("middle_name", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Last name" required>
            <input
              value={form.last_name}
              onChange={(e) => {
                update("last_name", e.target.value);
                setTimeout(() => checkDuplicate(form.phone, form.first_name, e.target.value), 500);
              }}
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="Location / origin" required>
          <input
            value={form.origin}
            onChange={(e) => update("origin", e.target.value)}
            className={inputCls}
            placeholder="City, country"
          />
        </Field>

        <Field label="Phone number" required>
          <input
            value={form.phone}
            onChange={(e) => {
              update("phone", e.target.value);
              // Debounced duplicate check
              const timer = setTimeout(() => {
                checkDuplicate(e.target.value, form.first_name, form.last_name);
              }, 500);
              return () => clearTimeout(timer);
            }}
            className={inputCls}
            placeholder="e.g., +1 555 000 0000 or +255 123 456 789"
          />
        </Field>

        <div>
          <label className="block text-sm font-medium mb-2">Status</label>
          <div className="grid grid-cols-2 gap-3">
            <StatusOption
              active={form.status === "camping"}
              onClick={() => update("status", "camping")}
              label="Camping"
            />
            <StatusOption
              active={form.status === "not_camping"}
              onClick={() => update("status", "not_camping")}
              label="Not camping"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Day of attendance <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((dayNum) => (
              <button
                key={dayNum}
                type="button"
                onClick={() => setForm({ ...form, day: form.day === dayNum ? null : dayNum })}
                className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                  form.day === dayNum
                    ? "bg-accent text-accent-foreground border-accent"
                    : "bg-secondary text-secondary-foreground border-border hover:bg-muted"
                }`}
              >
                Day {dayNum}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Select which day of the event this guest will attend
          </p>
        </div>

        {duplicateWarning && (
          <div className={`text-sm px-4 py-3 rounded-xl border ${
            duplicateWarning.startsWith('ℹ️') 
              ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900'
              : 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900'
          }`}>
            {duplicateWarning}
          </div>
        )}

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 px-4 py-3 rounded-xl">{error}</div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 rounded-full bg-primary text-primary-foreground font-medium hover:opacity-90 transition-all disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save & view"}
          </button>
          <button
            type="button"
            onClick={(e) => onSubmit(e, true)}
            disabled={saving}
            className="px-6 py-3 rounded-full bg-secondary text-secondary-foreground font-medium hover:bg-muted transition-all disabled:opacity-50"
          >
            Save & add another
          </button>
        </div>
      </form>

      {savedToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 surface-elevated px-5 py-3 fade-in text-sm">
          ✓ {savedToast}
        </div>
      )}
    </div>
  );
}

const inputCls =
  "w-full px-4 py-3 rounded-xl bg-input border border-border focus:outline-none focus:ring-2 focus:ring-ring transition-all";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2">
        {label} {required && <span className="text-muted-foreground">*</span>}
      </label>
      {children}
    </div>
  );
}

function StatusOption({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
        active
          ? "bg-accent text-accent-foreground border-accent"
          : "bg-secondary text-secondary-foreground border-border hover:bg-muted"
      }`}
    >
      {label}
    </button>
  );
}
