-- Phase 5: accounts — roles, email verification, one-time tokens (email confirmation, password reset).

ALTER TABLE `creators`
  ADD COLUMN `Role` ENUM('artist', 'customer') NOT NULL DEFAULT 'customer' AFTER `Password`,
  ADD COLUMN `Email_Verified` TINYINT(1) NOT NULL DEFAULT 0 AFTER `Email`,
  ADD COLUMN `Created_At` DATETIME NULL DEFAULT CURRENT_TIMESTAMP;

-- Accounts that existed before verification was introduced count as verified
UPDATE `creators` SET `Email_Verified` = 1;

-- Existing users who sell paintings or worked on commissions are artists
UPDATE `creators` c SET c.`Role` = 'artist'
 WHERE EXISTS (SELECT 1 FROM `paintings` p WHERE p.`Creator_ID` = c.`Creator_ID`)
    OR EXISTS (SELECT 1 FROM `commissions` m WHERE m.`Creator_ID` = c.`Creator_ID`);

-- Only a SHA-256 hash of each token is stored; the token itself is sent by email
CREATE TABLE IF NOT EXISTS `user_tokens` (
  `Token_Hash` char(64) NOT NULL,
  `User_ID` int NOT NULL,
  `Purpose` ENUM('verify_email', 'reset_password') NOT NULL,
  `Expires_At` datetime NOT NULL,
  `Used_At` datetime NULL,
  `Created_At` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`Token_Hash`),
  KEY `idx_user_tokens_user` (`User_ID`, `Purpose`),
  CONSTRAINT `fk_user_tokens_user` FOREIGN KEY (`User_ID`) REFERENCES `creators` (`Creator_ID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
