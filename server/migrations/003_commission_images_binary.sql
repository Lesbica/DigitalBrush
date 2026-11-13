-- Commission images used to be stored as data-URI text inside LONGBLOB columns.
-- New uploads are stored as raw binary; convert the old rows too (≈25% smaller).
-- Rows whose base64 cannot be decoded are left untouched (the reader still understands data URIs).

UPDATE `commissions` SET `ReferenceImage` = FROM_BASE64(SUBSTRING(`ReferenceImage`, LOCATE(',', `ReferenceImage`) + 1))
 WHERE `ReferenceImage` LIKE 'data:image/%;base64,%'
   AND FROM_BASE64(SUBSTRING(`ReferenceImage`, LOCATE(',', `ReferenceImage`) + 1)) IS NOT NULL;

UPDATE `commissions` SET `Image2` = FROM_BASE64(SUBSTRING(`Image2`, LOCATE(',', `Image2`) + 1))
 WHERE `Image2` LIKE 'data:image/%;base64,%'
   AND FROM_BASE64(SUBSTRING(`Image2`, LOCATE(',', `Image2`) + 1)) IS NOT NULL;

UPDATE `commissions` SET `Image3` = FROM_BASE64(SUBSTRING(`Image3`, LOCATE(',', `Image3`) + 1))
 WHERE `Image3` LIKE 'data:image/%;base64,%'
   AND FROM_BASE64(SUBSTRING(`Image3`, LOCATE(',', `Image3`) + 1)) IS NOT NULL;

UPDATE `commissions` SET `Image4` = FROM_BASE64(SUBSTRING(`Image4`, LOCATE(',', `Image4`) + 1))
 WHERE `Image4` LIKE 'data:image/%;base64,%'
   AND FROM_BASE64(SUBSTRING(`Image4`, LOCATE(',', `Image4`) + 1)) IS NOT NULL;

UPDATE `commissions` SET `Image5` = FROM_BASE64(SUBSTRING(`Image5`, LOCATE(',', `Image5`) + 1))
 WHERE `Image5` LIKE 'data:image/%;base64,%'
   AND FROM_BASE64(SUBSTRING(`Image5`, LOCATE(',', `Image5`) + 1)) IS NOT NULL;

UPDATE `commissions` SET `ResultImage` = FROM_BASE64(SUBSTRING(`ResultImage`, LOCATE(',', `ResultImage`) + 1))
 WHERE `ResultImage` LIKE 'data:image/%;base64,%'
   AND FROM_BASE64(SUBSTRING(`ResultImage`, LOCATE(',', `ResultImage`) + 1)) IS NOT NULL;
