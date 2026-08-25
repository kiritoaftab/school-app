-- One teacher per (class, subject).
--
-- Pre-flight: this fails if any class already has a subject taught by two
-- teachers. Find them with
--   SELECT klassId, subjectId, COUNT(*) c, GROUP_CONCAT(teacherId)
--   FROM TeachingAssignment GROUP BY klassId, subjectId HAVING c > 1;
-- and drop the losing rows by hand before deploying.
CREATE UNIQUE INDEX `TeachingAssignment_klassId_subjectId_key`
  ON `TeachingAssignment`(`klassId`, `subjectId`);
