-- Solución al error "Could not find the 'periodo' column"
-- Ejecuta todo este bloque en el SQL Editor de Supabase.

-- 1. Asegurar que la columna existe (por si no se creó antes)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS periodo VARCHAR(10);

-- 2. Recargar la caché del esquema de la API (para que Supabase reconozca la nueva columna)
NOTIFY pgrst, 'reload schema';
