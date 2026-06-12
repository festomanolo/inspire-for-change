-- Add day field to guests table
ALTER TABLE public.guests ADD COLUMN day INTEGER;

-- Add comment to describe the field
COMMENT ON COLUMN public.guests.day IS 'Day of attendance: 1, 2, or 3';

-- Create index for better query performance
CREATE INDEX guests_day_idx ON public.guests(day);

-- Update the audit trigger to include day field changes
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
    IF NEW.day IS DISTINCT FROM OLD.day THEN
      diff := diff || jsonb_build_object('day', jsonb_build_object('from', OLD.day, 'to', NEW.day));
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
