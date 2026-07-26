-- PhotoAlbum gets the day it is about (sports day, field trip …). Existing rows
-- are backfilled from createdAt, then the column becomes required.
ALTER TABLE `PhotoAlbum` ADD COLUMN `date` DATE NULL;
UPDATE `PhotoAlbum` SET `date` = DATE(`createdAt`) WHERE `date` IS NULL;
ALTER TABLE `PhotoAlbum` MODIFY COLUMN `date` DATE NOT NULL;

-- Album listings sort by date within a school. The composite index is created
-- BEFORE the old one is dropped: `PhotoAlbum_schoolId_idx` is the only index
-- backing `PhotoAlbum_schoolId_fkey`, and MySQL refuses to drop it (errno 1553)
-- until another index has schoolId as its leftmost column.
CREATE INDEX `PhotoAlbum_schoolId_date_idx` ON `PhotoAlbum`(`schoolId`, `date`);
DROP INDEX `PhotoAlbum_schoolId_idx` ON `PhotoAlbum`;

-- Photos: stable upload order, and S3 URLs outgrow VARCHAR(191).
-- (albumId is already indexed by its foreign key.)
ALTER TABLE `Photo` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
ALTER TABLE `Photo` MODIFY COLUMN `url` TEXT NOT NULL;
