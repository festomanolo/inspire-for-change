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
  first_name: z.string().trim().min(1, "First name is required").max(80),
  middle_name: z.string().trim().max(80).optional(),
  last_name: z.string().trim().min(1, "Last name is required").max(80),
  origin: z.string().trim().min(1, "Origin / location is required").max(120),
  phone: z.string().trim().min(4, "Phone number is required").max(40),
  status: z.enum(["camping", "not_camping"]),
  day: z.number().min(1).max(3).nullable(),
});

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 14px", borderRadius: "12px",
  background: "var(--color-input)", border: "1.5px solid var(--color-border)",
  fontSize: "0.9rem", color: "var(--color-foreground)",
  transition: "border-color 0.15s ease, box-shadow 0.15s ease",
};

function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "6px", color: "var(--color-foreground)" }}>
        {label}{required && <span style={{ color: "var(--color-accent)", marginLeft: "3px" }}>*</span>}
      </label>
      {children}
      {hint && <p style={{ fontSize: "0.72rem", color: "var(--color-muted-foreground)", marginTop: "4px" }}>{hint}</p>}
    </div>
  );
}

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

  const searchGuests = async (query: string) => {
    if (!selected || query.length < 2) { setSearchResults([]); setShowSearch(false); return; }
    const { data } = await supabase.from("guests").select("*").eq("event_id", selected.id);
    if (!data) { setSearchResults([]); return; }
    const lq = query.toLowerCase();
    const filtered = (data as Guest[]).filter(
      (g) => g.first_name.toLowerCase().includes(lq) ||
        g.last_name.toLowerCase().includes(lq) ||
        g.phone.toLowerCase().includes(lq),
    ).slice(0, 5);
    setSearchResults(filtered);
    setShowSearch(true);
  };

  const loadGuestData = (guest: Guest) => {
    setForm({ first_name: guest.first_name, middle_name: guest.middle_name || "", last_name: guest.last_name, origin: guest.origin, phone: guest.phone, status: guest.status, day: null });
    setSearchQuery(""); setSearchResults([]); setShowSearch(false); setDuplicateWarning("");
  };

  const checkDuplicate = async (phone: string, firstName: string, lastName: string) => {
    if (!selected || !phone || !firstName || !lastName) { setDuplicateWarning(""); return; }
    const { data } = await supabase.from("guests").select("id, first_name, last_name, phone, day").eq("event_id", selected.id);
    if (!data) { setDuplicateWarning(""); return; }
    const currentDay = form.day;
    const phoneMatch = (data as Guest[]).find((g) => g.phone === phone && g.day === currentDay);
    const nameMatch = (data as Guest[]).find((g) => g.first_name.toLowerCase() === firstName.toLowerCase() && g.last_name.toLowerCase() === lastName.toLowerCase() && g.day === currentDay);
    if (phoneMatch) {
      setDuplicateWarning(`⚠️ Guest with phone ${phone} already registered for Day ${currentDay}.`);
    } else if (nameMatch) {
      setDuplicateWarning(`⚠️ ${nameMatch.first_name} ${nameMatch.last_name} already registered for Day ${currentDay}.`);
    } else {
      const otherDay = (data as Guest[]).find((g) => g.phone === phone && g.day !== currentDay);
      if (otherDay && currentDay) {
        setDuplicateWarning(`ℹ️ This guest is registered for Day ${otherDay.day}. You're registering them for Day ${currentDay}.`);
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
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }

    const { data: existing } = await supabase.from("guests").select("id, first_name, last_name, phone, day").eq("event_id", selected.id);
    if (existing && existing.length > 0) {
      const cd = parsed.data.day;
      const pm = (existing as Guest[]).find((g) => g.phone === parsed.data.phone && g.day === cd);
      const nm = (existing as Guest[]).find((g) => g.first_name.toLowerCase() === parsed.data.first_name.toLowerCase() && g.last_name.toLowerCase() === parsed.data.last_name.toLowerCase() && g.day === cd);
      if (pm) { setError(`A guest with phone ${parsed.data.phone} is already registered for Day ${cd}.`); return; }
      if (nm) { setError(`${nm.first_name} ${nm.last_name} is already registered for Day ${cd}.`); return; }
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
    if (err) { setError(err.message); return; }

    if (andAnother) {
      setForm({ first_name: "", middle_name: "", last_name: "", origin: form.origin, phone: "", status: form.status, day: form.day });
      setDuplicateWarning("");
      setSavedToast(`✓ ${parsed.data.first_name} added`);
      setTimeout(() => setSavedToast(""), 2200);
    } else if (data) {
      navigate({ to: "/guests/$id", params: { id: (data as { id: string }).id } });
    }
  };

  return (
    <div style={{ maxWidth: "640px", margin: "0 auto" }}>
      {/* Header */}
      <div className="slide-up" style={{ marginBottom: "24px" }}>
        <p style={{ fontSize: "0.8rem", color: "var(--color-muted-foreground)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {selected?.name}
        </p>
        <h1 style={{ marginTop: "2px" }}>Register a guest</h1>
      </div>

      <form onSubmit={(e) => onSubmit(e, false)} className="surface-elevated fade-in" style={{ padding: "clamp(16px, 5vw, 32px)", display: "flex", flexDirection: "column", gap: "18px" }}>

        {/* Search existing */}
        <div style={{ paddingBottom: "18px", borderBottom: "1px solid var(--color-border)" }}>
          <Field label="Load returning guest" hint="Search by name or phone to auto-fill their info for a new day">
            <div style={{ position: "relative" }}>
              <input
                id="guest-search-input"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setTimeout(() => searchGuests(e.target.value), 300); }}
                onFocus={() => { if (searchResults.length > 0) setShowSearch(true); }}
                style={{ ...inputStyle, paddingLeft: "38px" }}
                placeholder="Search existing guests…"
              />
              <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--color-muted-foreground)", pointerEvents: "none" }}>🔍</span>
              {showSearch && searchResults.length > 0 && (
                <div className="scale-in" style={{
                  position: "absolute", zIndex: 10, width: "100%", marginTop: "6px",
                  background: "var(--color-card)", border: "1px solid var(--color-border)",
                  borderRadius: "14px", overflow: "hidden", boxShadow: "var(--shadow-float)",
                }}>
                  {searchResults.map((guest) => (
                    <button key={guest.id} type="button" onClick={() => loadGuestData(guest)}
                      style={{
                        width: "100%", textAlign: "left", padding: "12px 14px", background: "none",
                        border: "none", cursor: "pointer", borderBottom: "1px solid var(--color-border)",
                        transition: "background 0.1s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-secondary)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                    >
                      <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>
                        {[guest.first_name, guest.middle_name, guest.last_name].filter(Boolean).join(" ")}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--color-muted-foreground)", display: "flex", gap: "8px", marginTop: "2px" }}>
                        <span>{guest.phone}</span><span>·</span><span>{guest.origin}</span>
                        {guest.day && <><span>·</span><span>Day {guest.day}</span></>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Field>
        </div>

        {/* Name fields */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "12px" }}>
          <Field label="First name" required>
            <input id="reg-first-name" autoFocus value={form.first_name}
              onChange={(e) => { update("first_name", e.target.value); setTimeout(() => checkDuplicate(form.phone, e.target.value, form.last_name), 500); }}
              style={inputStyle} placeholder="Jane" />
          </Field>
          <Field label="Middle name">
            <input id="reg-middle-name" value={form.middle_name}
              onChange={(e) => update("middle_name", e.target.value)} style={inputStyle} placeholder="Optional" />
          </Field>
          <Field label="Last name" required>
            <input id="reg-last-name" value={form.last_name}
              onChange={(e) => { update("last_name", e.target.value); setTimeout(() => checkDuplicate(form.phone, form.first_name, e.target.value), 500); }}
              style={inputStyle} placeholder="Doe" />
          </Field>
        </div>

        <Field label="Location / origin" required>
          <input id="reg-origin" value={form.origin}
            onChange={(e) => update("origin", e.target.value)} style={inputStyle} placeholder="City, country" />
        </Field>

        <Field label="Phone number" required>
          <input id="reg-phone" value={form.phone} type="tel"
            onChange={(e) => { update("phone", e.target.value); const t = setTimeout(() => checkDuplicate(e.target.value, form.first_name, form.last_name), 500); return () => clearTimeout(t); }}
            style={inputStyle} placeholder="+1 555 000 0000" />
        </Field>

        {/* Status */}
        <div>
          <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "8px" }}>Accommodation status</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            {(["camping", "not_camping"] as const).map((s) => (
              <button key={s} type="button" id={`status-${s}`}
                onClick={() => update("status", s)}
                style={{
                  padding: "12px 14px", borderRadius: "12px", border: "2px solid",
                  borderColor: form.status === s ? "var(--color-accent)" : "var(--color-border)",
                  background: form.status === s ? "oklch(0.55 0.22 258 / 0.06)" : "var(--color-secondary)",
                  color: form.status === s ? "var(--color-accent)" : "var(--color-foreground)",
                  fontWeight: form.status === s ? 700 : 500, fontSize: "0.88rem",
                  cursor: "pointer", transition: "all 0.15s ease", textAlign: "center",
                }}>
                {s === "camping" ? "⛺ Camping" : "☀️ Not camping"}
              </button>
            ))}
          </div>
        </div>

        {/* Day selector */}
        <div>
          <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "8px" }}>
            Day of attendance <span style={{ fontWeight: 400, color: "var(--color-muted-foreground)" }}>(optional)</span>
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
            {[1, 2, 3].map((dayNum) => (
              <button
                key={dayNum}
                id={`day-btn-${dayNum}`}
                type="button"
                onClick={() => setForm({ ...form, day: form.day === dayNum ? null : dayNum })}
                style={{
                  padding: "12px 8px", borderRadius: "12px", border: "2px solid",
                  borderColor: form.day === dayNum ? "var(--color-accent)" : "var(--color-border)",
                  background: form.day === dayNum ? "oklch(0.55 0.22 258 / 0.06)" : "var(--color-secondary)",
                  color: form.day === dayNum ? "var(--color-accent)" : "var(--color-foreground)",
                  fontWeight: form.day === dayNum ? 700 : 500, fontSize: "0.9rem",
                  cursor: "pointer", transition: "all 0.15s ease",
                }}
              >
                Day {dayNum}
              </button>
            ))}
          </div>
          <p style={{ fontSize: "0.72rem", color: "var(--color-muted-foreground)", marginTop: "6px" }}>
            Select which day this guest attends
          </p>
        </div>

        {/* Duplicate warning */}
        {duplicateWarning && (
          <div className="scale-in" style={{
            fontSize: "0.82rem", padding: "10px 14px", borderRadius: "10px",
            ...(duplicateWarning.startsWith("ℹ️")
              ? { color: "oklch(0.5 0.2 258)", background: "oklch(0.55 0.22 258 / 0.06)", border: "1px solid oklch(0.55 0.22 258 / 0.2)" }
              : { color: "oklch(0.55 0.2 50)", background: "oklch(0.65 0.18 50 / 0.06)", border: "1px solid oklch(0.65 0.18 50 / 0.2)" }),
          }}>
            {duplicateWarning}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="scale-in" style={{
            fontSize: "0.85rem", color: "var(--color-destructive)",
            background: "oklch(0.58 0.22 27 / 0.08)", padding: "10px 14px",
            borderRadius: "10px", border: "1px solid oklch(0.58 0.22 27 / 0.2)",
          }}>
            {error}
          </div>
        )}

        {/* Submit buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", paddingTop: "4px" }}>
          <button
            id="reg-save-view-btn"
            type="submit"
            disabled={saving}
            style={{
              padding: "13px 20px", borderRadius: "12px", border: "none",
              background: saving ? "var(--color-muted)" : "linear-gradient(135deg, oklch(0.28 0.06 255), oklch(0.45 0.2 268))",
              color: saving ? "var(--color-muted-foreground)" : "white",
              fontWeight: 700, fontSize: "0.95rem", cursor: saving ? "not-allowed" : "pointer",
              boxShadow: saving ? "none" : "0 4px 14px oklch(0.45 0.2 268 / 0.3)",
              transition: "all 0.2s ease",
            }}
          >
            {saving ? "Saving…" : "Save & view profile →"}
          </button>
          <button
            id="reg-save-another-btn"
            type="button"
            onClick={(e) => onSubmit(e, true)}
            disabled={saving}
            style={{
              padding: "13px 20px", borderRadius: "12px",
              border: "1.5px solid var(--color-border)",
              background: "var(--color-secondary)", color: "var(--color-foreground)",
              fontWeight: 600, fontSize: "0.88rem", cursor: saving ? "not-allowed" : "pointer",
              transition: "all 0.2s ease",
            }}
          >
            Save & add another
          </button>
        </div>
      </form>

      {/* Success toast */}
      {savedToast && (
        <div className="scale-in" style={{
          position: "fixed", bottom: "90px", left: "50%", transform: "translateX(-50%)",
          background: "var(--color-primary)", color: "var(--color-primary-foreground)",
          padding: "10px 20px", borderRadius: "9999px", fontSize: "0.88rem",
          fontWeight: 600, boxShadow: "var(--shadow-float)", zIndex: 100,
          whiteSpace: "nowrap",
        }}>
          {savedToast}
        </div>
      )}
    </div>
  );
}
