-- Migration: Enable Cascade Delete for Contracts
-- This ensures that when a contract is deleted, all its related data (items, periods, orders, injections) are also deleted automatically.

-- 1. Contract Items
ALTER TABLE contract_items DROP CONSTRAINT IF EXISTS contract_items_contract_id_fkey;
ALTER TABLE contract_items 
    ADD CONSTRAINT contract_items_contract_id_fkey 
    FOREIGN KEY (contract_id) 
    REFERENCES contracts(id) 
    ON DELETE CASCADE;

-- 2. Periods
ALTER TABLE periods DROP CONSTRAINT IF EXISTS periods_contract_id_fkey;
ALTER TABLE periods 
    ADD CONSTRAINT periods_contract_id_fkey 
    FOREIGN KEY (contract_id) 
    REFERENCES contracts(id) 
    ON DELETE CASCADE;

-- 3. Orders (linked to Periods, so if Period goes, Order goes)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_period_id_fkey;
ALTER TABLE orders 
    ADD CONSTRAINT orders_period_id_fkey 
    FOREIGN KEY (period_id) 
    REFERENCES periods(id) 
    ON DELETE CASCADE;

-- 4. Injections (linked to Periods)
ALTER TABLE injections DROP CONSTRAINT IF EXISTS injections_period_id_fkey;
ALTER TABLE injections 
    ADD CONSTRAINT injections_period_id_fkey 
    FOREIGN KEY (period_id) 
    REFERENCES periods(id) 
    ON DELETE CASCADE;
