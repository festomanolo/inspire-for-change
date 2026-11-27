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
  | "worship_service";

export type EventStatus = "upcoming" | "active" | "archived";

export type Profile = {
  id: string;
  email: string;
  display_name: string;
  role?: "admin" | "registrar" | "usher";
  created_at?: string;
};

export type Guest = {
  /** Immutable RFC-4122 UUID v4 primary key — never derived from phone number */
  id: string;
  /** Human-scannable unique event badge code, e.g. IFC-26-0001 */
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
  status: GuestStatus;
  day: number | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type EventRow = {
  id: string;
  year: number;
  name: string;
  created_at: string;
};

export type GuestEdit = {
  id: string;
  guest_id: string;
  edited_by: string | null;
  edited_at: string;
  action: string;
  changes: Record<string, { from: unknown; to: unknown } | unknown>;
};
