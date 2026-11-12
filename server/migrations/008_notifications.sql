-- Phase 5: in-app notifications (also delivered live over socket.io; important ones by email).
CREATE TABLE IF NOT EXISTS `notifications` (
  `Notification_ID` int NOT NULL AUTO_INCREMENT,
  `User_ID` int NOT NULL,
  `Type` varchar(40) NOT NULL,
  `Title` varchar(200) NOT NULL,
  `Body` varchar(500) NULL,
  `Link` varchar(255) NULL,
  `Commission_ID` int NULL,
  `Read_At` datetime NULL,
  `Created_At` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`Notification_ID`),
  KEY `idx_notifications_user` (`User_ID`, `Read_At`, `Created_At`),
  CONSTRAINT `fk_notifications_user` FOREIGN KEY (`User_ID`) REFERENCES `creators` (`Creator_ID`) ON DELETE CASCADE,
  CONSTRAINT `fk_notifications_commission` FOREIGN KEY (`Commission_ID`) REFERENCES `commissions` (`Commission_ID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
