// Enriched CSV Export utility for Church Events Management
import {
  AGE_GROUP_LABELS,
  GENDER_LABELS,
  MINISTRY_ROLE_LABELS,
  type EventRow,
  type Guest,
  type GuestEdit,
  type Profile,
} from "./types";

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function convertToCSV(data: Record<string, unknown>[], headers: string[]): string {
  const headerRow = headers.map(escapeCSV).join(",");
  const dataRows = data.map((row) => headers.map((header) => escapeCSV(row[header])).join(","));
  return [headerRow, ...dataRows].join("\n");
}

export function downloadCSV(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function exportGuestsToCSV(eventId?: string): Promise<void> {
  const response = await fetch("/api/storage/export");
  const data = await response.json();

  let guests: Guest[] = data.guests ?? [];
  if (eventId) {
    guests = guests.filter((g) => g.event_id === eventId);
  }

  const profiles: Profile[] = data.profiles ?? [];
  const events: EventRow[] = data.events ?? [];

  const enrichedGuests = guests.map((guest) => {
    const creator = profiles.find((p) => p.id === guest.created_by);
    const updater = profiles.find((p) => p.id === guest.updated_by);
    const event = events.find((e) => e.id === guest.event_id);
    const daysReg =
      Array.isArray(guest.days_registered) && guest.days_registered.length > 0
        ? guest.days_registered.map((d) => `Day ${d}`).join("; ")
        : guest.day
          ? `Day ${guest.day}`
          : "";
    const checkedInDays = Object.keys(guest.check_ins ?? {})
      .sort()
      .map((d) => `Day ${d}`)
      .join("; ");

    return {
      uuid: guest.id,
      reg_code: guest.reg_code || "",
      event_code: event?.code || "",
      event_name: event?.name || "",
      event_organizer: event?.organizer || "",
      event_year: event?.year || "",
      first_name: guest.first_name,
      middle_name: guest.middle_name || "",
      last_name: guest.last_name,
      gender: GENDER_LABELS[guest.gender] || guest.gender || "",
      age_group: AGE_GROUP_LABELS[guest.age_group] || guest.age_group || "",
      ministry_role: MINISTRY_ROLE_LABELS[guest.ministry_role] || guest.ministry_role || "",
      church_name: guest.church_name || "",
      origin: guest.origin,
      phone: guest.phone || "",
      shared_household_phone: guest.is_shared_phone ? "Yes" : "No",
      guardian_name: guest.guardian_name || "",
      email: guest.email || "",
      accommodation_status: guest.status === "camping" ? "Camping" : "Day Attendee",
      accommodation_zone: guest.accommodation_zone || "",
      days_registered: daysReg,
      checked_in_days: checkedInDays,
      dietary_medical_notes: guest.dietary_medical || "",
      household_id: guest.household_id || "",
      registered_by: creator?.display_name || "",
      updated_by: updater?.display_name || "",
      created_at: guest.created_at,
      updated_at: guest.updated_at,
    };
  });

  const headers = [
    "uuid",
    "reg_code",
    "event_code",
    "event_name",
    "event_organizer",
    "event_year",
    "first_name",
    "middle_name",
    "last_name",
    "gender",
    "age_group",
    "ministry_role",
    "church_name",
    "origin",
    "phone",
    "shared_household_phone",
    "guardian_name",
    "email",
    "accommodation_status",
    "accommodation_zone",
    "days_registered",
    "checked_in_days",
    "dietary_medical_notes",
    "household_id",
    "registered_by",
    "updated_by",
    "created_at",
    "updated_at",
  ];

  const csv = convertToCSV(enrichedGuests, headers);
  const timestamp = new Date().toISOString().split("T")[0];
  const eventSlug = eventId
    ? (events.find((e) => e.id === eventId)?.code?.toLowerCase() ?? "event")
    : "all-events";
  downloadCSV(`attendees-${eventSlug}-${timestamp}.csv`, csv);
}

export async function exportAllDataToCSV(): Promise<void> {
  const response = await fetch("/api/storage/export");
  const data = await response.json();
  const timestamp = new Date().toISOString().split("T")[0];

  await exportGuestsToCSV();
  await new Promise((resolve) => setTimeout(resolve, 120));

  const eventHeaders = [
    "id",
    "code",
    "year",
    "name",
    "organizer",
    "category",
    "venue",
    "start_date",
    "end_date",
    "total_days",
    "capacity",
    "camping_enabled",
    "status",
    "created_at",
  ];
  downloadCSV(`church-events-${timestamp}.csv`, convertToCSV(data.events ?? [], eventHeaders));

  await new Promise((resolve) => setTimeout(resolve, 120));

  const profileHeaders = ["id", "email", "display_name", "role", "created_at"];
  downloadCSV(`staff-profiles-${timestamp}.csv`, convertToCSV(data.profiles ?? [], profileHeaders));

  if (Array.isArray(data.guest_edits) && data.guest_edits.length > 0) {
    await new Promise((resolve) => setTimeout(resolve, 120));
    const editHeaders = [
      "id",
      "guest_id",
      "event_id",
      "edited_by",
      "edited_at",
      "action",
      "changes",
    ];
    const editsData = data.guest_edits.map((edit: GuestEdit) => ({
      ...edit,
      changes: JSON.stringify(edit.changes),
    }));
    downloadCSV(`audit-log-${timestamp}.csv`, convertToCSV(editsData, editHeaders));
  }
}
