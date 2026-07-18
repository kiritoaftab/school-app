-- Scope exams (Term) to a class. Existing rows keep klassId NULL, so any
-- school-wide terms already referenced by Result/ResultMeta are untouched.

-- AlterTable
ALTER TABLE `Term` ADD COLUMN `klassId` INTEGER NULL;

-- CreateIndex
-- Created before the old unique is dropped: MySQL uses the leftmost column of
-- a unique index to satisfy the schoolId foreign key, so one must always cover
-- it. Dropping first fails with errno 1553.
CREATE UNIQUE INDEX `Term_schoolId_klassId_name_key` ON `Term`(`schoolId`, `klassId`, `name`);

-- DropIndex
DROP INDEX `Term_schoolId_name_key` ON `Term`;

-- CreateIndex
CREATE INDEX `Term_klassId_idx` ON `Term`(`klassId`);

-- AddForeignKey
ALTER TABLE `Term` ADD CONSTRAINT `Term_klassId_fkey` FOREIGN KEY (`klassId`) REFERENCES `Klass`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
