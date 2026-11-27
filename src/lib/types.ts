export type GuestStatus = "camping" | "not_camping";

export type Gender = "male" | "female" | "unspecified";

export type AgeGroup = "child" | "youth" | "young_adult" | "adult" | "elder";

export type MinistryRole =
  | "member"
  | "visitor"
  | "first_timer"
  | "pastor"
  | "leader"
  | "choir_media"
  | "volunteer";

export type EventCategory =
  | "conference"
  | "camp"
  | "crusade"
  | "youth_retreat"
  | "leadership_summit"
  | "seminar_workshop"
  | "community_gala"
  | "worship_service";

export type EventStatus = "upcoming" | "active" | "completed" | "archived";

export type StaffRole = "manager" | "admin" | "registrar" | "usher";

export type Profile = {
  id: string;
  email: string;
  display_name: string;
  role?: StaffRole;
  created_at?: string;
};

export type Guest = {
  /** Immutable RFC-4122 UUID v4 primary key — never derived from phone number */
  id: string;
  /** Human-scannable unique event badge code, e.g. YRC-26-0001 */
  reg_code: string;
  event_id: string;
  /** Optional shared family/delegation UUID for households sharing contact info */
  household_id: string | null;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  gender: Gender;
  age_group: AgeGroup;
  origin: string;
  church_name: string | null;
  ministry_role: MinistryRole;
  /** Phone is optional (e.g. children/elders) and may be shared across a household */
  phone: string;
  is_shared_phone: boolean;
  guardian_name: string | null;
  email: string | null;
  status: GuestStatus;
  /** Auto-suggested or assigned dormitory/tent zone (e.g. Men's Sanctuary Dorm A) */
  accommodation_zone: string | null;
  dietary_medical: string | null;
  /** Legacy single-day field kept synced with days_registered[0] for backward compatibility */
  day: number | null;
  /** Canonical multi-day attendance array (1..total_days) on a single person record */
  days_registered: number[];
  /** Per-day gate check-in ISO timestamps keyed by day number string ("1", "2", ...) */
  check_ins: Record<string, string>;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type EventRow = {
  id: string;
  code: string;
  year: number;
  name: string;
  category: EventCategory;
  subtitle: string | null;
  venue: string | null;
  start_date: string | null;
  end_date: string | null;
  total_days: number;
  capacity: number | null;
  camping_enabled: boolean;
  status: EventStatus;
  created_at: string;
};

export type GuestEdit = {
  id: string;
  guest_id: string;
  event_id?: string;
  edited_by: string | null;
  edited_at: string;
  action: "create" | "update" | "check_in" | "delete" | "merge" | string;
  changes: Record<string, { from: unknown; to: unknown } | unknown>;
};

export const GENDER_LABELS: Record<Gender, string> = {
  male: "Male",
  female: "Female",
  unspecified: "Not recorded",
};

export const AGE_GROUP_LABELS: Record<AgeGroup, string> = {
  child: "Child (0–12)",
  youth: "Youth (13–19)",
  young_adult: "Young adult (20–30)",
  adult: "Adult (31–59)",
  elder: "Elder (60+)",
};

export const MINISTRY_ROLE_LABELS: Record<MinistryRole, string> = {
  member: "Church member",
  visitor: "Visiting guest",
  first_timer: "First-time visitor",
  pastor: "Pastor / Clergy",
  leader: "Ministry leader",
  choir_media: "Choir & Media",
  volunteer: "Usher / Steward",
};

export const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  conference: "Conference & convention",
  camp: "Camp & retreat",
  crusade: "Gospel crusade",
  youth_retreat: "Youth & campus",
  leadership_summit: "Leadership summit",
  worship_service: "Special worship service",
};

export function suggestAccommodationZone(
  gender: Gender,
  status: GuestStatus,
  ageGroup?: AgeGroup,
): string | null {
  if (status !== "camping") return null;
  if (ageGroup === "child") return "Family & Children Lodge";
  if (gender === "male") return "Men's Sanctuary Dorm A";
  if (gender === "female") return "Women's Sanctuary Dorm B";
  return "General Campgrounds";
}

export function formatFullName(
  g: Pick<Guest, "first_name" | "middle_name" | "last_name">,
): string {
  return [g.first_name, g.middle_name, g.last_name]
    .filter(Boolean)
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

export function isCheckedInForDay(guest: Guest, day: number): boolean {
  return Boolean(guest.check_ins?.[String(day)]);
}

export function countCheckedInDays(guest: Guest): number {
  return Object.keys(guest.check_ins ?? {}).length;
}
