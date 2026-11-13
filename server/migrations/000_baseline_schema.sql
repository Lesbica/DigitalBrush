-- Baseline schema of PaintingsDB as it was before migration 001 (from the MySQL dump of 2026-11-09).
-- Only creates missing tables, so it is a no-op on existing databases and builds a fresh one from scratch.
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `commissions` (
  `Commission_ID` int NOT NULL AUTO_INCREMENT,
  `Title` varchar(255) NOT NULL,
  `Description` text,
  `Category` varchar(100) DEFAULT NULL,
  `Style` varchar(100) DEFAULT NULL,
  `Size` varchar(100) DEFAULT NULL,
  `Format` varchar(100) DEFAULT NULL,
  `Price` decimal(10,2) DEFAULT NULL,
  `ReferenceImage` longblob,
  `status` enum('Open','Sketch','Edits','Completed','Cancelled') DEFAULT 'Open',
  `Type` enum('public','direct') NOT NULL,
  `Customer_ID` int NOT NULL,
  `Creator_ID` int DEFAULT NULL,
  `Created_At` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `Updated_At` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `Image2` longblob,
  `Image3` longblob,
  `Image4` longblob,
  `Image5` longblob,
  `is_paid` tinyint(1) DEFAULT '0',
  `ResultImage` longblob,
  PRIMARY KEY (`Commission_ID`),
  KEY `idx_customer` (`Customer_ID`),
  KEY `idx_creator` (`Creator_ID`),
  CONSTRAINT `fk_commission_creator` FOREIGN KEY (`Creator_ID`) REFERENCES `creators` (`Creator_ID`) ON DELETE SET NULL,
  CONSTRAINT `fk_commission_customer` FOREIGN KEY (`Customer_ID`) REFERENCES `creators` (`Creator_ID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `creators` (
  `Creator_ID` int NOT NULL AUTO_INCREMENT,
  `Name` varchar(255) DEFAULT NULL,
  `Email` varchar(255) DEFAULT NULL,
  `Password` varchar(255) DEFAULT NULL,
  `Birthday` date DEFAULT NULL,
  `Other_Details` text,
  `Image` longblob,
  `styles` text,
  `likes` int DEFAULT '0',
  `Instagram` varchar(255) DEFAULT NULL,
  `Behance` varchar(255) DEFAULT NULL,
  `TikTok` varchar(255) DEFAULT NULL,
  `languages` text,
  PRIMARY KEY (`Creator_ID`),
  UNIQUE KEY `Email` (`Email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `languages` (
  `Language_ID` int NOT NULL AUTO_INCREMENT,
  `Name` varchar(100) NOT NULL,
  PRIMARY KEY (`Language_ID`),
  UNIQUE KEY `Name` (`Name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `senderId` bigint NOT NULL,
  `receiverId` bigint NOT NULL,
  `commissionId` bigint NOT NULL,
  `type` varchar(20) DEFAULT 'text',
  `content` text,
  `status` varchar(20) DEFAULT 'unread',
  `timestamp` datetime DEFAULT CURRENT_TIMESTAMP,
  `image` longblob,
  PRIMARY KEY (`id`),
  KEY `idx_commission` (`commissionId`),
  KEY `idx_sender` (`senderId`),
  KEY `idx_receiver` (`receiverId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `orderpaintings` (
  `Order_ID` int DEFAULT NULL,
  `Image` longblob
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `painting_batches` (
  `Batch_ID` int NOT NULL AUTO_INCREMENT,
  `Created_At` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`Batch_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `painting_images` (
  `Image_ID` int NOT NULL AUTO_INCREMENT,
  `Batch_ID` int NOT NULL,
  `Image` longblob NOT NULL,
  PRIMARY KEY (`Image_ID`),
  KEY `Batch_ID` (`Batch_ID`),
  CONSTRAINT `painting_images_ibfk_1` FOREIGN KEY (`Batch_ID`) REFERENCES `painting_batches` (`Batch_ID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `painting_likes` (
  `Painting_ID` int NOT NULL,
  `User_ID` int NOT NULL,
  `Created_At` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_painting_user` (`Painting_ID`,`User_ID`),
  KEY `idx_painting` (`Painting_ID`),
  KEY `idx_user` (`User_ID`),
  CONSTRAINT `fk_pl_painting` FOREIGN KEY (`Painting_ID`) REFERENCES `paintings` (`Painting_ID`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_pl_user` FOREIGN KEY (`User_ID`) REFERENCES `creators` (`Creator_ID`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `paintings` (
  `Painting_ID` int NOT NULL AUTO_INCREMENT,
  `Title` varchar(255) NOT NULL,
  `Description` text,
  `Creation_Date` date DEFAULT NULL,
  `Image` longblob,
  `Author` varchar(255) NOT NULL,
  `Creator_ID` int NOT NULL,
  `Style` varchar(100) DEFAULT NULL,
  `Price` decimal(10,2) DEFAULT NULL,
  `Batch_ID` int DEFAULT NULL,
  `width` int DEFAULT NULL,
  `height` int DEFAULT NULL,
  `likes` int DEFAULT NULL,
  `Category` varchar(255) DEFAULT NULL,
  `Format` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`Painting_ID`),
  KEY `fk_batch` (`Batch_ID`),
  CONSTRAINT `fk_batch` FOREIGN KEY (`Batch_ID`) REFERENCES `painting_batches` (`Batch_ID`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `payment_order_items` (
  `Order_ID` varchar(255) NOT NULL,
  `Painting_ID` int NOT NULL,
  PRIMARY KEY (`Order_ID`,`Painting_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `payment_orders` (
  `Order_ID` varchar(255) NOT NULL,
  `User_ID` int NOT NULL,
  `Status` varchar(50) DEFAULT 'pending',
  `Created_At` datetime DEFAULT CURRENT_TIMESTAMP,
  `Type` varchar(50) DEFAULT 'cart',
  `Target_ID` int DEFAULT '0',
  PRIMARY KEY (`Order_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `user_purchases` (
  `Purchase_ID` int NOT NULL AUTO_INCREMENT,
  `User_ID` int NOT NULL,
  `Painting_ID` int NOT NULL,
  `Purchase_Date` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`Purchase_ID`),
  UNIQUE KEY `unique_purchase` (`User_ID`,`Painting_ID`),
  KEY `Painting_ID` (`Painting_ID`),
  CONSTRAINT `user_purchases_ibfk_1` FOREIGN KEY (`User_ID`) REFERENCES `creators` (`Creator_ID`) ON DELETE CASCADE,
  CONSTRAINT `user_purchases_ibfk_2` FOREIGN KEY (`Painting_ID`) REFERENCES `paintings` (`Painting_ID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET FOREIGN_KEY_CHECKS = 1;
