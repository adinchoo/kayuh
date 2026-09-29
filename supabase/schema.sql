-- ADINCHOO DREEVE v8.2 SCHEMA - FULL REPLACEMENT
create extension if not exists pgcrypto;

-- PROFILES
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  date_of_birth date,
  sex_at_birth text,
  height_cm numeric,
  starting_weight_kg numeric,
  current_weight_kg numeric,
  target_weight_kg numeric default 70,
  primary_goal text default 'lose_weight',
  activity_level text default 'moderate',
  target_calories integer default 2200,
  target_protein_g integer default 180,
  target_steps integer default 10000,
  target_sleep_hours numeric default 7.5,
  resting_hr integer default 60,
  allergies text,
  created_at timestamptz default now()
);

-- MEALS
create table if not exists public.meal_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_name text not null,
  meal_type text,
  category text,
  calories integer not null,
  protein_g numeric default 0,
  carbs_g numeric default 0,
  fat_g numeric default 0,
  source text default 'Manual',
  logged_at timestamptz default now()
);

-- ACTIVITIES - DREEVE UPGRADED
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_name text not null,
  duration_minutes integer default 0,
  moving_time_minutes integer default 0,
  calories_burned integer default 0,
  distance_km numeric default 0,
  elevation_gain_m numeric default 0,
  elevation_loss_m numeric default 0,
  avg_hr integer,
  max_hr integer,
  avg_speed_kmh numeric,
  max_speed_kmh numeric,
  avg_power integer,
  max_power integer,
  avg_cadence integer,
  source text default 'Manual',
  external_id text,
  has_gpx boolean default false,
  logged_at timestamptz default now()
);

-- BODY
create table if not exists public.body_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  weight_kg numeric not null,
  body_fat_percent numeric,
  muscle_percent numeric,
  source text default 'Manual',
  logged_at timestamptz default now()
);

-- STEPS
create table if not exists public.steps_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  steps integer not null,
  distance_km numeric default 0,
  source text default 'Manual',
  logged_at timestamptz default now()
);

-- HR
create table if not exists public.heart_rate_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bpm integer not null,
  resting_bpm integer,
  max_bpm integer,
  avg_bpm integer,
  source text default 'Manual',
  logged_at timestamptz default now()
);

-- SLEEP
create table if not exists public.sleep_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  duration_hours numeric not null,
  quality integer default 3,
  score integer default 0,
  source text default 'Manual',
  logged_at timestamptz default now()
);

-- WATER
create table if not exists public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_ml integer default 250,
  logged_at timestamptz default now()
);

-- WORKOUTS
create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_name text not null,
  logged_at timestamptz default now()
);
create table if not exists public.workout_exercise_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.workout_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_name text not null,
  sets integer default 3,
  reps integer default 10,
  weight_kg numeric default 0,
  created_at timestamptz default now()
);

-- PHOTOS
create table if not exists public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  photo_url text not null,
  photo_type text default 'Front',
  logged_at timestamptz default now()
);

-- IMPORTS
create table if not exists public.integration_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  file_name text,
  records_count integer default 0,
  logged_at timestamptz default now()
);

-- GPX TRACKS - NEW FOR DREEVE MAP + ELEVATION CHART
create table if not exists public.gpx_tracks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_id uuid references public.activity_logs(id) on delete cascade,
  file_name text,
  points jsonb, -- [{lat,lon,ele,hr,time,dist}]
  polyline text, -- encoded
  distance_m numeric,
  elevation_gain numeric,
  created_at timestamptz default now()
);

-- STORAGE BUCKET
insert into storage.buckets (id, name, public) values ('progress-photos', 'progress-photos', false) on conflict (id) do nothing;

-- INDEXES FOR CHART PERFORMANCE
create index if not exists idx_meal_user_date on public.meal_logs(user_id, logged_at desc);
create index if not exists idx_activity_user_date on public.activity_logs(user_id, logged_at desc);
create index if not exists idx_body_user_date on public.body_logs(user_id, logged_at desc);
create index if not exists idx_steps_user_date on public.steps_logs(user_id, logged_at desc);
create index if not exists idx_hr_user_date on public.heart_rate_logs(user_id, logged_at desc);
create index if not exists idx_gpx_activity on public.gpx_tracks(activity_id);

-- RLS
alter table public.profiles enable row level security;
alter table public.meal_logs enable row level security;
alter table public.activity_logs enable row level security;
alter table public.body_logs enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_exercise_logs enable row level security;
alter table public.sleep_logs enable row level security;
alter table public.steps_logs enable row level security;
alter table public.heart_rate_logs enable row level security;
alter table public.progress_photos enable row level security;
alter table public.water_logs enable row level security;
alter table public.integration_imports enable row level security;
alter table public.gpx_tracks enable row level security;

-- POLICIES (DROP+CREATE SAFE)
drop policy if exists profiles_own on public.profiles; create policy profiles_own on public.profiles for all to authenticated using (auth.uid()=id) with check (auth.uid()=id);
drop policy if exists meal_own on public.meal_logs; create policy meal_own on public.meal_logs for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
drop policy if exists act_own on public.activity_logs; create policy act_own on public.activity_logs for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
drop policy if exists body_own on public.body_logs; create policy body_own on public.body_logs for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
drop policy if exists ws_own on public.workout_sessions; create policy ws_own on public.workout_sessions for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
drop policy if exists we_own on public.workout_exercise_logs; create policy we_own on public.workout_exercise_logs for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
drop policy if exists sleep_own on public.sleep_logs; create policy sleep_own on public.sleep_logs for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
drop policy if exists steps_own on public.steps_logs; create policy steps_own on public.steps_logs for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
drop policy if exists hr_own on public.heart_rate_logs; create policy hr_own on public.heart_rate_logs for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
drop policy if exists photo_own on public.progress_photos; create policy photo_own on public.progress_photos for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
drop policy if exists water_own on public.water_logs; create policy water_own on public.water_logs for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
drop policy if exists imp_own on public.integration_imports; create policy imp_own on public.integration_imports for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
drop policy if exists gpx_own on public.gpx_tracks; create policy gpx_own on public.gpx_tracks for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);

drop policy if exists "progress-photos own" on storage.objects; create policy "progress-photos own" on storage.objects for all to authenticated using (bucket_id='progress-photos' and (storage.foldername(name))[1]=auth.uid()::text) with check (bucket_id='progress-photos' and (storage.foldername(name))[1]=auth.uid()::text);

-- MIGRATION: ADD NEW COLS IF TABLE EXISTS
alter table public.activity_logs add column if not exists elevation_gain_m numeric default 0;
alter table public.activity_logs add column if not exists elevation_loss_m numeric default 0;
alter table public.activity_logs add column if not exists avg_hr integer;
alter table public.activity_logs add column if not exists max_hr integer;
alter table public.activity_logs add column if not exists avg_speed_kmh numeric;
alter table public.activity_logs add column if not exists max_speed_kmh numeric;
alter table public.activity_logs add column if not exists moving_time_minutes integer default 0;
alter table public.activity_logs add column if not exists has_gpx boolean default false;

-- TRIGGER FOR NEW USERS - FIXED DUPLICATE YOU HAD
create or replace function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, full_name, date_of_birth, sex_at_birth, height_cm, starting_weight_kg, current_weight_kg, target_weight_kg, primary_goal, activity_level, target_calories, target_protein_g, target_steps, target_sleep_hours)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name','User'),
    nullif(new.raw_user_meta_data->>'date_of_birth','')::date,
    coalesce(new.raw_user_meta_data->>'sex_at_birth','Male'),
    coalesce((new.raw_user_meta_data->>'height_cm')::numeric,170),
    coalesce((new.raw_user_meta_data->>'current_weight_kg')::numeric,70),
    coalesce((new.raw_user_meta_data->>'current_weight_kg')::numeric,70),
    coalesce((new.raw_user_meta_data->>'target_weight_kg')::numeric,70),
    coalesce(new.raw_user_meta_data->>'primary_goal','lose_weight'),
    coalesce(new.raw_user_meta_data->>'activity_level','moderate'),
    coalesce((new.raw_user_meta_data->>'target_calories')::int,2200),
    coalesce((new.raw_user_meta_data->>'target_protein_g')::int,180),
    coalesce((new.raw_user_meta_data->>'target_steps')::int,10000),
    coalesce((new.raw_user_meta_data->>'target_sleep_hours')::numeric,7.5)
  ) on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();