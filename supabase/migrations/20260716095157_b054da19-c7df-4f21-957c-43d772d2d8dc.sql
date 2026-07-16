
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by owner" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Profiles insertable by owner" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Profiles updatable by owner" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Modules (fixed skill tree)
CREATE TABLE public.modules (
  id INTEGER PRIMARY KEY,
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 3),
  order_in_level INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  is_capstone BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.modules TO authenticated, anon;
GRANT ALL ON public.modules TO service_role;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Modules readable by all" ON public.modules FOR SELECT USING (true);

INSERT INTO public.modules (id, level, order_in_level, title, description, is_capstone) VALUES
(1, 1, 1, 'Python Fundamentals for Data', 'Master the Python essentials every data scientist needs: variables, control flow, functions, and working with lists and dictionaries in a data context.', false),
(2, 1, 2, 'NumPy & Pandas Essentials', 'Load, slice, and transform real datasets with the two core libraries that power modern data work in Python.', false),
(3, 1, 3, 'Data Cleaning', 'Handle missing values, fix bad types, deduplicate, and prepare messy real-world data for analysis.', false),
(4, 1, 4, 'Exploratory Data Analysis', 'Capstone: run a full EDA on a real dataset — profile it, ask questions, and surface the story hidden in the data.', true),
(5, 2, 1, 'Data Visualization for Insight', 'Build charts that actually communicate — from quick matplotlib plots to polished, insight-driven visuals.', false),
(6, 2, 2, 'Statistics for Data Science', 'Descriptive stats, distributions, hypothesis testing, and the intuition behind the numbers you report.', false),
(7, 2, 3, 'Feature Engineering', 'Turn raw columns into powerful model inputs: encoding, scaling, interactions, and domain-driven features.', false),
(8, 2, 4, 'Intro to Machine Learning', 'Capstone: train, validate, and interpret your first end-to-end ML model on a real prediction problem.', true),
(9, 3, 1, 'Model Evaluation & Tuning', 'Cross-validation, metrics that match the problem, and hyperparameter tuning that actually moves the needle.', false),
(10, 3, 2, 'Advanced ML', 'Ensembles, gradient boosting, and modern techniques used in production data science.', false),
(11, 3, 3, 'Communicating Results', 'Package findings for non-technical stakeholders: narrative, visuals, and executive-ready reporting.', false),
(12, 3, 4, 'Independent Case Study', 'Capstone: ship a portfolio-worthy project end to end — problem, data, model, insight, and write-up.', true);
