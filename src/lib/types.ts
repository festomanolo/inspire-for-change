export type GuestStatus = "camping" | "not_camping";

export type Profile = {
  id: string;
  email: string;
  display_name: string;
  created_at?: string;
};

export type Guest = {
  id: string;
  event_id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  origin: string;
  phone: string;
  status: GuestStatus;
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
