import { useEffect, useMemo, useState } from "react";
import { EVENT_STUDIO_BUS, useEvents, type EventStudioDetail } from "@/hooks/use-events";
import {
  EVENT_CATEGORY_LABELS,
  EVENT_STATUS_LABELS,
  buildSuggestedEventCode,
  type EventCategory,
  type EventRow,
  type EventStatus,
} from "@/lib/types";
import { toast } from "sonner";
import {
  Buildings,
  CalendarPlus,
  Campfire,
  FloppyDisk,
  IdentificationBadge,
  ListChecks,
  Sparkle,
  X,
} from "@phosphor-icons/react";

const EVENT_PRESETS: {
  id: string;
  label: string;
  category: EventCategory;
  days: number;
  capacity: number;
  camping: boolean;
  venueHint: string;
}[] = [
  {
    id: "conference",
    label: "Conference",
    category: "conference",
    days: 3,
    capacity: 500,
    camping: true,
    venueHint: "Main Auditorium & Grounds",
  },
  {
    id: "camp",
    label: "Youth / Retreat Camp",
    category: "camp",
    days: 4,
    capacity: 350,
    camping: true,
    venueHint: "Retreat Center & Dormitories",
  },
  {
    id: "seminar",
    label: "Seminar / Workshop",
    category: "seminar_workshop",
    days: 2,
    capacity: 200,
    camping: false,
    venueHint: "Conference Hall",
  },
  {
    id: "crusade",
    label: "Outreach / Crusade",
    category: "crusade",
    days: 3,
    capacity: 2000,
    camping: false,
    venueHint: "City Grounds / Open Field",
  },
  {
    id: "summit",
    label: "Leadership Summit",
    category: "leadership_summit",
    days: 2,
    capacity: 300,
    camping: false,
    venueHint: "Executive Sanctuary Hall",
  },
  {
    id: "gala",
    label: "Community / Gala",
    category: "community_gala",
    days: 1,
    capacity: 250,
    camping: false,
    venueHint: "Banquet & Fellowship Hall",
  },
];

export function EventStudioModal() {
  const { events, createEvent, updateEvent } = useEvents();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editingEvent, setEditingEvent] = useState<EventRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);

  const currentYear = new Date().getFullYear();

  const [form, setForm] = useState({
    name: "",
    organizer: "",
    code: "",
    year: currentYear,
    category: "conference" as EventCategory,
    status: "active" as EventStatus,
    total_days: 3,
    capacity: 500,
    venue: "Main Auditorium & Grounds",
    subtitle: "",
    start_date: "",
    end_date: "",
    camping_enabled: true,
  });

  const existingOrganizers = useMemo(() => {
    const set = new Set<string>(["Inspired for Change"]);
    events.forEach((ev) => {
      if (ev.organizer?.trim()) set.add(ev.organizer.trim());
    });
    return Array.from(set);
  }, [events]);

  useEffect(() => {
    const handleOpen = (e: Event) => {
      const detail = (e as CustomEvent<EventStudioDetail>).detail ?? { mode: "create" };
      if (detail.mode === "edit" && detail.event) {
        const ev = detail.event;
        setMode("edit");
        setEditingEvent(ev);
        setCodeManuallyEdited(true);
        setForm({
          name: ev.name,
          organizer: ev.organizer ?? "",
          code: ev.code,
          year: ev.year,
          category: ev.category || "conference",
          status: ev.status || "active",
          total_days: ev.total_days || 3,
          capacity: ev.capacity ?? 500,
          venue: ev.venue ?? "",
          subtitle: ev.subtitle ?? "",
          start_date: ev.start_date ?? "",
          end_date: ev.end_date ?? "",
          camping_enabled: ev.camping_enabled !== false,
        });
      } else {
        const cat = detail.presetCategory || "conference";
        const preset = EVENT_PRESETS.find((p) => p.category === cat) ?? EVENT_PRESETS[0];
        setMode("create");
        setEditingEvent(null);
        setCodeManuallyEdited(false);
        setForm({
          name: "",
          organizer: "",
          code: "",
          year: currentYear,
          category: preset.category,
          status: "active",
          total_days: preset.days,
          capacity: preset.capacity,
          venue: preset.venueHint,
          subtitle: "",
          start_date: "",
          end_date: "",
          camping_enabled: preset.camping,
        });
      }
      setOpen(true);
    };

    if (typeof window !== "undefined") {
      window.addEventListener(EVENT_STUDIO_BUS, handleOpen);
      return () => window.removeEventListener(EVENT_STUDIO_BUS, handleOpen);
    }
  }, [currentYear]);

  // Auto-suggest badge prefix when creating unless manually edited
  useEffect(() => {
    if (mode !== "create" || codeManuallyEdited) return;
    if (!form.name.trim()) {
      setForm((prev) => ({ ...prev, code: "" }));
      return;
    }
    const suggested = buildSuggestedEventCode(form.name, form.year);
    setForm((prev) => ({ ...prev, code: suggested }));
  }, [form.name, form.year, mode, codeManuallyEdited]);

  const applyPreset = (preset: (typeof EVENT_PRESETS)[number]) => {
    setForm((prev) => ({
      ...prev,
      category: preset.category,
      total_days: preset.days,
      capacity: preset.capacity,
      camping_enabled: preset.camping,
      venue: prev.venue || preset.venueHint,
    }));
  };

  const handleDateChange = (field: "start_date" | "end_date", val: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: val };
      if (next.start_date && next.end_date) {
        const start = new Date(next.start_date);
        const end = new Date(next.end_date);
        const diffDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
        if (diffDays >= 1 && diffDays <= 14) {
          next.total_days = diffDays;
        }
      }
      if (field === "start_date" && val) {
        const parsedYear = Number(val.slice(0, 4));
        if (parsedYear >= 2020 && parsedYear <= 2100) {
          next.year = parsedYear;
        }
      }
      return next;
    });
  };

  const previewBadgeCode = useMemo(() => {
    const rawPrefix =
      form.code.trim() ||
      (form.name.trim()
        ? buildSuggestedEventCode(form.name, form.year)
        : `EVT-${String(form.year).slice(-2)}`);
    return `${rawPrefix.toUpperCase().replace(/[^A-Z0-9-]/g, "")}-0001`;
  }, [form.code, form.name, form.year]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Please enter an event title");
      return;
    }

    setSaving(true);
    try {
      const cleanCode = form.code
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9-]/g, "");
      if (mode === "edit" && editingEvent) {
        const updated = await updateEvent(editingEvent.id, {
          name: form.name.trim(),
          organizer: form.organizer.trim() || null,
          code: cleanCode || editingEvent.code,
          year: form.year,
          category: form.category,
          status: form.status,
          total_days: Math.max(1, Math.min(14, form.total_days)),
          capacity: form.capacity || 500,
          venue: form.venue.trim() || null,
          subtitle: form.subtitle.trim() || null,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
          camping_enabled: form.camping_enabled,
        });
        toast.success(`Updated "${updated.name}" (${updated.code})`);
      } else {
        const created = await createEvent({
          name: form.name.trim(),
          organizer: form.organizer.trim() || null,
          code: cleanCode || undefined,
          year: form.year,
          category: form.category,
          status: form.status,
          total_days: Math.max(1, Math.min(14, form.total_days)),
          capacity: form.capacity || 500,
          venue: form.venue.trim() || null,
          subtitle: form.subtitle.trim() || null,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
          camping_enabled: form.camping_enabled,
        });
        toast.success(
          `Created "${created.name}"${created.organizer ? ` · ${created.organizer}` : ""} (${created.code})`,
        );
      }
      setOpen(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not save event");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="no-print fade-in fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/55 p-4 backdrop-blur-xs"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-studio-title"
        className="bezel-shell scale-in my-auto w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <form
          onSubmit={handleSubmit}
          className="bezel-core max-h-[90dvh] space-y-5 overflow-y-auto p-6 sm:p-7"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-accent">
                <CalendarPlus size={15} weight="fill" aria-hidden="true" />
                <span>
                  {mode === "edit" ? "Event configuration" : "Multi-program event studio"}
                </span>
              </div>
              <h2
                id="event-studio-title"
                className="mt-1 text-lg font-bold text-foreground sm:text-xl"
              >
                {mode === "edit" ? `Edit ${editingEvent?.name}` : "Create new event or gathering"}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Host any conference, camp, seminar, outreach, or partner ministry event — not
                limited to Inspired for Change.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close modal"
              className="cursor-pointer rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X size={17} aria-hidden="true" />
            </button>
          </div>

          {/* Quick Templates Strip (Create Mode) */}
          {mode === "create" && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Sparkle size={13} className="text-warm" weight="fill" aria-hidden="true" />
                <span>Quick-start event template</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {EVENT_PRESETS.map((preset) => {
                  const active = form.category === preset.category;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold ${
                        active
                          ? "border-primary bg-primary text-primary-foreground shadow-2xs"
                          : "border-border bg-secondary/70 text-foreground hover:bg-secondary"
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Row 1: Event Title & Host Organization */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="ev-studio-name"
                className="mb-1.5 block text-xs font-semibold text-foreground"
              >
                Event title <span className="text-accent">*</span>
              </label>
              <input
                id="ev-studio-name"
                required
                autoFocus
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. East Africa Youth Summit, Harvest Crusade"
                className="w-full rounded-xl border border-border bg-input px-3.5 py-2.5 text-sm text-foreground"
              />
            </div>

            <div>
              <label
                htmlFor="ev-studio-org"
                className="mb-1.5 block text-xs font-semibold text-foreground"
              >
                Host organization / Ministry / Brand
              </label>
              <div className="relative">
                <Buildings
                  size={15}
                  className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  id="ev-studio-org"
                  list="organizer-suggestions"
                  value={form.organizer}
                  onChange={(e) => setForm({ ...form, organizer: e.target.value })}
                  placeholder="e.g. Kingdom Youth, Grace Parish, or custom host"
                  className="w-full rounded-xl border border-border bg-input py-2.5 pr-3.5 pl-9 text-sm text-foreground"
                />
                <datalist id="organizer-suggestions">
                  {existingOrganizers.map((org) => (
                    <option key={org} value={org} />
                  ))}
                </datalist>
              </div>
            </div>
          </div>

          {/* Row 2: Badge Prefix, Category, Lifecycle Status */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label
                htmlFor="ev-studio-code"
                className="mb-1.5 block text-xs font-semibold text-foreground"
              >
                Badge code prefix
              </label>
              <input
                id="ev-studio-code"
                value={form.code}
                onChange={(e) => {
                  setCodeManuallyEdited(true);
                  setForm({ ...form, code: e.target.value.toUpperCase() });
                }}
                placeholder="e.g. EAYS-26"
                maxLength={14}
                className="w-full rounded-xl border border-border bg-input px-3.5 py-2.5 font-mono-code text-sm text-foreground uppercase"
              />
              <span className="mt-1 inline-flex items-center gap-1 font-mono-code text-[11px] text-muted-foreground">
                <IdentificationBadge size={12} className="text-accent" aria-hidden="true" />
                Pass preview: {previewBadgeCode}
              </span>
            </div>

            <div>
              <label
                htmlFor="ev-studio-cat"
                className="mb-1.5 block text-xs font-semibold text-foreground"
              >
                Event category
              </label>
              <select
                id="ev-studio-cat"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as EventCategory })}
                className="w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm text-foreground"
              >
                {Object.entries(EVENT_CATEGORY_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="ev-studio-status"
                className="mb-1.5 block text-xs font-semibold text-foreground"
              >
                Lifecycle status
              </label>
              <select
                id="ev-studio-status"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as EventStatus })}
                className="w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm text-foreground"
              >
                {Object.entries(EVENT_STATUS_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 3: Dates, Year, Duration & Target Capacity */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label
                htmlFor="ev-studio-start"
                className="mb-1.5 block text-xs font-semibold text-foreground"
              >
                Start date
              </label>
              <input
                id="ev-studio-start"
                type="date"
                value={form.start_date}
                onChange={(e) => handleDateChange("start_date", e.target.value)}
                className="w-full rounded-xl border border-border bg-input px-3 py-2.5 text-xs text-foreground"
              />
            </div>

            <div>
              <label
                htmlFor="ev-studio-end"
                className="mb-1.5 block text-xs font-semibold text-foreground"
              >
                End date
              </label>
              <input
                id="ev-studio-end"
                type="date"
                min={form.start_date || undefined}
                value={form.end_date}
                onChange={(e) => handleDateChange("end_date", e.target.value)}
                className="w-full rounded-xl border border-border bg-input px-3 py-2.5 text-xs text-foreground"
              />
            </div>

            <div>
              <label
                htmlFor="ev-studio-days"
                className="mb-1.5 block text-xs font-semibold text-foreground"
              >
                Total days
              </label>
              <input
                id="ev-studio-days"
                type="number"
                min={1}
                max={14}
                value={form.total_days}
                onChange={(e) => setForm({ ...form, total_days: Number(e.target.value) })}
                className="w-full rounded-xl border border-border bg-input px-3 py-2.5 font-mono-code text-sm text-foreground"
              />
            </div>

            <div>
              <label
                htmlFor="ev-studio-cap"
                className="mb-1.5 block text-xs font-semibold text-foreground"
              >
                Target capacity
              </label>
              <input
                id="ev-studio-cap"
                type="number"
                min={10}
                max={250000}
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
                className="w-full rounded-xl border border-border bg-input px-3 py-2.5 font-mono-code text-sm text-foreground"
              />
            </div>
          </div>

          {/* Row 4: Venue & Year + Subtitle */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label
                htmlFor="ev-studio-venue"
                className="mb-1.5 block text-xs font-semibold text-foreground"
              >
                Venue / Location
              </label>
              <input
                id="ev-studio-venue"
                value={form.venue}
                onChange={(e) => setForm({ ...form, venue: e.target.value })}
                placeholder="e.g. Diamond Jubilee Hall, Main Sanctuary, or Retreat Grounds"
                className="w-full rounded-xl border border-border bg-input px-3.5 py-2.5 text-sm text-foreground"
              />
            </div>

            <div>
              <label
                htmlFor="ev-studio-year"
                className="mb-1.5 block text-xs font-semibold text-foreground"
              >
                Event year
              </label>
              <input
                id="ev-studio-year"
                type="number"
                min={2020}
                max={2100}
                value={form.year}
                onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
                className="w-full rounded-xl border border-border bg-input px-3.5 py-2.5 font-mono-code text-sm text-foreground"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="ev-studio-subtitle"
              className="mb-1.5 block text-xs font-semibold text-foreground"
            >
              Theme, tagline, or program description{" "}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <input
              id="ev-studio-subtitle"
              value={form.subtitle}
              onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
              placeholder="e.g. Building Resilient Leaders Across East Africa"
              className="w-full rounded-xl border border-border bg-input px-3.5 py-2.5 text-sm text-foreground"
            />
          </div>

          {/* Camping & Lodging Toggle */}
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-secondary/55 px-4 py-3 text-xs">
            <div className="flex items-center gap-2.5">
              <Campfire
                size={17}
                className="shrink-0 text-warm"
                weight="duotone"
                aria-hidden="true"
              />
              <div>
                <span className="block font-semibold text-foreground">
                  Enable on-site camping & dormitory allocation
                </span>
                <span className="text-muted-foreground">
                  Turn off for day-only conferences, workshops, banquets, or city seminars.
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={form.camping_enabled}
              onChange={(e) => setForm({ ...form, camping_enabled: e.target.checked })}
              className="h-4 w-4 shrink-0 accent-primary"
            />
          </label>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="cursor-pointer rounded-full border border-border bg-secondary px-4 py-2 text-xs font-semibold text-secondary-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              id="event-studio-submit-btn"
              type="submit"
              disabled={saving}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground hover:opacity-95 disabled:opacity-50"
            >
              {mode === "edit" ? (
                <FloppyDisk size={15} aria-hidden="true" />
              ) : (
                <ListChecks size={15} aria-hidden="true" />
              )}
              {saving
                ? "Saving…"
                : mode === "edit"
                  ? "Save event changes"
                  : "Create & switch to event"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
