-- History must outlive the catalogue.
--
-- Every foreign key below used to CASCADE, so a single DELETE on a Subject,
-- Klass, Term or Student silently destroyed marks, ranks, teacher comments and
-- registers school-wide, for every year. The worst path was two hops and had no
-- guard at all: deleting a Subject cascaded to Term (single-subject exams) and
-- from there to Result and ResultMeta.
--
-- They now RESTRICT: InnoDB refuses the delete, and the API turns that refusal
-- into a 409 that names what depends on the row. Retiring a subject or a teacher
-- becomes an archive, not a delete.
--
-- Term.subjectId and Term.klassId are RESTRICT rather than SET NULL on purpose.
-- A null subjectId already means "this exam covers all subjects", so nulling it
-- would relabel a historic single-subject test as an all-subjects exam.
--
-- No column is added and no row is rewritten here. Dropping a foreign key in
-- MySQL leaves its backing index in place, so drop-then-re-add needs no index
-- ordering (unlike the unique-index swaps in earlier migrations).

-- 1. An exam must not die with its subject or its class.
ALTER TABLE `Term` DROP FOREIGN KEY `Term_subjectId_fkey`;
ALTER TABLE `Term` ADD CONSTRAINT `Term_subjectId_fkey`
  FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Term` DROP FOREIGN KEY `Term_klassId_fkey`;
ALTER TABLE `Term` ADD CONSTRAINT `Term_klassId_fkey`
  FOREIGN KEY (`klassId`) REFERENCES `Klass`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2. Marks must not die with the exam row.
ALTER TABLE `Result` DROP FOREIGN KEY `Result_termId_fkey`;
ALTER TABLE `Result` ADD CONSTRAINT `Result_termId_fkey`
  FOREIGN KEY (`termId`) REFERENCES `Term`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ResultMeta` DROP FOREIGN KEY `ResultMeta_termId_fkey`;
ALTER TABLE `ResultMeta` ADD CONSTRAINT `ResultMeta_termId_fkey`
  FOREIGN KEY (`termId`) REFERENCES `Term`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3. Nor with the child. A pupil leaving is not a reason to unwrite their year.
ALTER TABLE `Result` DROP FOREIGN KEY `Result_studentId_fkey`;
ALTER TABLE `Result` ADD CONSTRAINT `Result_studentId_fkey`
  FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ResultMeta` DROP FOREIGN KEY `ResultMeta_studentId_fkey`;
ALTER TABLE `ResultMeta` ADD CONSTRAINT `ResultMeta_studentId_fkey`
  FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Attendance` DROP FOREIGN KEY `Attendance_studentId_fkey`;
ALTER TABLE `Attendance` ADD CONSTRAINT `Attendance_studentId_fkey`
  FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Enrollment` DROP FOREIGN KEY `Enrollment_studentId_fkey`;
ALTER TABLE `Enrollment` ADD CONSTRAINT `Enrollment_studentId_fkey`
  FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `LeaveRequest` DROP FOREIGN KEY `LeaveRequest_studentId_fkey`;
ALTER TABLE `LeaveRequest` ADD CONSTRAINT `LeaveRequest_studentId_fkey`
  FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. Which class a child sat in, and the homework set there, is history too.
ALTER TABLE `Enrollment` DROP FOREIGN KEY `Enrollment_klassId_fkey`;
ALTER TABLE `Enrollment` ADD CONSTRAINT `Enrollment_klassId_fkey`
  FOREIGN KEY (`klassId`) REFERENCES `Klass`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `DiaryEntry` DROP FOREIGN KEY `DiaryEntry_klassId_fkey`;
ALTER TABLE `DiaryEntry` ADD CONSTRAINT `DiaryEntry_klassId_fkey`
  FOREIGN KEY (`klassId`) REFERENCES `Klass`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5. The timetable is not collateral damage of a catalogue tidy-up.
ALTER TABLE `TeachingAssignment` DROP FOREIGN KEY `TeachingAssignment_subjectId_fkey`;
ALTER TABLE `TeachingAssignment` ADD CONSTRAINT `TeachingAssignment_subjectId_fkey`
  FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `TeachingAssignment` DROP FOREIGN KEY `TeachingAssignment_klassId_fkey`;
ALTER TABLE `TeachingAssignment` ADD CONSTRAINT `TeachingAssignment_klassId_fkey`
  FOREIGN KEY (`klassId`) REFERENCES `Klass`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `TeachingAssignment` DROP FOREIGN KEY `TeachingAssignment_teacherId_fkey`;
ALTER TABLE `TeachingAssignment` ADD CONSTRAINT `TeachingAssignment_teacherId_fkey`
  FOREIGN KEY (`teacherId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
