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
              onClick={() => setEditing(true)}
              className="text-sm text-accent hover:underline"
            >
              Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setEditing(false);
                  setForm(guest);
                }}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                disabled={saving}
                onClick={save}
                className="text-sm px-4 py-1.5 rounded-full bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          )}
        </div>

        {editing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input label="First name" value={form.first_name ?? ""} onChange={(v) => setForm({ ...form, first_name: v })} />
              <Input label="Middle name" value={form.middle_name ?? ""} onChange={(v) => setForm({ ...form, middle_name: v })} />
              <Input label="Last name" value={form.last_name ?? ""} onChange={(v) => setForm({ ...form, last_name: v })} />
            </div>
            <Input label="Origin" value={form.origin ?? ""} onChange={(v) => setForm({ ...form, origin: v })} />
            <Input label="Phone" value={form.phone ?? ""} onChange={(v) => setForm({ ...form, phone: v })} />
            <div>
              <label className="block text-sm font-medium mb-2">Day</label>
              <select
                value={form.day ?? ""}
                onChange={(e) => setForm({ ...form, day: e.target.value ? parseInt(e.target.value) : null })}
                className="w-full px-4 py-3 rounded-xl bg-input border border-border focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Not specified</option>
                <option value="1">Day 1</option>
                <option value="2">Day 2</option>
                <option value="3">Day 3</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Status</label>
              <div className="grid grid-cols-2 gap-3">
                {(["camping", "not_camping"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setForm({ ...form, status: s })}
                    className={`px-4 py-3 rounded-xl border text-sm font-medium ${
                      form.status === s
                        ? "bg-accent text-accent-foreground border-accent"
                        : "bg-secondary border-border"
                    }`}
                  >
                    {s === "camping" ? "Camping" : "Not camping"}
                  </button>
                ))}
              </div>
            </div>
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 px-4 py-3 rounded-xl">{error}</div>
            )}
          </div>
        ) : (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
            <Detail label="Phone" value={guest.phone} />
            <Detail label="Origin" value={guest.origin} />
            <Detail label="Day" value={guest.day ? `Day ${guest.day}` : "Not specified"} />
            <Detail label="Status" value={guest.status === "camping" ? "Camping" : "Not camping"} />
            <Detail label="Registered" value={new Date(guest.created_at).toLocaleString()} />
            <Detail label="Last updated" value={new Date(guest.updated_at).toLocaleString()} />
          </dl>
        )}
      </div>

      <div className="flex justify-end mt-4">
        <button
          onClick={remove}
          className="text-sm text-destructive hover:underline"
        >
          Delete guest
        </button>
      </div>

      <div className="mt-10">
        <h2 className="text-lg mb-4">Edit history</h2>
        <div className="surface-card divide-y divide-border">
          {history.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No history yet.</div>
          ) : (
            history.map((h) => {
              const who = h.edited_by ? profiles[h.edited_by]?.display_name ?? "Unknown" : "System";
              return (
                <div key={h.id} className="p-5">
                  <div className="flex items-baseline justify-between gap-3 mb-2">
                    <div className="text-sm">
                      <span className="font-medium">{who}</span>{" "}
                      <span className="text-muted-foreground">
                        {h.action === "create" ? "registered this guest" : "made changes"}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(h.edited_at), { addSuffix: true })}
                    </div>
                  </div>
                  {h.action === "update" && (
                    <ul className="text-sm space-y-1 mt-2">
                      {Object.entries(h.changes as Record<string, { from: unknown; to: unknown }>).map(
                        ([k, v]) => (
                          <li key={k} className="text-muted-foreground">
                            <span className="capitalize text-foreground">{k.replace("_", " ")}</span>:{" "}
                            <span className="line-through">{String(v.from ?? "—")}</span> →{" "}
                            <span className="text-foreground">{String(v.to ?? "—")}</span>
                          </li>
                        ),
                      )}
                    </ul>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-1">{value}</dd>
    </div>
  );
}

function Input({
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
      <label className="block text-sm font-medium mb-2">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 rounded-xl bg-input border border-border focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}
