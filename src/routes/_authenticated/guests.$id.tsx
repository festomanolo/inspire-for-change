import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useEvents } from "@/hooks/use-events";
import {
  AGE_GROUP_LABELS,
  GENDER_LABELS,
  MINISTRY_ROLE_LABELS,
  formatFullName,
  isCheckedInForDay,
  suggestAccommodationZone,
  type AgeGroup,
  type Gender,
  type Guest,
  type GuestEdit,
  type MinistryRole,
  type Profile,
} from "@/lib/types";
import { QrBadgePass } from "@/components/QrBadgePass";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  CheckCircle,
  Copy,
  PencilSimple,
  Trash,
  Users,
} from "@phosphor-icons/react";

export const Route = createFileRoute("/_authenticated/guests/$id")({
  head: () => ({ meta: [{ title: "Attendee Pass & Record — Inspired for Change" }] }),
  component: GuestDetailPage,
});

function GuestDetailPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const { events, selected } = useEvents();
  const navigate = useNavigate();

  const [guest, setGuest] = useState<Guest | null>(null);
  const [householdPeers, setHouseholdPeers] = useState<Guest[]>([]);
  const [history, setHistory] = useState<GuestEdit[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Guest>>({});
  const [saving, setSaving] = useState(false);
  const [copiedUuid, setCopiedUuid] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const load = async () => {
    const { data: g } = await supabase.from("guests").select("*").eq("id", id).maybeSingle();
    const guestRecord = (g as unknown as Guest) ?? null;
    setGuest(guestRecord);
    if (guestRecord) {
      setForm(guestRecord);

      // Find household members sharing household_id or phone in the same event
      const { data: allEventGuests } = await supabase
        .from("guests")
        .select("*")
        .eq("event_id", guestRecord.event_id);
      const peers = ((allEventGuests as unknown as Guest[]) ?? []).filter(
        (other) =>
          other.id !== guestRecord.id &&
          ((guestRecord.household_id && other.household_id === guestRecord.household_id) ||
            (guestRecord.phone && other.phone === guestRecord.phone)),
      );
      setHouseholdPeers(peers);
    }

    const { data: h } = await supabase
      .from("guest_edits")
      .select("*")
      .eq("guest_id", id)
      .order("edited_at", { ascending: false });
    setHistory((h as unknown as GuestEdit[]) ?? []);

    const { data: ps } = await supabase.from("profiles").select("*");
    const map: Record<string, Profile> = {};
    ((ps as unknown as Profile[]) ?? []).forEach((p) => {
      map[p.id] = p;
    });
    setProfiles(map);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("guest-" + id)
      .on("postgres_changes", { event: "*", schema: "public", table: "guests" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "guest_edits" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const guestEvent = events.find((e) => e.id === guest?.event_id) ?? selected;
  const totalDays = guestEvent?.total_days || 3;
  const dayOptions = Array.from({ length: totalDays }, (_, i) => i + 1);

  const handleCopyUuid = () => {
    if (!guest) return;
    navigator.clipboard.writeText(guest.id);
    setCopiedUuid(true);
    toast.success("UUID copied to clipboard");
    setTimeout(() => setCopiedUuid(false), 1800);
  };

  const toggleDayCheckIn = async (dayNum: number) => {
    if (!user || !guest) return;
    const checked = isCheckedInForDay(guest, dayNum);
    const nextCheckIns = { ...(guest.check_ins ?? {}) };
    const nextDays = new Set<number>(guest.days_registered ?? [1]);

    if (checked) {
      delete nextCheckIns[String(dayNum)];
    } else {
      nextCheckIns[String(dayNum)] = new Date().toISOString();
      nextDays.add(dayNum);
    }

    const { error } = await supabase
      .from("guests")
      .update({
        check_ins: nextCheckIns as any,
        days_registered: Array.from(nextDays).sort((a, b) => a - b),
        updated_by: user.id,
      } as any)
      .eq("id", guest.id);

    if (error) {
      toast.error("Failed to update check-in");
      return;
    }
    toast.success(checked ? `Cleared Day ${dayNum} check-in` : `Checked in for Day ${dayNum}`);
    await load();
  };

  const saveChanges = async () => {
    if (!user || !guest) return;
    setSaving(true);
    const nextStatus = form.status || "not_camping";
    const nextGender = (form.gender || "unspecified") as Gender;
    const nextAge = (form.age_group || "adult") as AgeGroup;

    const { error: err } = await supabase
      .from("guests")
      .update({
        first_name: form.first_name,
        middle_name: form.middle_name || null,
        last_name: form.last_name,
        gender: nextGender,
        age_group: nextAge,
        ministry_role: form.ministry_role || "member",
        church_name: form.church_name || null,
        origin: form.origin,
        phone: form.phone || "",
        is_shared_phone: Boolean(form.is_shared_phone),
        guardian_name: form.guardian_name || null,
        status: nextStatus,
        accommodation_zone:
          nextStatus === "camping"
            ? form.accommodation_zone || suggestAccommodationZone(nextGender, nextStatus, nextAge)
            : null,
        dietary_medical: form.dietary_medical || null,
        days_registered: form.days_registered?.length ? form.days_registered : [1],
        updated_by: user.id,
      } as any)
      .eq("id", guest.id);

    setSaving(false);
    if (err) {
      toast.error(err.message || "Failed to save attendee record");
      return;
    }
    setEditing(false);
    toast.success("Attendee profile updated");
    await load();
  };

  const handleDelete = async () => {
    if (!guest) return;
    await supabase.from("guests").delete().eq("id", guest.id);
    toast.success("Attendee record deleted");
    navigate({ to: "/guests" });
  };

  if (!guest) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Loading attendee profile…</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="no-print flex items-center justify-between">
        <Link
          to="/guests"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground no-underline hover:text-foreground"
        >
          <ArrowLeft size={15} aria-hidden="true" />
          Back to directory
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyUuid}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 font-mono-code text-xs text-muted-foreground hover:text-foreground"
          >
            {copiedUuid ? <Check size={13} className="text-success" /> : <Copy size={13} />}
            UUID: {guest.id.slice(0, 8)}…
          </button>
        </div>
      </div>

      {/* Printable Lanyard Credential & QR Pass */}
      <QrBadgePass guest={guest} event={guestEvent} />

      {/* Interactive Gate Check-in Controls */}
      <div className="no-print surface-card p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-sm font-bold text-foreground">Daily gate check-in</h2>
            <p className="text-xs text-muted-foreground">
              Tap a day to record or revert physical sanctuary arrival.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {dayOptions.map((d) => {
              const checked = isCheckedInForDay(guest, d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDayCheckIn(d)}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold ${
                    checked
                      ? "border-success/35 bg-success/12 text-success"
                      : "border-border bg-secondary text-foreground hover:border-accent/40"
                  }`}
                >
                  <CheckCircle size={15} weight={checked ? "fill" : "regular"} aria-hidden="true" />
                  {checked ? `Day ${d} verified` : `Check in Day ${d}`}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Full Church Profile Details / Edit Mode */}
      <div className="no-print surface-card p-6 sm:p-7">
        <div className="mb-5 flex items-center justify-between border-b border-border pb-3">
          <h2 className="text-base font-bold text-foreground">Attendee & ministry details</h2>
          {!editing ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-secondary px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
            >
              <PencilSimple size={14} aria-hidden="true" />
              Edit record
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setForm(guest);
                }}
                className="cursor-pointer rounded-full border border-border bg-secondary px-3.5 py-1.5 text-xs font-semibold text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={saveChanges}
                className="cursor-pointer rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          )}
        </div>

        {editing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <EditField
                label="First name"
                value={form.first_name ?? ""}
                onChange={(v) => setForm({ ...form, first_name: v })}
              />
              <EditField
                label="Middle name"
                value={form.middle_name ?? ""}
                onChange={(v) => setForm({ ...form, middle_name: v })}
              />
              <EditField
                label="Last name"
                value={form.last_name ?? ""}
                onChange={(v) => setForm({ ...form, last_name: v })}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-foreground">Gender</label>
                <select
                  value={form.gender ?? "unspecified"}
                  onChange={(e) => setForm({ ...form, gender: e.target.value as Gender })}
                  className="w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="unspecified">Not recorded</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-foreground">Age bracket</label>
                <select
                  value={form.age_group ?? "adult"}
                  onChange={(e) => setForm({ ...form, age_group: e.target.value as AgeGroup })}
                  className="w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm"
                >
                  {Object.entries(AGE_GROUP_LABELS).map(([k, lbl]) => (
                    <option key={k} value={k}>
                      {lbl}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-foreground">Ministry role</label>
                <select
                  value={form.ministry_role ?? "member"}
                  onChange={(e) => setForm({ ...form, ministry_role: e.target.value as MinistryRole })}
                  className="w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm"
                >
                  {Object.entries(MINISTRY_ROLE_LABELS).map(([k, lbl]) => (
                    <option key={k} value={k}>
                      {lbl}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <EditField
                label="Home church / Parish"
                value={form.church_name ?? ""}
                onChange={(v) => setForm({ ...form, church_name: v })}
              />
              <EditField
                label="Origin / City"
                value={form.origin ?? ""}
                onChange={(v) => setForm({ ...form, origin: v })}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <EditField
                label="Phone number"
                value={form.phone ?? ""}
                onChange={(v) => setForm({ ...form, phone: v })}
              />
              <EditField
                label="Guardian / Next-of-kin"
                value={form.guardian_name ?? ""}
                onChange={(v) => setForm({ ...form, guardian_name: v })}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-foreground">Accommodation</label>
                <select
                  value={form.status ?? "not_camping"}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value as "camping" | "not_camping" })
                  }
                  className="w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm"
                >
                  <option value="not_camping">Day commuter</option>
                  <option value="camping">Camping on-site</option>
                </select>
              </div>
              <EditField
                label="Dormitory / Camp zone"
                value={form.accommodation_zone ?? ""}
                onChange={(v) => setForm({ ...form, accommodation_zone: v })}
              />
            </div>

            <div>
              <span className="mb-1.5 block text-xs font-semibold text-foreground">Registered days</span>
              <div className="flex flex-wrap gap-2">
                {dayOptions.map((d) => {
                  const active = (form.days_registered ?? []).includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        const curr = form.days_registered ?? [];
                        const next = active ? curr.filter((x) => x !== d) : [...curr, d].sort((a, b) => a - b);
                        if (next.length > 0) setForm({ ...form, days_registered: next });
                      }}
                      className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-secondary text-foreground"
                      }`}
                    >
                      Day {d}
                    </button>
                  );
                })}
              </div>
            </div>

            <EditField
              label="Dietary, medical, or pastoral notes"
              value={form.dietary_medical ?? ""}
              onChange={(v) => setForm({ ...form, dietary_medical: v })}
            />
          </div>
        ) : (
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-3">
            <InfoItem label="Badge code" value={guest.reg_code} mono />
            <InfoItem label="Canonical UUID" value={guest.id} mono />
            <InfoItem label="Gender" value={GENDER_LABELS[guest.gender] || "Not recorded"} />
            <InfoItem label="Age bracket" value={AGE_GROUP_LABELS[guest.age_group] || guest.age_group} />
            <InfoItem label="Ministry role" value={MINISTRY_ROLE_LABELS[guest.ministry_role] || "Member"} />
            <InfoItem label="Home church / Parish" value={guest.church_name || "Not specified"} />
            <InfoItem label="City / Region" value={guest.origin || "—"} />
            <InfoItem
              label="Phone contact"
              value={
                guest.phone
                  ? `${guest.phone}${guest.is_shared_phone ? " (Shared household)" : ""}`
                  : "None (uses household/badge)"
              }
              mono={Boolean(guest.phone)}
            />
            <InfoItem label="Guardian / Emergency" value={guest.guardian_name || "—"} />
            <InfoItem
              label="Accommodation"
              value={
                guest.status === "camping"
                  ? `Camping · ${guest.accommodation_zone || "General"}`
                  : "Day commuter"
              }
            />
            <InfoItem
              label="Registered days"
              value={(guest.days_registered?.length ? guest.days_registered : [1])
                .map((d) => `Day ${d}`)
                .join(", ")}
            />
            <InfoItem label="Welfare & pastoral notes" value={guest.dietary_medical || "None"} />
          </dl>
        )}
      </div>

      {/* Linked Household Members */}
      {householdPeers.length > 0 && (
        <div className="no-print surface-card p-6">
          <div className="mb-3 flex items-center gap-2">
            <Users size={17} className="text-accent" aria-hidden="true" />
            <h2 className="text-sm font-bold text-foreground">
              Linked household & family members ({householdPeers.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {householdPeers.map((peer) => (
              <Link
                key={peer.id}
                to="/guests/$id"
                params={{ id: peer.id }}
                className="flex items-center justify-between rounded-xl border border-border bg-secondary/50 px-4 py-3 text-xs no-underline hover:bg-secondary"
              >
                <div>
                  <span className="block font-semibold text-foreground">{formatFullName(peer)}</span>
                  <span className="text-muted-foreground">
                    {GENDER_LABELS[peer.gender]} · {AGE_GROUP_LABELS[peer.age_group]}
                  </span>
                </div>
                <span className="font-mono-code font-semibold text-accent">{peer.reg_code}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Audit Trail */}
      <div className="no-print surface-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground">Verification & edit history</h2>
          <span className="text-xs text-muted-foreground">{history.length} logged events</span>
        </div>

        {history.length === 0 ? (
          <p className="text-xs text-muted-foreground">No audit entries recorded yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {history.map((h) => {
              const actor = h.edited_by ? profiles[h.edited_by]?.display_name ?? "Registrar" : "System";
              return (
                <li key={h.id} className="py-3 text-xs first:pt-0 last:pb-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <div>
                      <span className="font-semibold text-foreground">{actor}</span>{" "}
                      <span className="text-muted-foreground">
                        {h.action === "create"
                          ? "issued registration pass"
                          : h.action === "check_in"
                            ? "updated gate check-in"
                            : h.action === "merge"
                              ? "consolidated multi-day records"
                              : "updated profile fields"}
                      </span>
                    </div>
                    <span className="text-muted-foreground">
                      {formatDistanceToNow(new Date(h.edited_at), { addSuffix: true })}
                    </span>
                  </div>
                  {h.action === "update" && h.changes && (
                    <ul className="mt-1.5 space-y-1 pl-3 text-muted-foreground">
                      {Object.entries(h.changes as Record<string, { from: unknown; to: unknown }>).map(
                        ([field, delta]) => (
                          <li key={field}>
                            <span className="font-medium text-foreground">{field.replace(/_/g, " ")}</span>:{" "}
                            <span className="line-through">{JSON.stringify(delta?.from ?? "—")}</span> →{" "}
                            <span className="text-foreground">{JSON.stringify(delta?.to ?? "—")}</span>
                          </li>
                        ),
                      )}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Danger Zone */}
      <div className="no-print flex justify-end">
        {!confirmRemove ? (
          <button
            type="button"
            onClick={() => setConfirmRemove(true)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-destructive/25 bg-destructive/8 px-4 py-2 text-xs font-semibold text-destructive hover:bg-destructive/15"
          >
            <Trash size={14} aria-hidden="true" />
            Delete attendee record
          </button>
        ) : (
          <div className="flex items-center gap-2 rounded-full border border-destructive/30 bg-destructive/10 px-4 py-1.5 text-xs">
            <span className="font-semibold text-destructive">Confirm permanent deletion?</span>
            <button
              type="button"
              onClick={handleDelete}
              className="cursor-pointer rounded-full bg-destructive px-3 py-1 font-semibold text-destructive-foreground"
            >
              Yes, delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmRemove(false)}
              className="cursor-pointer rounded-full bg-card px-3 py-1 font-semibold text-foreground"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`mt-0.5 truncate text-sm font-medium text-foreground ${mono ? "font-mono-code" : ""}`} title={value}>
        {value}
      </dd>
    </div>
  );
}

function EditField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-foreground">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-border bg-input px-3.5 py-2.5 text-sm text-foreground"
      />
    </div>
  );
}
