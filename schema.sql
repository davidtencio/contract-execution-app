-- Database Schema for Contract Execution App (PostgreSQL / Supabase)

-- 1. Contracts Table
create table contracts (
  id bigint primary key generated always as identity,
  codigo text not null,
  nombre text not null,
  proveedor text,
  concurso text,
  contrato_legal text,
  precio_unitario numeric(18,2) default 0,
  fecha_inicio date,
  moneda text default 'USD',
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. Items Table (Optional future expansion, kept simple for now)
-- (Currently items are mocked or flattened in contracts for MVP)

-- 3. Periods Table (Periodos Contractuales)
create table periods (
  id bigint primary key generated always as identity,
  contract_id bigint references contracts(id) on delete cascade,
  nombre text not null check (nombre in ('Año 1', 'Año 2', 'Año 3', 'Año 4', 'Prórroga')),
  fecha_inicio date not null,
  fecha_fin date not null,
  presupuesto_asignado numeric(18,2) default 0,
  presupuesto_inicial numeric(18,2) default 0,
  estado text default 'Pendiente' check (estado in ('Activo', 'Cerrado', 'Pendiente')),
  moneda text, -- Optional override
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 4. Injections Table (Inyecciones Presupuestarias)
create table injections (
  id bigint primary key generated always as identity,
  period_id bigint references periods(id) on delete cascade,
  amount numeric(18,2) not null,
  fecha date default CURRENT_DATE,
  descripcion text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 5. Orders Table (Pedidos)
create table orders (
  id bigint primary key generated always as identity,
  period_id bigint references periods(id) on delete cascade,
  fecha_pedido date not null,
  numero_pedido_sap text,
  numero_pedido_sicop text,
  cantidad_medicamento int default 0,
  monto numeric(18,2) not null,
  pur text,
  numero_reserva text,
  descripcion text,
  medicamento_nombre text, -- Legacy flat field
  medicamento_codigo text, -- Legacy flat field
  item_id bigint, -- Future link to items table
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Indexes for performance
create index idx_contracts_codigo on contracts(codigo);
create index idx_periods_contract on periods(contract_id);
create index idx_orders_period on orders(period_id);
create index idx_injections_period on injections(period_id);

-- Enable Row Level Security (RLS) - Optional for now but recommended
alter table contracts enable row level security;
alter table periods enable row level security;
alter table injections enable row level security;
alter table orders enable row level security;

-- Public Access Policy (For development/MVP without auth)
-- WARNING: This allows anyone with the anon key to read/write.
create policy "Enable access to all users" on contracts for all using (true) with check (true);
create policy "Enable access to all users" on periods for all using (true) with check (true);
create policy "Enable access to all users" on injections for all using (true) with check (true);
create policy "Enable access to all users" on orders for all using (true) with check (true);
