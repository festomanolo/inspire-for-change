// CSV Export utility
import type { Guest, Profile, EventRow } from "./types";

function escapeCSV(value: any): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function convertToCSV(data: any[], headers: string[]): string {
  const headerRow = headers.map(escapeCSV).join(",");
  const dataRows = data.map((row) => {
    return headers.map((header) => escapeCSV(row[header])).join(",");
  });
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
}

export async function exportGuestsToCSV(eventId?: string): Promise<void> {
  try {
    const response = await fetch("/api/storage/export");
    const data = await response.json();

    let guests: Guest[] = data.guests;

    // Filter by event if provided
    if (eventId) {
      guests = guests.filter((g) => g.event_id === eventId);
    }

    // Enrich with creator/updater names
    const profiles: Profile[] = data.profiles;
    const events: EventRow[] = data.events;

    const enrichedGuests = guests.map((guest) => {
      const creator = profiles.find((p) => p.id === guest.created_by);
      const updater = profiles.find((p) => p.id === guest.updated_by);
      const event = events.find((e) => e.id === guest.event_id);

      return {
        id: guest.id,
        event_year: event?.year || "",
        event_name: event?.name || "",
        first_name: guest.first_name,
        middle_name: guest.middle_name || "",
        last_name: guest.last_name,
        origin: guest.origin,
        phone: guest.phone,
        status: guest.status,
        created_by_name: creator?.display_name || "",
        created_by_email: creator?.email || "",
        updated_by_name: updater?.display_name || "",
        updated_by_email: updater?.email || "",
        created_at: guest.created_at,
        updated_at: guest.updated_at,
      };
    });

    const headers = [
      "id",
      "event_year",
      "event_name",
      "first_name",
      "middle_name",
      "last_name",
      "origin",
      "phone",
      "status",
      "created_by_name",
      "created_by_email",
      "updated_by_name",
      "updated_by_email",
      "created_at",
      "updated_at",
    ];

    const csv = convertToCSV(enrichedGuests, headers);
    const timestamp = new Date().toISOString().split("T")[0];
    const filename = eventId
      ? `guests-event-${timestamp}.csv`
      : `guests-all-${timestamp}.csv`;

    downloadCSV(filename, csv);
  } catch (error) {
    console.error("Error exporting guests to CSV:", error);
    throw error;
  }
}

export async function exportAllDataToCSV(): Promise<void> {
  try {
    const response = await fetch("/api/storage/export");
    const data = await response.json();

    const timestamp = new Date().toISOString().split("T")[0];

    // Export guests
    const guestHeaders = [
      "id",
      "event_id",
      "first_name",
      "middle_name",
      "last_name",
      "origin",
      "phone",
      "status",
      "created_by",
      "updated_by",
      "created_at",
      "updated_at",
    ];
    const guestsCSV = convertToCSV(data.guests, guestHeaders);
    downloadCSV(`guests-${timestamp}.csv`, guestsCSV);

    // Small delay between downloads
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Export events
    const eventHeaders = ["id", "year", "name", "created_at"];
    const eventsCSV = convertToCSV(data.events, eventHeaders);
    downloadCSV(`events-${timestamp}.csv`, eventsCSV);

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Export profiles
    const profileHeaders = ["id", "email", "display_name", "created_at"];
    const profilesCSV = convertToCSV(data.profiles, profileHeaders);
    downloadCSV(`profiles-${timestamp}.csv`, profilesCSV);

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Export guest edits
    if (data.guest_edits.length > 0) {
      const editHeaders = ["id", "guest_id", "edited_by", "edited_at", "action", "changes"];
      const editsData = data.guest_edits.map((edit: any) => ({
        ...edit,
        changes: JSON.stringify(edit.changes),
      }));
      const editsCSV = convertToCSV(editsData, editHeaders);
      downloadCSV(`guest-edits-${timestamp}.csv`, editsCSV);
    }
  } catch (error) {
    console.error("Error exporting all data to CSV:", error);
    throw error;
  }
}
