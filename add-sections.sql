CREATE TABLE public.sections (
  id bigserial primary key,
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  color text not null default '#bb9af7',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own sections" ON public.sections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sections" ON public.sections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sections" ON public.sections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sections" ON public.sections FOR DELETE USING (auth.uid() = user_id);
ALTER TABLE public.tasks ADD COLUMN section_id bigint REFERENCES public.sections(id) ON DELETE SET NULL;
