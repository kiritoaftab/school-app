-- Allow subject-less diary entries (general "note for the day").
ALTER TABLE `DiaryEntry` MODIFY `subject` VARCHAR(191) NULL;
