-- Phase 2: data integrity.
-- 1) remove orphaned rows that would break the new foreign keys,
-- 2) align column types, 3) add foreign keys, 4) add indexes for list filters,
-- 5) drop tables the application does not use.
-- Take a backup before running it on a database with real data.

-- ---------- 1. Orphans and inconsistent rows ----------

-- Chat messages of commissions that no longer exist
DELETE m FROM messages m
  LEFT JOIN commissions c ON c.Commission_ID = m.commissionId
 WHERE c.Commission_ID IS NULL;

-- Messages from/to deleted users
DELETE m FROM messages m
  LEFT JOIN creators s ON s.Creator_ID = m.senderId
  LEFT JOIN creators r ON r.Creator_ID = m.receiverId
 WHERE s.Creator_ID IS NULL OR r.Creator_ID IS NULL;

-- Paintings whose author no longer exists
DELETE p FROM paintings p
  LEFT JOIN creators c ON c.Creator_ID = p.Creator_ID
 WHERE c.Creator_ID IS NULL;

-- Payment data that points to missing users / orders / paintings
DELETE o FROM payment_orders o
  LEFT JOIN creators c ON c.Creator_ID = o.User_ID
 WHERE c.Creator_ID IS NULL;
DELETE i FROM payment_order_items i
  LEFT JOIN payment_orders o ON o.Order_ID = i.Order_ID
 WHERE o.Order_ID IS NULL;
DELETE i FROM payment_order_items i
  LEFT JOIN paintings p ON p.Painting_ID = i.Painting_ID
 WHERE p.Painting_ID IS NULL;

-- Image batches left behind by failed/old uploads (their painting_images go with them: ON DELETE CASCADE)
DELETE b FROM painting_batches b
 WHERE NOT EXISTS (SELECT 1 FROM paintings p WHERE p.Batch_ID = b.Batch_ID);

-- A commission cannot be "in progress" without an artist: put such rows back to Open
UPDATE commissions SET status = 'Open'
 WHERE Creator_ID IS NULL AND status IN ('Sketch', 'Edits');

UPDATE paintings SET likes = 0 WHERE likes IS NULL;

-- ---------- 2. Column types ----------

-- Must match the INT primary keys they reference
ALTER TABLE messages
  MODIFY senderId INT NOT NULL,
  MODIFY receiverId INT NOT NULL,
  MODIFY commissionId INT NOT NULL;

ALTER TABLE paintings
  MODIFY likes INT NOT NULL DEFAULT 0;

-- ---------- 3. Foreign keys ----------

-- An artist with paintings cannot be deleted silently (buyers keep access to purchases)
ALTER TABLE paintings
  ADD CONSTRAINT fk_paintings_creator FOREIGN KEY (Creator_ID) REFERENCES creators (Creator_ID) ON DELETE RESTRICT;

ALTER TABLE messages
  ADD CONSTRAINT fk_messages_commission FOREIGN KEY (commissionId) REFERENCES commissions (Commission_ID) ON DELETE CASCADE,
  ADD CONSTRAINT fk_messages_sender FOREIGN KEY (senderId) REFERENCES creators (Creator_ID) ON DELETE CASCADE,
  ADD CONSTRAINT fk_messages_receiver FOREIGN KEY (receiverId) REFERENCES creators (Creator_ID) ON DELETE CASCADE;

-- Payment history is kept: a user with orders cannot be deleted silently
ALTER TABLE payment_orders
  ADD CONSTRAINT fk_payment_orders_user FOREIGN KEY (User_ID) REFERENCES creators (Creator_ID) ON DELETE RESTRICT;

ALTER TABLE payment_order_items
  ADD CONSTRAINT fk_poi_order FOREIGN KEY (Order_ID) REFERENCES payment_orders (Order_ID) ON DELETE CASCADE,
  ADD CONSTRAINT fk_poi_painting FOREIGN KEY (Painting_ID) REFERENCES paintings (Painting_ID) ON DELETE CASCADE;

-- ---------- 4. Indexes for list filters ----------

CREATE INDEX idx_paintings_category ON paintings (Category);
CREATE INDEX idx_paintings_style ON paintings (Style);
CREATE INDEX idx_commissions_list ON commissions (Type, status, Created_At);
CREATE INDEX idx_payment_orders_status ON payment_orders (Status);

-- ---------- 5. Unused tables ----------

-- Legacy, never read by the application (no primary key, superseded by payment_orders/user_purchases)
DROP TABLE IF EXISTS orderpaintings;
-- Never read: user languages are stored as JSON in creators.languages
DROP TABLE IF EXISTS languages;
