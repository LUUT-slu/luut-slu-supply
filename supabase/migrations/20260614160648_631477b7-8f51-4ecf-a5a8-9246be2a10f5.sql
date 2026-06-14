ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_status_check;

ALTER TABLE orders ADD CONSTRAINT orders_order_status_check
  CHECK (order_status IN ('NEW', 'ASSIGNED', 'ACCEPTED', 'ON_THE_WAY', 'COMPLETED', 'CANCELLED', 'NO_SALE', 'NO_SHOW', 'DECLINED'));