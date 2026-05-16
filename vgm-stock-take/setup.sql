-- VGM Stock Take 2026 - Supabase Setup Script
-- Run this in your Supabase SQL Editor

-- 1. Remove tables if they already exist
DROP TABLE IF EXISTS public.b17;
DROP TABLE IF EXISTS public.b22;
DROP TABLE IF EXISTS public.loma;
DROP TABLE IF EXISTS public.b22_seq;
DROP TABLE IF EXISTS public.check_part;
DROP TABLE IF EXISTS public.parts; -- Optional cleanup of the old table

-- 2. Create the 5 individual zone tables
CREATE TABLE public.b17 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material TEXT NOT NULL,
  part_no TEXT NOT NULL,
  location TEXT NOT NULL,
  zone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Not Counted' CHECK (status IN ('Not Counted', 'Counted', 'Verified')),
  box_1 INTEGER DEFAULT NULL, box_2 INTEGER DEFAULT NULL, box_3 INTEGER DEFAULT NULL, box_4 INTEGER DEFAULT NULL, box_5 INTEGER DEFAULT NULL,
  recount INTEGER DEFAULT NULL,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE public.b22 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material TEXT NOT NULL,
  part_no TEXT NOT NULL,
  location TEXT NOT NULL,
  zone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Not Counted' CHECK (status IN ('Not Counted', 'Counted', 'Verified')),
  box_1 INTEGER DEFAULT NULL, box_2 INTEGER DEFAULT NULL, box_3 INTEGER DEFAULT NULL, box_4 INTEGER DEFAULT NULL, box_5 INTEGER DEFAULT NULL,
  recount INTEGER DEFAULT NULL,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE public.loma (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material TEXT NOT NULL,
  part_no TEXT NOT NULL,
  location TEXT NOT NULL,
  zone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Not Counted' CHECK (status IN ('Not Counted', 'Counted', 'Verified')),
  box_1 INTEGER DEFAULT NULL, box_2 INTEGER DEFAULT NULL, box_3 INTEGER DEFAULT NULL, box_4 INTEGER DEFAULT NULL, box_5 INTEGER DEFAULT NULL,
  recount INTEGER DEFAULT NULL,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE public.b22_seq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material TEXT NOT NULL,
  part_no TEXT NOT NULL,
  location TEXT NOT NULL,
  zone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Not Counted' CHECK (status IN ('Not Counted', 'Counted', 'Verified')),
  box_1 INTEGER DEFAULT NULL, box_2 INTEGER DEFAULT NULL, box_3 INTEGER DEFAULT NULL, box_4 INTEGER DEFAULT NULL, box_5 INTEGER DEFAULT NULL,
  recount INTEGER DEFAULT NULL,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE public.check_part (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material TEXT NOT NULL,
  part_no TEXT NOT NULL,
  location TEXT NOT NULL,
  zone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Not Counted' CHECK (status IN ('Not Counted', 'Counted', 'Verified')),
  box_1 INTEGER DEFAULT NULL, box_2 INTEGER DEFAULT NULL, box_3 INTEGER DEFAULT NULL, box_4 INTEGER DEFAULT NULL, box_5 INTEGER DEFAULT NULL,
  recount INTEGER DEFAULT NULL,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 3. Enable Realtime
alter publication supabase_realtime add table public.b17;
alter publication supabase_realtime add table public.b22;
alter publication supabase_realtime add table public.loma;
alter publication supabase_realtime add table public.b22_seq;
alter publication supabase_realtime add table public.check_part;

-- 4. Disable Row Level Security (RLS)
ALTER TABLE public.b17 DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.b22 DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.loma DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.b22_seq DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_part DISABLE ROW LEVEL SECURITY;
