-- Automatic payouts to a card through WayForPay (Account2Card / P2P_CREDIT).
-- The artist links a card once on the WayForPay page (Card Verify); only the encrypted card token
-- and the masked number are stored. Existing withdrawals keep their values (enums only get new ones).

CREATE TABLE IF NOT EXISTS `payout_cards` (
  `Card_ID` int NOT NULL AUTO_INCREMENT,
  `User_ID` int NOT NULL,
  `Provider` varchar(20) NOT NULL,
  `Token_Enc` varchar(512) NOT NULL,
  `Card_Mask` varchar(20) NOT NULL,
  `Card_Type` varchar(20) NULL,
  `Created_At` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`Card_ID`),
  UNIQUE KEY `uq_payout_cards_user` (`User_ID`),
  CONSTRAINT `fk_payout_cards_user` FOREIGN KEY (`User_ID`) REFERENCES `creators` (`Creator_ID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `payout_card_verifications` (
  `Order_ID` varchar(40) NOT NULL,
  `User_ID` int NOT NULL,
  `Status` enum('pending','approved','failed') NOT NULL DEFAULT 'pending',
  `Created_At` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `Updated_At` datetime NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`Order_ID`),
  KEY `idx_card_verifications_user` (`User_ID`, `Created_At`),
  CONSTRAINT `fk_card_verifications_user` FOREIGN KEY (`User_ID`) REFERENCES `creators` (`Creator_ID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- card = automatic payout; processing = sent to the provider, result not known yet
ALTER TABLE `withdrawals`
  MODIFY `Method` enum('iban','card') NOT NULL DEFAULT 'iban',
  MODIFY `Status` enum('pending','processing','paid','rejected') NOT NULL DEFAULT 'pending',
  ADD COLUMN `Provider_Status` varchar(40) NULL AFTER `Note`;
