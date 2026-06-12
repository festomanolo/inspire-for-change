
-- =========================
-- Profiles
-- =========================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view profiles"
  ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================
-- Events (per year)
-- =========================
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated manage events"
  ON public.events FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Seed current year event
INSERT INTO public.events (year, name)
VALUES (EXTRACT(YEAR FROM now())::INT, 'Event ' || EXTRACT(YEAR FROM now())::INT)
ON CONFLICT (year) DO NOTHING;

-- =========================
-- Guests
-- =========================
CREATE TYPE public.guest_status AS ENUM ('camping', 'not_camping');

CREATE TABLE public.guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  origin TEXT NOT NULL,
  phone TEXT NOT NULL,
  status public.guest_status NOT NULL DEFAULT 'not_camping',
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX guests_event_id_idx ON public.guests(event_id);
CREATE INDEX guests_status_idx ON public.guests(status);
CREATE INDEX guests_created_at_idx ON public.guests(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.guests TO authenticated;
GRANT ALL ON public.guests TO service_role;
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view guests"
  ON public.guests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert guests"
  ON public.guests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update guests"
  ON public.guests FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete guests"
  ON public.guests FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER guests_updated_at
BEFORE UPDATE ON public.guests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- Audit log (edit history)
-- =========================
CREATE TABLE public.guest_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id UUID NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  edited_by UUID REFERENCES public.profiles(id),
  edited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  action TEXT NOT NULL, -- 'create' | 'update' | 'delete'
  changes JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX guest_edits_guest_idx ON public.guest_edits(guest_id);
CREATE INDEX guest_edits_at_idx ON public.guest_edits(edited_at DESC);

GRANT SELECT, INSERT ON public.guest_edits TO authenticated;
GRANT ALL ON public.guest_edits TO service_role;
ALTER TABLE public.guest_edits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view edits"
  ON public.guest_edits FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert edits"
  ON public.guest_edits FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Trigger to log inserts and updates
CREATE OR REPLACE FUNCTION public.log_guest_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  diff JSONB := '{}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.guest_edits (guest_id, edited_by, action, changes)
    VALUES (NEW.id, NEW.created_by, 'create', to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.first_name IS DISTINCT FROM OLD.first_name THEN
      diff := diff || jsonb_build_object('first_name', jsonb_build_object('from', OLD.first_name, 'to', NEW.first_name));
    END IF;
    IF NEW.middle_name IS DISTINCT FROM OLD.middle_name THEN
      diff := diff || jsonb_build_object('middle_name', jsonb_build_object('from', OLD.middle_name, 'to', NEW.middle_name));
    END IF;
    IF NEW.last_name IS DISTINCT FROM OLD.last_name THEN
      diff := diff || jsonb_build_object('last_name', jsonb_build_object('from', OLD.last_name, 'to', NEW.last_name));
    END IF;
    IF NEW.origin IS DISTINCT FROM OLD.origin THEN
      diff := diff || jsonb_build_object('origin', jsonb_build_object('from', OLD.origin, 'to', NEW.origin));
    END IF;
    IF NEW.phone IS DISTINCT FROM OLD.phone THEN
      diff := diff || jsonb_build_object('phone', jsonb_build_object('from', OLD.phone, 'to', NEW.phone));
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      diff := diff || jsonb_build_object('status', jsonb_build_object('from', OLD.status, 'to', NEW.status));
    END IF;
    IF diff <> '{}'::jsonb THEN
      INSERT INTO public.guest_edits (guest_id, edited_by, action, changes)
      VALUES (NEW.id, NEW.updated_by, 'update', diff);
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guests_audit_insert
AFTER INSERT ON public.guests
FOR EACH ROW EXECUTE FUNCTION public.log_guest_change();

CREATE TRIGGER guests_audit_update
AFTER UPDATE ON public.guests
FOR EACH ROW EXECUTE FUNCTION public.log_guest_change();
