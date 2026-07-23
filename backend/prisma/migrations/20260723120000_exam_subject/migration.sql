-- Add a subject dimension to exams (Term). subjectId NULL = exam covers all
-- subjects (graded per subject, today's behaviour); set = single-subject test.
-- Existing rows keep subjectId NULL, so current exams are untouched.

-- AlterTable
ALTER TABLE `Term` ADD COLUMN `subjectId` INTEGER NULL;

-- CreateIndex
-- Created before the old unique is dropped: MySQL uses the leftmost column of a
-- unique index to satisfy the schoolId foreign key, so one must always cover it.
CREATE UNIQUE INDEX `Term_schoolId_klassId_name_subjectId_key` ON `Term`(`schoolId`, `klassId`, `name`, `subjectId`);

-- DropIndex
DROP INDEX `Term_schoolId_klassId_name_key` ON `Term`;

-- CreateIndex
CREATE INDEX `Term_subjectId_idx` ON `Term`(`subjectId`);

-- AddForeignKey
ALTER TABLE `Term` ADD CONSTRAINT `Term_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
