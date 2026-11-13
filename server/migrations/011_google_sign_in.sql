-- Sign-in with Google: the stable Google account id ("sub") of a linked account.
-- Adds a column only; no existing data is changed.
ALTER TABLE `creators`
  ADD COLUMN `Google_ID` varchar(64) NULL AFTER `Email_Verified`,
  ADD UNIQUE KEY `uq_creators_google` (`Google_ID`);
