-- Migration: Relax period name constraint
ALTER TABLE periods DROP CONSTRAINT IF EXISTS periods_nombre_check;

-- Optional: Add a new less restrictive check if desired, or just leave it open.
-- For now leaving it open to allow 'Periodo 1', 'Periodo 2', etc.
