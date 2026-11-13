-- Phase 5: artist wallet — earnings from sales/commissions and withdrawal requests.
-- Amounts are in kopecks. Earnings are positive, withdrawals negative.
-- Commission earnings stay "pending" (escrow) until the commission is completed.

CREATE TABLE IF NOT EXISTS `withdrawals` (
  `Withdrawal_ID` int NOT NULL AUTO_INCREMENT,
  `User_ID` int NOT NULL,
  `Amount` int NOT NULL,
  `Method` ENUM('iban') NOT NULL DEFAULT 'iban',
  `Destination` varchar(34) NOT NULL,
  `Status` ENUM('pending', 'paid', 'rejected') NOT NULL DEFAULT 'pending',
  `Note` varchar(255) NULL,
  `Created_At` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `Processed_At` datetime NULL,
  PRIMARY KEY (`Withdrawal_ID`),
  KEY `idx_withdrawals_user` (`User_ID`, `Created_At`),
  KEY `idx_withdrawals_status` (`Status`),
  CONSTRAINT `chk_withdrawal_amount` CHECK (`Amount` > 0),
  CONSTRAINT `fk_withdrawals_user` FOREIGN KEY (`User_ID`) REFERENCES `creators` (`Creator_ID`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `wallet_transactions` (
  `Txn_ID` int NOT NULL AUTO_INCREMENT,
  `User_ID` int NOT NULL,
  `Type` ENUM('sale', 'commission', 'withdrawal', 'adjustment') NOT NULL,
  `Amount` int NOT NULL,
  `Fee` int NOT NULL DEFAULT 0,
  `Status` ENUM('pending', 'completed', 'rejected') NOT NULL DEFAULT 'completed',
  -- unique reference, makes crediting idempotent (e.g. order:<id>:painting:<id>)
  `Ref` varchar(120) NOT NULL,
  `Order_ID` varchar(255) NULL,
  `Commission_ID` int NULL,
  `Painting_ID` int NULL,
  `Withdrawal_ID` int NULL,
  `Payer_ID` int NULL,
  `Description` varchar(255) NULL,
  `Created_At` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `Updated_At` datetime NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`Txn_ID`),
  UNIQUE KEY `uq_wallet_ref` (`Ref`),
  KEY `idx_wallet_user` (`User_ID`, `Created_At`),
  KEY `idx_wallet_commission` (`Commission_ID`),
  CONSTRAINT `fk_wallet_user` FOREIGN KEY (`User_ID`) REFERENCES `creators` (`Creator_ID`) ON DELETE RESTRICT,
  CONSTRAINT `fk_wallet_commission` FOREIGN KEY (`Commission_ID`) REFERENCES `commissions` (`Commission_ID`) ON DELETE SET NULL,
  CONSTRAINT `fk_wallet_painting` FOREIGN KEY (`Painting_ID`) REFERENCES `paintings` (`Painting_ID`) ON DELETE SET NULL,
  CONSTRAINT `fk_wallet_withdrawal` FOREIGN KEY (`Withdrawal_ID`) REFERENCES `withdrawals` (`Withdrawal_ID`) ON DELETE SET NULL,
  CONSTRAINT `fk_wallet_payer` FOREIGN KEY (`Payer_ID`) REFERENCES `creators` (`Creator_ID`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
