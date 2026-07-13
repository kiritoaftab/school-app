import { PrismaClient, type AttendanceStatus } from '@prisma/client';

const prisma = new PrismaClient();

/** Deterministic sample content — all invented names, no real student data. */
async function main() {
  console.log('🌱 Seeding Greenwood…');

  // wipe (dev only) — order respects FKs via cascade from School
  await prisma.otpCode.deleteMany();
  await prisma.school.deleteMany();

  const school = await prisma.school.create({
    data: { name: 'Greenwood International School' },
  });
  const schoolId = school.id;

  // --- Users ---
  const admin = await prisma.user.create({
    data: { schoolId, name: 'Anita Rao', phone: '9000000001', role: 'ADMIN' },
  });
  const teacher = await prisma.user.create({
    data: { schoolId, name: 'Meera Kapoor', phone: '9000000002', role: 'TEACHER' },
  });
  const parent = await prisma.user.create({
    data: { schoolId, name: 'Rahul Verma', phone: '9000000003', role: 'PARENT' },
  });

  // --- Class ---
  const klass = await prisma.klass.create({
    data: { schoolId, grade: 'Grade 4', section: 'B', classTeacherId: teacher.id },
  });

  // --- Students (parent Rahul has two children) ---
  const year = String(new Date().getFullYear());
  const aarav = await prisma.student.create({
    data: { schoolId, name: 'Aarav Verma', admissionNo: 'GW-1042' },
  });
  const ananya = await prisma.student.create({
    data: { schoolId, name: 'Ananya Verma', admissionNo: 'GW-1043' },
  });
  // a classmate so attendance/ack aggregates look real
  const kabir = await prisma.student.create({
    data: { schoolId, name: 'Kabir Nair', admissionNo: 'GW-1044' },
  });

  for (const s of [aarav, ananya, kabir]) {
    await prisma.enrollment.create({
      data: { studentId: s.id, klassId: klass.id, academicYear: year },
    });
  }
  await prisma.parentStudentLink.createMany({
    data: [
      { parentUserId: parent.id, studentId: aarav.id, relation: 'Father' },
      { parentUserId: parent.id, studentId: ananya.id, relation: 'Father' },
    ],
  });
  // extra parents so ack "X of N" is meaningful
  const otherParents = await Promise.all(
    Array.from({ length: 24 }).map((_, i) =>
      prisma.user.create({
        data: { schoolId, name: `Parent ${i + 1}`, phone: `90001${String(i).padStart(4, '0')}`, role: 'PARENT' },
      }),
    ),
  );

  // --- Attendance for Aarav: last 30 days ---
  const today = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dow = d.getDay();
    let status: AttendanceStatus = 'PRESENT';
    if (dow === 0 || dow === 6) status = 'HOLIDAY';
    else if (i % 11 === 3) status = 'ABSENT';
    else if (i % 13 === 5) status = 'LATE';
    const date = new Date(d.toISOString().slice(0, 10));
    await prisma.attendance.create({
      data: { schoolId, studentId: aarav.id, date, status, markedById: teacher.id },
    });
    if (status !== 'HOLIDAY') {
      await prisma.attendance.create({
        data: { schoolId, studentId: ananya.id, date, status: 'PRESENT', markedById: teacher.id },
      });
    }
  }

  // --- Notices ---
  const pinned = await prisma.notice.create({
    data: {
      schoolId,
      title: 'Annual Sports Day — 25th',
      body: 'Dear parents, our Annual Sports Day will be held on the 25th at the main ground. Kindly ensure children arrive by 8:00 AM in their house colours. Parents are welcome.',
      category: 'Event',
      pinned: true,
      createdById: admin.id,
    },
  });
  await prisma.notice.create({
    data: {
      schoolId,
      title: 'Parent-Teacher Meeting slots open',
      body: 'PTM booking is now open for Grade 4. Please pick a slot via the school office.',
      category: 'Academic',
      createdById: admin.id,
    },
  });
  await prisma.notice.create({
    data: {
      schoolId,
      title: 'Library week',
      body: 'Book fair in the library all of next week. Students may bring pocket money for purchases.',
      category: 'General',
      createdById: teacher.id,
    },
  });
  // 142 acks on the pinned notice (of 27 parents seeded we ack a realistic share)
  const ackParents = [parent, ...otherParents].slice(0, 20);
  await prisma.noticeAck.createMany({
    data: ackParents.map((p) => ({ noticeId: pinned.id, parentUserId: p.id })),
  });

  // --- Diary / homework (last 5 school days) ---
  const subjects = ['Mathematics', 'English', 'Science', 'Social Studies'];
  for (let i = 0; i < 5; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const date = new Date(d.toISOString().slice(0, 10));
    for (const subject of subjects) {
      await prisma.diaryEntry.create({
        data: {
          schoolId,
          klassId: klass.id,
          subject,
          date,
          task: `${subject}: complete exercise ${i + 1} and revise today's chapter.`,
          note: subject === 'Mathematics' ? 'Show all steps neatly.' : null,
          createdById: teacher.id,
        },
      });
    }
  }

  // --- Calendar events ---
  await prisma.event.createMany({
    data: [
      { schoolId, title: 'Annual Sports Day', description: 'Main ground, 8 AM', date: addDays(today, 11) },
      { schoolId, title: 'Mid-term exams begin', description: 'Grades 1–8', date: addDays(today, 20) },
      { schoolId, title: 'Diwali break', description: 'School closed', date: addDays(today, 35) },
    ].map((e) => ({ ...e, date: new Date(e.date.toISOString().slice(0, 10)) })),
  });

  // --- Terms + results ---
  const term = await prisma.term.create({ data: { schoolId, name: 'Term 1' } });
  const term2 = await prisma.term.create({ data: { schoolId, name: 'Term 2' } });
  const resultSubjects = [
    { subject: 'Mathematics', score: 92, grade: 'A' },
    { subject: 'English', score: 85, grade: 'A' },
    { subject: 'Science', score: 88, grade: 'A' },
    { subject: 'Social Studies', score: 79, grade: 'B+' },
    { subject: 'Hindi', score: 81, grade: 'A' },
  ];
  for (const t of [term, term2]) {
    await prisma.result.createMany({
      data: resultSubjects.map((s) => ({
        studentId: aarav.id,
        termId: t.id,
        subject: s.subject,
        score: t.id === term.id ? s.score : Math.min(100, s.score + 3),
        maxScore: 100,
        grade: s.grade,
      })),
    });
    const avg =
      resultSubjects.reduce((a, s) => a + (t.id === term.id ? s.score : s.score + 3), 0) /
      resultSubjects.length;
    await prisma.resultMeta.create({
      data: {
        studentId: aarav.id,
        termId: t.id,
        overallPct: Math.round(avg * 10) / 10,
        rank: t.id === term.id ? 3 : 2,
        teacherComment: 'A diligent and curious learner. Keep it up!',
      },
    });
  }

  // --- Photo album ---
  const album = await prisma.photoAlbum.create({
    data: { schoolId, title: 'Field Trip — Botanical Garden', klassId: klass.id },
  });
  await prisma.photo.createMany({
    data: Array.from({ length: 6 }).map((_, i) => ({
      albumId: album.id,
      url: `https://picsum.photos/seed/greenwood${i}/600/600`,
      caption: `Moment ${i + 1}`,
    })),
  });

  // --- A leave request + a notification ---
  await prisma.leaveRequest.create({
    data: {
      schoolId,
      studentId: aarav.id,
      type: 'SICK',
      fromDate: new Date(addDays(today, -3).toISOString().slice(0, 10)),
      toDate: new Date(addDays(today, -2).toISOString().slice(0, 10)),
      reason: 'Fever, advised rest by doctor.',
      status: 'APPROVED',
      createdByParentId: parent.id,
      reviewedById: teacher.id,
    },
  });
  await prisma.notification.createMany({
    data: [
      { userId: parent.id, type: 'ATTENDANCE', title: 'Aarav was marked Present', body: 'Today at 9:02 AM', deeplink: '/app/attendance' },
      { userId: parent.id, type: 'NOTICE', title: 'New pinned notice: Annual Sports Day', deeplink: `/app/notices/${pinned.id}` },
      { userId: parent.id, type: 'LEAVE', title: 'Leave approved', body: 'Your sick leave was approved.', deeplink: '/app/leave' },
    ],
  });

  console.log('✅ Seed complete.');
  console.log('   Login (phone / role):');
  console.log(`   • Admin   9000000001  ADMIN`);
  console.log(`   • Teacher 9000000002  TEACHER`);
  console.log(`   • Parent  9000000003  PARENT`);
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(base.getDate() + days);
  return d;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
