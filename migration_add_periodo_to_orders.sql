-- Migration: Add 'periodo' column to 'orders' table
-- This stores the custom period identifier (00, 01, 02, 03) selected by the user.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS periodo VARCHAR(10);
