-- =============================================================================
-- Church Events Management System v3 Migration
-- Elevates legacy guest tracker to full multi-event church management with
-- proper UUIDs, scannable registration codes, gender, age brackets, ministry
-- roles, household shared-phone support, multi-day arrays, and gate check-ins.
-- =============================================================================

-- 1. Allow multiple church events per year (conferences, camps, crusades, etc.)
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_year_key;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS code TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'conference',
  ADD COLUMN IF NOT EXISTS subtitle TEXT,
  ADD COLUMN IF NOT EXISTS venue TEXT,
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS total_days INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS capacity INTEGER,
  ADD COLUMN IF NOT EXISTS camping_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

UPDATE public.events
SET code = COALESCE(code, 'IFC-' || year::TEXT)
WHERE code IS NULL;

-- 2. Upgrade guests with true church identity, gender, household & check-in data
ALTER TABLE public.guests
  ALTER COLUMN phone DROP NOT NULL,
  ALTER COLUMN phone SET DEFAULT '';

ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS reg_code TEXT,
  ADD COLUMN IF NOT EXISTS household_id UUID,
  ADD COLUMN IF NOT EXISTS gender TEXT NOT NULL DEFAULT 'unspecified',
  ADD COLUMN IF NOT EXISTS age_group TEXT NOT NULL DEFAULT 'adult',
  ADD COLUMN IF NOT EXISTS church_name TEXT,
  ADD COLUMN IF NOT EXISTS ministry_role TEXT NOT NULL DEFAULT 'member',
  ADD COLUMN IF NOT EXISTS is_shared_phone BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS guardian_name TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS accommodation_zone TEXT,
  ADD COLUMN IF NOT EXISTS dietary_medical TEXT,
  ADD COLUMN IF NOT EXISTS days_registered INTEGER[] NOT NULL DEFAULT ARRAY[1]::INTEGER[],
  ADD COLUMN IF NOT EXISTS check_ins JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Backfill reg_code and days_registered for existing rows
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY created_at ASC) AS rn
  FROM public.guests
)
UPDATE public.guests g
SET
  reg_code = COALESCE(g.reg_code, 'IFC-' || LPAD(n.rn::TEXT, 4, '0')),
  days_registered = CASE
    WHEN g.day IS NOT NULL THEN ARRAY[g.day]
    ELSE ARRAY[1]
  END
FROM numbered n
WHERE g.id = n.id;

CREATE UNIQUE INDEX IF NOT EXISTS guests_event_reg_code_idx ON public.guests(event_id, reg_code);
CREATE INDEX IF NOT EXISTS guests_gender_idx ON public.guests(gender);
CREATE INDEX IF NOT EXISTS guests_household_idx ON public.guests(household_id);
CREATE INDEX IF NOT EXISTS guests_church_idx ON public.guests(church_name);

-- 3. Keep audit log intact even if a guest is deleted (nullable FK or event_id)
ALTER TABLE public.guest_edits
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE CASCADE;
