
-- daily_checklist
CREATE TABLE public.daily_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  item_type text NOT NULL,
  ref_id text,
  label text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_checklist TO authenticated;
GRANT ALL ON public.daily_checklist TO service_role;
ALTER TABLE public.daily_checklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own checklist" ON public.daily_checklist FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX daily_checklist_user_date_idx ON public.daily_checklist(user_id, date);

-- activity_log
CREATE TABLE public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  activity_type text NOT NULL,
  module_id integer,
  minutes_spent integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own activity" ON public.activity_log FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX activity_log_user_date_idx ON public.activity_log(user_id, date);

-- sql_tasks
CREATE TABLE public.sql_tasks (
  id serial PRIMARY KEY,
  title text NOT NULL,
  prompt text NOT NULL,
  schema_sql text NOT NULL,
  expected_result_rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  difficulty text NOT NULL DEFAULT 'Basic',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sql_tasks TO anon, authenticated;
GRANT ALL ON public.sql_tasks TO service_role;
ALTER TABLE public.sql_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sql_tasks readable" ON public.sql_tasks FOR SELECT TO anon, authenticated USING (true);

-- sql_sessions
CREATE TABLE public.sql_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sql_task_id integer REFERENCES public.sql_tasks(id) ON DELETE SET NULL,
  query_text text NOT NULL,
  last_run_result jsonb,
  last_saved_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sql_sessions TO authenticated;
GRANT ALL ON public.sql_sessions TO service_role;
ALTER TABLE public.sql_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sql sessions" ON public.sql_sessions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
