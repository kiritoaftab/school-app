-- Retiring things, instead of deleting them.
--
-- History now RESTRICTs, so a subject that has ever been examined can't be
-- deleted at all. That is correct, but a school still needs a way to stop
-- offering a subject it no longer teaches, or to remove a teacher who has left.
-- Archiving is that way: the row stays forever so old report cards still read
-- correctly, but it disappears from every picker and roster.
--
-- `archiveKey` is the awkward part, and it is deliberate. MySQL has no partial
-- unique indexes, and it treats NULLs inside a unique index as distinct from
-- one another. So adding the nullable `archivedAt` to a unique tuple would stop
-- that tuple enforcing anything among live rows. A non-null integer is the only
-- shape that works: 0 for every live row, so live rows still collide with each
-- other, and `id` for archived rows, so an archived row collides with nothing.

-- AlterTable: Subject
ALTER TABLE `Subject`
    ADD COLUMN `archivedAt` DATETIME(3) NULL,
    ADD COLUMN `archivedById` INTEGER NULL,
    ADD COLUMN `archiveKey` INTEGER NOT NULL DEFAULT 0;

-- CreateIndex + DropIndex, in that order.
-- MySQL uses the leftmost column of an index to satisfy a foreign key, so the
-- replacement must exist before the original goes. Dropping first fails with
-- errno 1553. Subject also has `Subject_schoolId_idx`, but the same order is
-- used throughout for consistency with the earlier migrations.
CREATE UNIQUE INDEX `Subject_schoolId_name_archiveKey_key` ON `Subject`(`schoolId`, `name`, `archiveKey`);
DROP INDEX `Subject_schoolId_name_key` ON `Subject`;

-- AlterTable: Klass
ALTER TABLE `Klass`
    ADD COLUMN `archivedAt` DATETIME(3) NULL,
    ADD COLUMN `archivedById` INTEGER NULL,
    ADD COLUMN `archiveKey` INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX `Klass_schoolId_grade_section_archiveKey_key` ON `Klass`(`schoolId`, `grade`, `section`, `archiveKey`);
DROP INDEX `Klass_schoolId_grade_section_key` ON `Klass`;

-- AlterTable: User
-- Archiving frees the teacher's mobile for reuse, which is what a school
-- expects when someone leaves and the number is reassigned.
ALTER TABLE `User`
    ADD COLUMN `archivedAt` DATETIME(3) NULL,
    ADD COLUMN `archivedById` INTEGER NULL,
    ADD COLUMN `archiveKey` INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX `User_schoolId_phone_role_archiveKey_key` ON `User`(`schoolId`, `phone`, `role`, `archiveKey`);
DROP INDEX `User_schoolId_phone_role_key` ON `User`;

-- AlterTable: Student
-- No archiveKey: Student has no unique constraint to work around.
ALTER TABLE `Student`
    ADD COLUMN `archivedAt` DATETIME(3) NULL,
    ADD COLUMN `archivedById` INTEGER NULL;

-- AlterTable: Term
--
-- `klassKey`/`subjectKey` also fix a live bug. The old unique named the
-- nullable `klassId` and `subjectId` directly, and because MySQL treats index
-- NULLs as distinct it never fired for the common shape — an all-subjects exam
-- with klassId or subjectId NULL. `createMany({ skipDuplicates: true })` on
-- both exam-create paths was therefore a no-op, so the same exam name could be
-- created twice in one class and its marks split across the two rows.
ALTER TABLE `Term`
    ADD COLUMN `klassKey` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `subjectKey` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `archivedAt` DATETIME(3) NULL,
    ADD COLUMN `archivedById` INTEGER NULL,
    ADD COLUMN `archiveKey` INTEGER NOT NULL DEFAULT 0;

-- Backfill before the index exists, so it is built over correct data.
UPDATE `Term` SET `klassKey` = IFNULL(`klassId`, 0), `subjectKey` = IFNULL(`subjectId`, 0);

-- If this CREATE fails with a duplicate-key error, the duplicate exams the old
-- index never caught are real and need merging first:
--   SELECT schoolId, klassId, name, subjectId, COUNT(*) FROM Term
--   GROUP BY schoolId, klassId, name, subjectId HAVING COUNT(*) > 1;
CREATE UNIQUE INDEX `Term_schoolId_klassKey_name_subjectKey_archiveKey_key` ON `Term`(`schoolId`, `klassKey`, `name`, `subjectKey`, `archiveKey`);
DROP INDEX `Term_schoolId_klassId_name_subjectId_key` ON `Term`;
