-- AlterTable: add school profile fields (logo URL, locality, city)
ALTER TABLE `School` ADD COLUMN `city` VARCHAR(191) NULL,
    ADD COLUMN `locality` VARCHAR(191) NULL,
    ADD COLUMN `logo` TEXT NULL;
