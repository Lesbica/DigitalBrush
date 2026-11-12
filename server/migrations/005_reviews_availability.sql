-- Phase 5: reviews/ratings for artists and artist availability status.

CREATE TABLE IF NOT EXISTS `reviews` (
  `Review_ID` int NOT NULL AUTO_INCREMENT,
  `Commission_ID` int NOT NULL,
  `Artist_ID` int NOT NULL,
  `Customer_ID` int NOT NULL,
  `Rating` tinyint NOT NULL,
  `Text` text,
  `Created_At` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`Review_ID`),
  UNIQUE KEY `uq_review_commission` (`Commission_ID`),
  KEY `idx_reviews_artist` (`Artist_ID`, `Created_At`),
  CONSTRAINT `chk_review_rating` CHECK (`Rating` BETWEEN 1 AND 5),
  CONSTRAINT `fk_reviews_commission` FOREIGN KEY (`Commission_ID`) REFERENCES `commissions` (`Commission_ID`) ON DELETE CASCADE,
  CONSTRAINT `fk_reviews_artist` FOREIGN KEY (`Artist_ID`) REFERENCES `creators` (`Creator_ID`) ON DELETE CASCADE,
  CONSTRAINT `fk_reviews_customer` FOREIGN KEY (`Customer_ID`) REFERENCES `creators` (`Creator_ID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- open = takes commissions, busy = queue is full, vacation = away
ALTER TABLE `creators`
  ADD COLUMN `Availability` ENUM('open', 'busy', 'vacation') NOT NULL DEFAULT 'open' AFTER `languages`;
