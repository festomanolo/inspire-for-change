-- =============================================================================
-- Multi-Organization Events & Manager Governance Migration (v3.1)
-- Allows creating and managing events for any host ministry, organization,
-- fellowship, conference, or community program (not only Inspired for Change),
-- and adds staff role governance for the Manager Dashboard.
-- =============================================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS organizer TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'registrar';
