-- Phase 0 security fixes. Run once against PaintingsDB BEFORE deploying the new backend.

-- 1. Payment orders keep the server-calculated amount (in kopecks) and currency,
--    so the Fondy callback can be checked against them.
ALTER TABLE `payment_orders`
  ADD COLUMN `Amount` INT NULL AFTER `Status`,
  ADD COLUMN `Currency` CHAR(3) NOT NULL DEFAULT 'UAH' AFTER `Amount`;

-- 2. Session store (express-mysql-session creates this table itself if the DB user
--    has CREATE privilege; otherwise create it here).
CREATE TABLE IF NOT EXISTS `sessions` (
  `session_id` varchar(128) COLLATE utf8mb4_bin NOT NULL,
  `expires` int unsigned NOT NULL,
  `data` mediumtext COLLATE utf8mb4_bin,
  PRIMARY KEY (`session_id`)
) ENGINE=InnoDB;
