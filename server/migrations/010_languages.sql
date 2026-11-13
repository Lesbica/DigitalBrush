-- Interface language of each user (for notifications and emails sent to them) and
-- notifications stored as text keys, so they are shown in the language the reader uses.
-- Adds columns only; no existing data is changed.

ALTER TABLE `creators`
  ADD COLUMN `Language` enum('uk','en') NOT NULL DEFAULT 'uk' AFTER `Role`;

-- {"title": {"key": "...", "params": {...}}, "body": {...}}; Title/Body keep the text rendered
-- in the recipient's language for emails and older clients
ALTER TABLE `notifications`
  ADD COLUMN `Content` json NULL AFTER `Body`;
