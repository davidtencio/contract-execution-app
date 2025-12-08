-- Migration: Add contract_items table

create table if not exists contract_items (
  id bigint primary key generated always as identity,
  contract_id bigint references contracts(id) on delete cascade,
  codigo text not null,
  nombre text not null,
  moneda text default 'USD',
  precio_unitario numeric(18,2) default 0,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Index for performance
create index if not exists idx_contract_items_contract on contract_items(contract_id);

-- Enable RLS
alter table contract_items enable row level security;

-- Public Access Policy (For MVP)
create policy "Enable access to all users" on contract_items for all using (true) with check (true);
