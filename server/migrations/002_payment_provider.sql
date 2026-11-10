-- Which payment provider an order was created with (wayforpay, fondy).
-- Existing orders were all created through Fondy.
ALTER TABLE `payment_orders`
  ADD COLUMN `Provider` VARCHAR(20) NOT NULL DEFAULT 'fondy' AFTER `Currency`;
