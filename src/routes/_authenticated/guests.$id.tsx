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
    setError("");
    setSaving(true);
    const { error: err } = await supabase
      .from("guests")
      .update({
        first_name: form.first_name,
        middle_name: form.middle_name || null,
        last_name: form.last_name,
        origin: form.origin,
        phone: form.phone,
        status: form.status,
        day: form.day,
        updated_by: user.id,
      })
      .eq("id", guest.id)
      .eq("updated_at", guest.updated_at);
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    setEditing(false);
    toast.success("Guest information updated successfully");
    await load();
  };

  const quickStatusToggle = async () => {
    if (!user || !guest) return;
    const next = guest.status === "camping" ? "not_camping" : "camping";
    await supabase
      .from("guests")
      .update({ status: next, updated_by: user.id })
      .eq("id", guest.id);
    await load();
  };

  const remove = async () => {
    if (!guest || !confirm("Delete this guest? This cannot be undone.")) return;
    await supabase.from("guests").delete().eq("id", guest.id);
    navigate({ to: "/guests" });
  };

  if (!guest) return <div className="text-muted-foreground">Loading…</div>;

  const fullName = [guest.first_name, guest.middle_name, guest.last_name].filter(Boolean).join(" ");

  return (
    <div className="max-w-3xl mx-auto">
      <Link to="/guests" className="text-sm text-muted-foreground hover:text-foreground">
        ← All guests
      </Link>

      <div className="flex items-start justify-between gap-4 mt-4 mb-8">
        <div>
          <h1 className="text-4xl">{fullName}</h1>
          <p className="text-muted-foreground mt-2">{guest.origin}</p>
        </div>
        <button
          onClick={quickStatusToggle}
          className={`text-sm px-4 py-2 rounded-full border transition-all ${
            guest.status === "camping"
              ? "bg-accent text-accent-foreground border-accent"
              : "bg-secondary text-secondary-foreground border-border"
          }`}
        >
          {guest.status === "camping" ? "Camping" : "Not camping"} · tap to switch
        </button>
      </div>

      <div className="surface-elevated p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg">Details</h2>
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
