-- Email change must be proven before it takes effect: the new address is kept on the
-- confirmation token and is written to creators.Email only when that token is consumed.
-- NULL for ordinary registration / re-send confirmation tokens.

ALTER TABLE `user_tokens`
  ADD COLUMN `New_Email` varchar(255) NULL AFTER `Purpose`;
