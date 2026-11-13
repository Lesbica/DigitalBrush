-- Phase 5: commission lifecycle.
-- Stages Sketch -> Lineart -> Color -> Final -> Completed (the old "Edits" stage becomes "Lineart"),
-- an artist can decline a direct commission, optional deadline, and the review state of the
-- latest submitted stage (used for "changes requested" and for auto-approval).

UPDATE `commissions` SET `status` = 'Open' WHERE `status` IS NULL;

ALTER TABLE `commissions`
  MODIFY `status` ENUM('Open','Sketch','Edits','Lineart','Color','Final','Completed','Cancelled','Declined') DEFAULT 'Open';

UPDATE `commissions` SET `status` = 'Lineart' WHERE `status` = 'Edits';

ALTER TABLE `commissions`
  MODIFY `status` ENUM('Open','Sketch','Lineart','Color','Final','Completed','Cancelled','Declined') NOT NULL DEFAULT 'Open',
  ADD COLUMN `Deadline` DATE NULL AFTER `Price`,
  ADD COLUMN `Review_State` ENUM('none','pending','changes_requested') NOT NULL DEFAULT 'none' AFTER `status`,
  ADD COLUMN `Stage_Submitted_At` DATETIME NULL AFTER `Review_State`;

CREATE INDEX `idx_commissions_review` ON `commissions` (`Review_State`, `Stage_Submitted_At`);
