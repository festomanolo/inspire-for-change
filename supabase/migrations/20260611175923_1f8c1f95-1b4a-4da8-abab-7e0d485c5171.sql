
DROP POLICY "Authenticated manage events" ON public.events;
CREATE POLICY "Authenticated view events" ON public.events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert events" ON public.events FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update events" ON public.events FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete events" ON public.events FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);
