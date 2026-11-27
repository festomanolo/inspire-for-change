export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      events: {
        Row: {
          camping_enabled: boolean
          capacity: number | null
          category: string
          code: string
          created_at: string
          end_date: string | null
          id: string
          name: string
          start_date: string | null
          status: string
          subtitle: string | null
          total_days: number
          venue: string | null
          year: number
        }
        Insert: {
          camping_enabled?: boolean
          capacity?: number | null
          category?: string
          code?: string
          created_at?: string
          end_date?: string | null
          id?: string
          name: string
          start_date?: string | null
          status?: string
          subtitle?: string | null
          total_days?: number
          venue?: string | null
          year: number
        }
        Update: {
          camping_enabled?: boolean
          capacity?: number | null
          category?: string
          code?: string
          created_at?: string
          end_date?: string | null
          id?: string
          name?: string
          start_date?: string | null
          status?: string
          subtitle?: string | null
          total_days?: number
          venue?: string | null
          year?: number
        }
        Relationships: []
      }
      guest_edits: {
        Row: {
          action: string
          changes: Json
          edited_at: string
          edited_by: string | null
          event_id?: string | null
          guest_id: string
          id: string
        }
        Insert: {
          action: string
          changes?: Json
          edited_at?: string
          edited_by?: string | null
          event_id?: string | null
          guest_id: string
          id?: string
        }
        Update: {
          action?: string
          changes?: Json
          edited_at?: string
          edited_by?: string | null
          event_id?: string | null
          guest_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_edits_edited_by_fkey"
            columns: ["edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_edits_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
        ]
      }
      guests: {
        Row: {
          accommodation_zone: string | null
          age_group: string
          check_ins: Json
          church_name: string | null
          created_at: string
          created_by: string | null
          day: number | null
          days_registered: number[]
          dietary_medical: string | null
          email: string | null
          event_id: string
          first_name: string
          gender: string
          guardian_name: string | null
          household_id: string | null
          id: string
          is_shared_phone: boolean
          last_name: string
          middle_name: string | null
          ministry_role: string
          origin: string
          phone: string
          reg_code: string
          status: Database["public"]["Enums"]["guest_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          accommodation_zone?: string | null
          age_group?: string
          check_ins?: Json
          church_name?: string | null
          created_at?: string
          created_by?: string | null
          day?: number | null
          days_registered?: number[]
          dietary_medical?: string | null
          email?: string | null
          event_id: string
          first_name: string
          gender?: string
          guardian_name?: string | null
          household_id?: string | null
          id?: string
          is_shared_phone?: boolean
          last_name: string
          middle_name?: string | null
          ministry_role?: string
          origin: string
          phone?: string
          reg_code?: string
          status?: Database["public"]["Enums"]["guest_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          accommodation_zone?: string | null
          age_group?: string
          check_ins?: Json
          church_name?: string | null
          created_at?: string
          created_by?: string | null
          day?: number | null
          days_registered?: number[]
          dietary_medical?: string | null
          email?: string | null
          event_id?: string
          first_name?: string
          gender?: string
          guardian_name?: string | null
          household_id?: string | null
          id?: string
          is_shared_phone?: boolean
          last_name?: string
          middle_name?: string | null
          ministry_role?: string
          origin?: string
          phone?: string
          reg_code?: string
          status?: Database["public"]["Enums"]["guest_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guests_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          email: string
          id: string
          role?: string
        }
        Insert: {
          created_at?: string
          display_name: string
          email: string
          id: string
          role?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          role?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      guest_status: "camping" | "not_camping"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export const Constants = {
  public: {
    Enums: {
      guest_status: ["camping", "not_camping"],
    },
  },
} as const
