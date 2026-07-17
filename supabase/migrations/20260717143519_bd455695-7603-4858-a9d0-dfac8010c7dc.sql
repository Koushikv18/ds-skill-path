
-- Track each user's progress through the 12 modules
CREATE TABLE public.user_module_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id integer NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'locked' CHECK (status IN ('locked','unlocked','in_progress','passed')),
  passed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, module_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_module_progress TO authenticated;
GRANT ALL ON public.user_module_progress TO service_role;

ALTER TABLE public.user_module_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own progress" ON public.user_module_progress
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Seed Module 1 as unlocked for new users, alongside the existing profile insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));

  INSERT INTO public.user_module_progress (user_id, module_id, status)
  VALUES (NEW.id, 1, 'unlocked')
  ON CONFLICT (user_id, module_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Ensure the auth.users trigger is wired (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill Module 1 unlock for any existing users
INSERT INTO public.user_module_progress (user_id, module_id, status)
SELECT id, 1, 'unlocked' FROM auth.users
ON CONFLICT (user_id, module_id) DO NOTHING;

-- When a module_passed activity is logged, mark it passed and unlock the next module
CREATE OR REPLACE FUNCTION public.handle_module_passed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  passed_level int;
  passed_order int;
  next_id int;
BEGIN
  IF NEW.activity_type <> 'module_passed' AND NEW.activity_type <> 'capstone_passed' THEN
    RETURN NEW;
  END IF;
  IF NEW.module_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.user_module_progress (user_id, module_id, status, passed_at, updated_at)
  VALUES (NEW.user_id, NEW.module_id, 'passed', now(), now())
  ON CONFLICT (user_id, module_id)
  DO UPDATE SET status = 'passed', passed_at = now(), updated_at = now();

  SELECT level, order_in_level INTO passed_level, passed_order
  FROM public.modules WHERE id = NEW.module_id;

  -- next module in same level, else first of next level
  SELECT id INTO next_id FROM public.modules
    WHERE level = passed_level AND order_in_level = passed_order + 1
    LIMIT 1;

  IF next_id IS NULL THEN
    SELECT id INTO next_id FROM public.modules
      WHERE level = passed_level + 1 AND order_in_level = 1
      LIMIT 1;
  END IF;

  IF next_id IS NOT NULL THEN
    INSERT INTO public.user_module_progress (user_id, module_id, status)
    VALUES (NEW.user_id, next_id, 'unlocked')
    ON CONFLICT (user_id, module_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_activity_module_passed ON public.activity_log;
CREATE TRIGGER on_activity_module_passed
  AFTER INSERT ON public.activity_log
  FOR EACH ROW EXECUTE FUNCTION public.handle_module_passed();

-- updated_at maintenance
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS touch_user_module_progress ON public.user_module_progress;
CREATE TRIGGER touch_user_module_progress
  BEFORE UPDATE ON public.user_module_progress
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
