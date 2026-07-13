import { prisma } from '../db.js';
import { HttpError } from './http.js';

/** Ensure the parent is linked to the student and both are in the same school. */
export async function assertParentOwnsStudent(
  parentUserId: number,
  schoolId: number,
  studentId: number,
) {
  const link = await prisma.parentStudentLink.findFirst({
    where: { parentUserId, studentId, student: { schoolId } },
  });
  if (!link) throw new HttpError(403, 'Not your student');
}

/** Return the class id a student is currently enrolled in (latest year). */
export async function studentClassId(studentId: number): Promise<number | null> {
  const enr = await prisma.enrollment.findFirst({
    where: { studentId },
    orderBy: { academicYear: 'desc' },
  });
  return enr?.klassId ?? null;
}
