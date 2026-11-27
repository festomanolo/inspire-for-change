import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useEvents } from "@/hooks/use-events";
import { z } from "zod";
import {
  AGE_GROUP_LABELS,
  MINISTRY_ROLE_LABELS,
  formatFullName,
  suggestAccommodationZone,
  type AgeGroup,
  type Gender,
  type Guest,
  type GuestStatus,
  type MinistryRole,
} from "@/lib/types";
import { QrBadgePass } from "@/components/QrBadgePass";
import { toast } from "sonner";
import {
  ArrowRight,
  Campfire,
  CheckCircle,
  Church,
  IdentificationBadge,
  MagnifyingGlass,
  SunHorizon,
  UserCheck,
  UserPlus,
  Users,
  WarningCircle,
} from "@phosphor-icons/react";

export const Route = createFileRoute("/_authenticated/register")({
  head: () => ({ meta: [{ title: "Register attendee — Inspired for Change" }] }),
  component: RegisterPage,
});

const registrationSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required").max(80),
  middle_name: z.string().trim().max(80).optional(),
  last_name: z.string().trim().min(1, "Last name is required").max(80),
  gender: z.enum(["male", "female"], {
    errorMap: () => ({ message: "Please select Male or Female for sanctuary & dorm records" }),
  }),
  age_group: z.enum(["child", "youth", "young_adult", "adult", "elder"]),
  ministry_role: z.enum([
    "member",
    "visitor",
    "first_timer",
    "pastor",
    "leader",
    "choir_media",
    "volunteer",
  ]),
  origin: z.string().trim().min(1, "City or region is required").max(120),
  church_name: z.string().trim().max(140).optional(),
  phone: z.string().trim().max(40).optional(),
  is_shared_phone: z.boolean(),
  guardian_name: z.string().trim().max(120).optional(),
  email: z.string().trim().email("Enter a valid email address").or(z.literal("")).optional(),
  status: z.enum(["camping", "not_camping"]),
  accommodation_zone: z.string().trim().max(120).optional(),
  dietary_medical: z.string().trim().max(300).optional(),
  days_registered: z.array(z.number().int().min(1)).min(1, "Select at least one attendance day"),
});

function RegisterPage() {
  const { selected } = useEvents();
  const { user } = useAuth();
  const navigate = useNavigate();

  const totalDays = selected?.total_days || 3;
  const dayOptions = useMemo(
    () => Array.from({ length: totalDays }, (_, i) => i + 1),
    [totalDays],
  );

  const [eventGuests, setEventGuests] = useState<Guest[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showLookup, setShowLookup] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [createdGuest, setCreatedGuest] = useState<Guest | null>(null);
  const [checkInNowDay, setCheckInNowDay] = useState<number | null>(1);
  const [zoneManuallyEdited, setZoneManuallyEdited] = useState(false);

  const [form, setForm] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    gender: "male" as Gender,
    age_group: "adult" as AgeGroup,
    ministry_role: "member" as MinistryRole,
    origin: "",
    church_name: "",
    phone: "",
    is_shared_phone: false,
    guardian_name: "",
    email: "",
    household_id: null as string | null,
    status: "not_camping" as GuestStatus,
    accommodation_zone: "",
    dietary_medical: "",
    days_registered: [1] as number[],
  });

  const refreshEventGuests = async () => {
    if (!selected) return;
    const { data } = await supabase.from("guests").select("*").eq("event_id", selected.id);
    setEventGuests((data as unknown as Guest[]) ?? []);
  };

  useEffect(() => {
    refreshEventGuests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  // Keep suggested dormitory zone synced with gender + camping + age_group unless manually customized
  useEffect(() => {
    if (zoneManuallyEdited) return;
    const suggested = suggestAccommodationZone(form.gender, form.status, form.age_group) ?? "";
    setForm((prev) => ({ ...prev, accommodation_zone: suggested }));
  }, [form.gender, form.status, form.age_group, zoneManuallyEdited]);

  const lookupResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return eventGuests
      .filter((g) =>
        [g.reg_code, g.first_name, g.middle_name, g.last_name, formatFullName(g), g.phone, g.church_name]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)),
      )
      .slice(0, 6);
  }, [eventGuests, searchQuery]);

  // Smart Household & Identity Analysis (never blocks shared family phones!)
  const phoneMatches = useMemo(() => {
    const clean = form.phone.replace(/\s+/g, "");
    if (clean.length < 5) return [];
    return eventGuests.filter((g) => g.phone.replace(/\s+/g, "") === clean);
  }, [eventGuests, form.phone]);

  const exactPersonMatch = useMemo(() => {
    const fn = form.first_name.trim().toLowerCase();
    const ln = form.last_name.trim().toLowerCase();
    const mn = form.middle_name.trim().toLowerCase();
    if (!fn || !ln) return null;
    return (
      eventGuests.find(
        (g) =>
          g.first_name.trim().toLowerCase() === fn &&
          g.last_name.trim().toLowerCase() === ln &&
          (g.middle_name ?? "").trim().toLowerCase() === mn,
      ) ?? null
    );
  }, [eventGuests, form.first_name, form.last_name, form.middle_name]);

  const toggleDay = (dayNum: number) => {
    setForm((prev) => {
      const exists = prev.days_registered.includes(dayNum);
      const next = exists
        ? prev.days_registered.filter((d) => d !== dayNum)
        : [...prev.days_registered, dayNum].sort((a, b) => a - b);
      return { ...prev, days_registered: next };
    });
  };

  const selectAllDays = () => {
    setForm((prev) => ({ ...prev, days_registered: [...dayOptions] }));
  };

  const linkToHousehold = (anchorGuest: Guest) => {
    const sharedHouseholdId = anchorGuest.household_id || anchorGuest.id;
    setForm((prev) => ({
      ...prev,
      origin: prev.origin || anchorGuest.origin,
      church_name: prev.church_name || anchorGuest.church_name || "",
      phone: anchorGuest.phone,
      is_shared_phone: true,
      household_id: sharedHouseholdId,
      guardian_name:
        prev.age_group === "child" && !prev.guardian_name
          ? formatFullName(anchorGuest)
          : prev.guardian_name,
    }));
    setSearchQuery("");
    setShowLookup(false);
    toast.info(`Linked to ${formatFullName(anchorGuest)}'s household`);
  };

  const addDayToExistingGuest = async (existing: Guest, targetDay: number) => {
    if (!user) return;
    const mergedDays = Array.from(new Set([...(existing.days_registered || []), targetDay])).sort(
      (a, b) => a - b,
    );
    const nextCheckIns = {
      ...(existing.check_ins ?? {}),
      [String(targetDay)]: new Date().toISOString(),
    };
    const { error: err } = await supabase
      .from("guests")
      .update({
        days_registered: mergedDays,
        check_ins: nextCheckIns as any,
        updated_by: user.id,
      } as any)
      .eq("id", existing.id);

    if (err) {
      toast.error("Could not update existing attendee");
      return;
    }
    toast.success(`Checked in ${formatFullName(existing)} (${existing.reg_code}) for Day ${targetDay}`);
    navigate({ to: "/guests/$id", params: { id: existing.id } });
  };

  const handleSubmit = async (e: React.FormEvent, mode: "pass" | "household" | "fresh") => {
    e.preventDefault();
    setError("");
    if (!selected || !user) return;

    const parsed = registrationSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    if (exactPersonMatch) {
      setError(
        `${formatFullName(exactPersonMatch)} (${exactPersonMatch.reg_code}) is already registered in this event. Open their profile below to add days or check them in instead of creating a duplicate person.`,
      );
      return;
    }

    setSaving(true);
    const initialCheckIns: Record<string, string> = {};
    if (checkInNowDay && parsed.data.days_registered.includes(checkInNowDay)) {
      initialCheckIns[String(checkInNowDay)] = new Date().toISOString();
    }

    const householdId =
      form.household_id ||
      (parsed.data.is_shared_phone && phoneMatches[0]
        ? phoneMatches[0].household_id || phoneMatches[0].id
        : parsed.data.is_shared_phone
          ? crypto.randomUUID()
          : null);

    const { data, error: insertErr } = await supabase
      .from("guests")
      .insert({
        event_id: selected.id,
        household_id: householdId,
        first_name: parsed.data.first_name,
        middle_name: parsed.data.middle_name || null,
        last_name: parsed.data.last_name,
        gender: parsed.data.gender,
        age_group: parsed.data.age_group,
        ministry_role: parsed.data.ministry_role,
        origin: parsed.data.origin,
        church_name: parsed.data.church_name || null,
        phone: parsed.data.phone || "",
        is_shared_phone: parsed.data.is_shared_phone || phoneMatches.length > 0,
        guardian_name: parsed.data.guardian_name || null,
        email: parsed.data.email || null,
        status: parsed.data.status,
        accommodation_zone:
          parsed.data.status === "camping"
            ? parsed.data.accommodation_zone ||
              suggestAccommodationZone(parsed.data.gender, parsed.data.status, parsed.data.age_group)
            : null,
        dietary_medical: parsed.data.dietary_medical || null,
        day: parsed.data.days_registered[0] ?? 1,
        days_registered: parsed.data.days_registered,
        check_ins: initialCheckIns as any,
        created_by: user.id,
        updated_by: user.id,
      } as any)
      .select()
      .single();

    setSaving(false);

    if (insertErr || !data) {
      setError(insertErr?.message || "Could not complete registration.");
      return;
    }

    const saved = data as unknown as Guest;
    await refreshEventGuests();
    toast.success(`Registered ${formatFullName(saved)} · Badge ${saved.reg_code}`);

    if (mode === "pass") {
      setCreatedGuest(saved);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (mode === "household") {
      const nextHouseholdId = saved.household_id || saved.id;
      setCreatedGuest(null);
      setZoneManuallyEdited(false);
      setForm((prev) => ({
        ...prev,
        first_name: "",
        middle_name: "",
        gender: prev.gender === "male" ? "female" : "male",
        is_shared_phone: Boolean(prev.phone),
        household_id: nextHouseholdId,
        guardian_name: formatFullName(saved),
        dietary_medical: "",
      }));
    } else {
      setCreatedGuest(null);
      setZoneManuallyEdited(false);
      setForm((prev) => ({
        ...prev,
        first_name: "",
        middle_name: "",
        last_name: "",
        phone: "",
        is_shared_phone: false,
        household_id: null,
        guardian_name: "",
        email: "",
        dietary_medical: "",
      }));
    }
  };

  if (!selected) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Loading registration desk…</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            {selected.name} · Badge prefix <span className="font-mono-code font-semibold text-foreground">{selected.code}</span>
          </p>
          <h1 className="mt-1">Attendee registration</h1>
        </div>
        <Link
          to="/checkin"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground no-underline hover:border-accent/50"
        >
          <UserCheck size={15} className="text-accent" aria-hidden="true" />
          Switch to fast gate check-in
        </Link>
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
