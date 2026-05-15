-- VGM Stock Take 2026 - Supabase Setup Script
-- Run this in your Supabase SQL Editor

-- 1. Create Users Table
-- This is a custom users table for ID-based login as requested
CREATE TABLE public.users (
  id TEXT PRIMARY KEY,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Counter', 'Verifier', 'Operator Batt', 'QA Inspector', 'Admin')),
  name TEXT NOT NULL
);

-- 2. Create Parts Table
CREATE TABLE public.parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material TEXT NOT NULL,
  part_no TEXT NOT NULL,
  location TEXT NOT NULL,
  zone TEXT NOT NULL CHECK (zone IN ('B17', 'B22', 'LOMA', 'B22 SEQ')),
  status TEXT NOT NULL DEFAULT 'Not Counted' CHECK (status IN ('Not Counted', 'Counted', 'Verified')),
  box_1 INTEGER DEFAULT NULL,
  box_2 INTEGER DEFAULT NULL,
  box_3 INTEGER DEFAULT NULL,
  box_4 INTEGER DEFAULT NULL,
  box_5 INTEGER DEFAULT NULL,
  recount INTEGER DEFAULT NULL,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Insert Mock Users
INSERT INTO public.users (id, password, role, name) VALUES
('ADMIN01', 'pass123', 'Admin', 'Super Admin'),
('COUNT01', 'pass123', 'Counter', 'Ali (Counter)'),
('VERIF01', 'pass123', 'Verifier', 'Muthu (Verifier)'),
('BATT01', 'pass123', 'Operator Batt', 'Ah Kao (Battery)'),
('QA01', 'pass123', 'QA Inspector', 'Siti (QA)');

-- 4. Insert Mock Parts
INSERT INTO public.parts (material, part_no, location, zone) VALUES
('Engine Block', 'ENG-001', 'A1-R1', 'B17'),
('Brake Pads', 'BRK-099', 'A2-R1', 'B17'),
('Transmission', 'TRN-200', 'B1-R2', 'B22'),
('Steering Wheel', 'STR-050', 'C1-R3', 'LOMA'),
('LED Headlights', 'LED-100', 'D1-R4', 'B22 SEQ');

-- 5. Enable Realtime for parts
alter publication supabase_realtime add table public.parts;
alter publication supabase_realtime add table public.users;
