import { prisma } from '../db.js';
import { studentClassId } from './access.js';

/** Where a child placed in one exam, and how many classmates they placed among. */
export interface ClassRank {
  rank: number;
  outOf: number;
}

/**
 * Class rank for one child, for each of `termIds`, keyed by term id.
 *
 * Derived on read rather than stored. `ResultMeta.rank` exists but only the
 * legacy POST /teacher/results path ever set it, and it would go stale the
 * moment any classmate's marks were edited — which the marks screen does
 * constantly. Reading it back from the overall percentages is always current.
 *
 * Ties share a place and consume the ones below them (1, 2, 2, 4), which is how
 * a rank list is normally read.
 *
 * The cohort is everyone enrolled in the class who has a published result for
 * that exam — archived pupils included. Who a child was ranked against in a past
 * exam is history and should not shift when somebody later leaves the school.
 * For a class-scoped exam the class is the exam's own; for a school-wide one it
 * is wherever the child is enrolled now.
 */
export async function classRanks(
  studentId: number,
  termIds: number[],
): Promise<Map<number, ClassRank>> {
  const out = new Map<number, ClassRank>();
  const ids = [...new Set(termIds)];
  if (ids.length === 0) return out;

  const [childKlassId, terms] = await Promise.all([
    studentClassId(studentId),
    prisma.term.findMany({ where: { id: { in: ids } }, select: { id: true, klassId: true } }),
  ]);

  // termId -> the class its rank list is drawn from.
  const klassOf = new Map<number, number>();
  for (const t of terms) {
    const klassId = t.klassId ?? childKlassId;
    if (klassId != null) klassOf.set(t.id, klassId);
  }
  const klassIds = [...new Set(klassOf.values())];
  if (klassIds.length === 0) return out;

  const enrollments = await prisma.enrollment.findMany({
    where: { klassId: { in: klassIds } },
    select: { studentId: true, klassId: true },
  });
  const rosterOf = new Map<number, Set<number>>();
  for (const e of enrollments) {
    let roster = rosterOf.get(e.klassId);
    if (!roster) rosterOf.set(e.klassId, (roster = new Set()));
    roster.add(e.studentId);
  }

  const metas = await prisma.resultMeta.findMany({
    where: {
      termId: { in: [...klassOf.keys()] },
      studentId: { in: [...new Set(enrollments.map((e) => e.studentId))] },
    },
    select: { studentId: true, termId: true, overallPct: true },
  });
  const byTerm = new Map<number, { studentId: number; overallPct: number }[]>();
  for (const m of metas) {
    let rows = byTerm.get(m.termId);
    if (!rows) byTerm.set(m.termId, (rows = []));
    rows.push({ studentId: m.studentId, overallPct: m.overallPct });
  }

  for (const [termId, all] of byTerm) {
    const roster = rosterOf.get(klassOf.get(termId)!)!;
    const rows = all.filter((r) => roster.has(r.studentId));
    const mine = rows.find((r) => r.studentId === studentId);
    // No row of their own: the child sat the exam in a different class from the
    // one they are enrolled in now. Better no rank than a meaningless one.
    if (!mine) continue;
    // Percentages are floats, so a hair's difference is a tie, not a place.
    const ahead = rows.filter((r) => r.overallPct > mine.overallPct + 1e-6).length;
    out.set(termId, { rank: ahead + 1, outOf: rows.length });
  }
  return out;
}
