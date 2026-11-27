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

      {/* Newly Issued Credential Banner */}
      {createdGuest && (
        <div className="slide-up space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-xs text-foreground">
            <div className="flex items-center gap-2 font-semibold text-success">
              <CheckCircle size={17} weight="fill" aria-hidden="true" />
              <span>
                Issued unique UUID & pass {createdGuest.reg_code} for {formatFullName(createdGuest)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/guests/$id"
                params={{ id: createdGuest.id }}
                className="font-semibold text-foreground underline"
              >
                Open full record
              </Link>
              <button
                type="button"
                onClick={() => setCreatedGuest(null)}
                className="cursor-pointer rounded-lg bg-card px-3 py-1 font-semibold text-foreground"
              >
                Register next person
              </button>
            </div>
          </div>
          <QrBadgePass guest={createdGuest} event={selected} />
        </div>
      )}

      {/* Returning Attendee or Household Member Lookup */}
      <div className="surface-card p-4 sm:p-5">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <label htmlFor="guest-search-input" className="block text-xs font-semibold text-foreground">
              Find existing attendee or link family household
            </label>
            <p className="text-xs text-muted-foreground">
              Check in a returning attendee for a new day or link a spouse/child sharing a phone number.
            </p>
          </div>
          {form.household_id && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/12 px-3 py-1 font-mono-code text-xs font-semibold text-accent">
              <Users size={14} aria-hidden="true" />
              Household linked ({form.household_id.slice(0, 6)})
            </span>
          )}
        </div>

        <div className="relative mt-3">
          <MagnifyingGlass
            size={16}
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            id="guest-search-input"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowLookup(true);
            }}
            onFocus={() => setShowLookup(true)}
            placeholder="Search by name, badge code (IFC-26-0001), church, or phone…"
            className="w-full rounded-xl border border-border bg-input py-2.5 pr-4 pl-10 text-sm text-foreground"
          />

          {showLookup && lookupResults.length > 0 && (
            <div className="scale-in surface-elevated absolute z-20 mt-2 w-full divide-y divide-border overflow-hidden">
              {lookupResults.map((g) => (
                <div
                  key={g.id}
                  className="flex flex-col justify-between gap-2 px-4 py-3 hover:bg-secondary/50 sm:flex-row sm:items-center"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-secondary px-1.5 py-0.5 font-mono-code text-xs font-semibold">
                        {g.reg_code}
                      </span>
                      <span className="text-sm font-semibold text-foreground">{formatFullName(g)}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {g.church_name || g.origin} {g.phone ? `· ${g.phone}` : ""} · Days{" "}
                      {(g.days_registered || [g.day]).filter(Boolean).join(", ")}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => linkToHousehold(g)}
                      className="cursor-pointer rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary"
                    >
                      Link family member
                    </button>
                    <Link
                      to="/guests/$id"
                      params={{ id: g.id }}
                      className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground no-underline"
                    >
                      Open profile
                      <ArrowRight size={12} aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Registration Form */}
      <div className="bezel-shell">
        <form
          onSubmit={(e) => handleSubmit(e, "pass")}
          className="bezel-core space-y-7 p-5 sm:p-8"
        >
          {/* Section 1: Personal Identity & Demographics */}
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2.5">
              <h2 className="text-base font-bold text-foreground">1. Personal identity & demographics</h2>
              <span className="inline-flex items-center gap-1 font-mono-code text-xs text-muted-foreground">
                <IdentificationBadge size={14} className="text-accent" aria-hidden="true" />
                UUID v4 auto-assigned
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="reg-first-name" className="mb-1.5 block text-xs font-semibold text-foreground">
                  First name <span className="text-accent">*</span>
                </label>
                <input
                  id="reg-first-name"
                  required
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  placeholder="e.g. Neema"
                  className="w-full rounded-xl border border-border bg-input px-3.5 py-2.5 text-sm text-foreground"
                />
              </div>

              <div>
                <label htmlFor="reg-middle-name" className="mb-1.5 block text-xs font-semibold text-foreground">
                  Middle name
                </label>
                <input
                  id="reg-middle-name"
                  value={form.middle_name}
                  onChange={(e) => setForm({ ...form, middle_name: e.target.value })}
                  placeholder="Optional"
                  className="w-full rounded-xl border border-border bg-input px-3.5 py-2.5 text-sm text-foreground"
                />
              </div>

              <div>
                <label htmlFor="reg-last-name" className="mb-1.5 block text-xs font-semibold text-foreground">
                  Last name / Surname <span className="text-accent">*</span>
                </label>
                <input
                  id="reg-last-name"
                  required
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  placeholder="e.g. Mwakasege"
                  className="w-full rounded-xl border border-border bg-input px-3.5 py-2.5 text-sm text-foreground"
                />
              </div>
            </div>

            {/* Exact Same Person Alert */}
            {exactPersonMatch && (
              <div className="scale-in flex flex-col justify-between gap-3 rounded-xl border border-warm/40 bg-warm/10 p-3.5 text-xs sm:flex-row sm:items-center">
                <div className="flex items-start gap-2.5">
                  <WarningCircle size={18} className="mt-0.5 shrink-0 text-warm" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-foreground">
                      {formatFullName(exactPersonMatch)} ({exactPersonMatch.reg_code}) is already registered
                    </p>
                    <p className="text-muted-foreground">
                      Instead of creating a duplicate row, check them in for another day on their single UUID profile.
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  {dayOptions.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => addDayToExistingGuest(exactPersonMatch, d)}
                      className="cursor-pointer rounded-lg bg-primary px-2.5 py-1.5 font-semibold text-primary-foreground"
                    >
                      + Check in Day {d}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {/* Gender */}
              <div>
                <span className="mb-1.5 block text-xs font-semibold text-foreground">
                  Gender <span className="text-accent">*</span>
                </span>
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Gender">
                  {(["male", "female"] as const).map((g) => {
                    const active = form.gender === g;
                    return (
                      <button
                        key={g}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setForm({ ...form, gender: g })}
                        className={`cursor-pointer rounded-xl border px-3 py-2.5 text-sm font-semibold capitalize ${
                          active
                            ? "border-primary bg-primary text-primary-foreground shadow-xs"
                            : "border-border bg-secondary/70 text-foreground hover:bg-secondary"
                        }`}
                      >
                        {g}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Age Bracket */}
              <div>
                <label htmlFor="reg-age-group" className="mb-1.5 block text-xs font-semibold text-foreground">
                  Age bracket
                </label>
                <select
                  id="reg-age-group"
                  value={form.age_group}
                  onChange={(e) => setForm({ ...form, age_group: e.target.value as AgeGroup })}
                  className="w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm text-foreground"
                >
                  {Object.entries(AGE_GROUP_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Ministry Role */}
              <div>
                <label htmlFor="reg-role" className="mb-1.5 block text-xs font-semibold text-foreground">
                  Church / Ministry role
                </label>
                <select
                  id="reg-role"
                  value={form.ministry_role}
                  onChange={(e) => setForm({ ...form, ministry_role: e.target.value as MinistryRole })}
                  className="w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm text-foreground"
                >
                  {Object.entries(MINISTRY_ROLE_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Section 2: Parish, Origin & Household-Safe Contact */}
          <section className="space-y-4">
            <div className="border-b border-border pb-2.5">
              <h2 className="text-base font-bold text-foreground">2. Church fellowship & contact</h2>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="reg-church" className="mb-1.5 block text-xs font-semibold text-foreground">
                  Home church / Parish / Branch
                </label>
                <div className="relative">
                  <Church
                    size={16}
                    className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <input
                    id="reg-church"
                    value={form.church_name}
                    onChange={(e) => setForm({ ...form, church_name: e.target.value })}
                    placeholder="e.g. Grace Sanctuary — Mikocheni"
                    className="w-full rounded-xl border border-border bg-input py-2.5 pr-3.5 pl-10 text-sm text-foreground"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reg-origin" className="mb-1.5 block text-xs font-semibold text-foreground">
                  City / Region / Country <span className="text-accent">*</span>
                </label>
                <input
                  id="reg-origin"
                  required
                  value={form.origin}
                  onChange={(e) => setForm({ ...form, origin: e.target.value })}
                  placeholder="e.g. Dar es Salaam, Tanzania"
                  className="w-full rounded-xl border border-border bg-input px-3.5 py-2.5 text-sm text-foreground"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="reg-phone" className="mb-1.5 block text-xs font-semibold text-foreground">
                  Phone number <span className="font-normal text-muted-foreground">(optional · family sharing supported)</span>
                </label>
                <input
                  id="reg-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+255 784 000 000 (leave blank if none)"
                  className="w-full rounded-xl border border-border bg-input px-3.5 py-2.5 font-mono-code text-sm text-foreground"
                />
              </div>

              <div>
                <label htmlFor="reg-guardian" className="mb-1.5 block text-xs font-semibold text-foreground">
                  {form.age_group === "child" ? "Parent / Guardian full name" : "Emergency / Household contact"}
                </label>
                <input
                  id="reg-guardian"
                  value={form.guardian_name}
                  onChange={(e) => setForm({ ...form, guardian_name: e.target.value })}
                  placeholder={form.age_group === "child" ? "Required for children's ministry safety" : "Optional next-of-kin"}
                  required={form.age_group === "child"}
                  className="w-full rounded-xl border border-border bg-input px-3.5 py-2.5 text-sm text-foreground"
                />
              </div>
            </div>

            {/* Non-blocking Shared Family Phone Intelligence */}
            {phoneMatches.length > 0 && !exactPersonMatch && (
              <div className="scale-in flex flex-col justify-between gap-3 rounded-xl border border-accent/30 bg-accent/8 p-3.5 text-xs sm:flex-row sm:items-center">
                <div className="space-y-0.5">
                  <p className="font-semibold text-foreground">
                    Shared phone number with {formatFullName(phoneMatches[0])} ({phoneMatches[0].reg_code})
                  </p>
                  <p className="text-muted-foreground">
                    Phone numbers are not used as unique IDs — you can freely register spouses, children, or group members on the same number.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => linkToHousehold(phoneMatches[0])}
                  className="shrink-0 cursor-pointer rounded-lg border border-accent/40 bg-card px-3 py-1.5 font-semibold text-foreground hover:bg-secondary"
                >
                  Copy church & link household
                </button>
              </div>
            )}
          </section>

          {/* Section 3: Attendance Days, Gate Check-in & Dormitory Accommodation */}
          <section className="space-y-4">
            <div className="border-b border-border pb-2.5">
              <h2 className="text-base font-bold text-foreground">3. Attendance schedule & accommodation</h2>
            </div>

            {/* Multi-day selector */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">
                  Days attending <span className="text-accent">*</span>
                </span>
                <button
                  type="button"
                  onClick={selectAllDays}
                  className="cursor-pointer text-xs font-semibold text-accent hover:underline"
                >
                  Select all {totalDays} days
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {dayOptions.map((d) => {
                  const selectedDay = form.days_registered.includes(d);
                  return (
                    <button
                      key={d}
                      id={`day-btn-${d}`}
                      type="button"
                      onClick={() => toggleDay(d)}
                      className={`cursor-pointer rounded-xl border px-4 py-2.5 text-xs font-semibold ${
                        selectedDay
                          ? "border-primary bg-primary text-primary-foreground shadow-xs"
                          : "border-border bg-secondary/60 text-foreground hover:bg-secondary"
                      }`}
                    >
                      Day {d}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Instant Gate Check-in Selector */}
            <div className="rounded-xl border border-border bg-secondary/50 p-3.5">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                <div>
                  <span className="block text-xs font-semibold text-foreground">
                    Immediate gate check-in
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Mark this attendee as physically arrived right now, or choose Pre-registration only.
                  </span>
                </div>
                <select
                  aria-label="Immediate check-in day"
                  value={checkInNowDay ?? ""}
                  onChange={(e) => setCheckInNowDay(e.target.value ? Number(e.target.value) : null)}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground"
                >
                  <option value="">Pre-register only (not arrived yet)</option>
                  {form.days_registered.map((d) => (
                    <option key={d} value={d}>
                      Check in now for Day {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Accommodation Status + Dorm Zone */}
            {selected.camping_enabled !== false && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <span className="mb-1.5 block text-xs font-semibold text-foreground">
                    Accommodation mode
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {(["not_camping", "camping"] as const).map((s) => {
                      const active = form.status === s;
                      return (
                        <button
                          key={s}
                          id={`status-${s}`}
                          type="button"
                          onClick={() => setForm({ ...form, status: s })}
                          className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold ${
                            active
                              ? "border-primary bg-primary text-primary-foreground shadow-xs"
                              : "border-border bg-secondary/60 text-foreground hover:bg-secondary"
                          }`}
                        >
                          {s === "camping" ? (
                            <>
                              <Campfire size={15} weight={active ? "fill" : "regular"} aria-hidden="true" />
                              Camping on-site
                            </>
                          ) : (
                            <>
                              <SunHorizon size={15} weight={active ? "fill" : "regular"} aria-hidden="true" />
                              Day commuter
                            </>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label htmlFor="reg-zone" className="mb-1.5 block text-xs font-semibold text-foreground">
                    Dormitory / Camp allocation
                  </label>
                  <input
                    id="reg-zone"
                    disabled={form.status !== "camping"}
                    value={form.status === "camping" ? form.accommodation_zone : "Off-site (Day attendee)"}
                    onChange={(e) => {
                      setZoneManuallyEdited(true);
                      setForm({ ...form, accommodation_zone: e.target.value });
                    }}
                    placeholder="Auto-assigned by gender & age"
                    className="w-full rounded-xl border border-border bg-input px-3.5 py-2.5 text-sm text-foreground disabled:opacity-60"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="reg-notes" className="mb-1.5 block text-xs font-semibold text-foreground">
                Dietary, medical, accessibility, or pastoral notes
              </label>
              <input
                id="reg-notes"
                value={form.dietary_medical}
                onChange={(e) => setForm({ ...form, dietary_medical: e.target.value })}
                placeholder="Optional welfare or special care instructions"
                className="w-full rounded-xl border border-border bg-input px-3.5 py-2.5 text-sm text-foreground"
              />
            </div>
          </section>

          {error && (
            <div role="alert" className="scale-in rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs font-medium text-destructive">
              {error}
            </div>
          )}

          {/* Action Bar */}
          <div className="flex flex-col gap-2.5 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <button
                id="reg-save-another-btn"
                type="button"
                disabled={saving}
                onClick={(e) => handleSubmit(e, "fresh")}
                className="cursor-pointer rounded-full border border-border bg-secondary px-4 py-2.5 text-xs font-semibold text-secondary-foreground hover:bg-muted disabled:opacity-50"
              >
                Save & clear for next
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={(e) => handleSubmit(e, "household")}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
              >
                <Users size={15} className="text-accent" aria-hidden="true" />
                Save & add family member
              </button>
            </div>

            <button
              id="reg-save-view-btn"
              type="submit"
              disabled={saving}
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-95 disabled:opacity-50"
            >
              <UserPlus size={17} weight="bold" aria-hidden="true" />
              {saving ? "Registering…" : "Register & issue badge pass"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
