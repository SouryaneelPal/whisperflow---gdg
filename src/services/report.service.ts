import { prisma } from '../db';
import { OPEN_STATUSES, Status, TRANSITIONS } from '../domain/statusWorkflow';
import { AppError } from '../utils/AppError';
import { ListQuery } from '../validators/moderator.schema';
import { ReportInput } from '../validators/report.schema';
import { formatCaseCode, generateCaseCode, hashCaseCode, normalizeCaseCode } from './caseCode.service';

export async function createReport(input: ReportInput) {
  const caseCode = generateCaseCode();

  // The nested create runs in one transaction, so a report never exists without its first update.
  const report = await prisma.report.create({
    data: {
      ...input,
      caseCodeHash: hashCaseCode(caseCode),
      updates: { create: { status: 'SUBMITTED', message: 'Report received' } },
    },
  });

  return { caseCode: formatCaseCode(caseCode), status: report.status };
}

export async function findReportByCaseCode(input: string) {
  const caseCode = normalizeCaseCode(input);
  if (!caseCode) return null;

  return prisma.report.findUnique({
    where: { caseCodeHash: hashCaseCode(caseCode) },
    select: {
      category: true,
      status: true,
      createdAt: true,
      updates: {
        select: { status: true, message: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
}

export async function findReports({ category, status, q, page, limit }: ListQuery) {
  // No mode: 'insensitive' here: Prisma rejects it on SQLite, where contains (LIKE) already
  // ignores case for plain letters.
  const where = { category, status, description: q ? { contains: q } : undefined };

  const [reports, total] = await prisma.$transaction([
    prisma.report.findMany({
      where,
      // createdAt can tie; id keeps the order, and so the pages, stable.
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      select: { id: true, category: true, status: true, description: true, createdAt: true, updatedAt: true },
    }),
    prisma.report.count({ where }),
  ]);

  return { reports, total };
}

export function findReport(id: string) {
  return prisma.report.findUnique({
    where: { id },
    select: {
      id: true,
      category: true,
      description: true,
      evidenceUrl: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      updates: {
        select: { status: true, message: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
}

export async function changeStatus(id: string, status: Status, message: string) {
  return prisma.$transaction(async (tx) => {
    const report = await tx.report.findUnique({ where: { id }, select: { status: true } });
    if (!report) throw new AppError(404, 'REPORT_NOT_FOUND', 'Report not found');

    const current = report.status as Status;
    if (!OPEN_STATUSES.includes(current)) throw new AppError(409, 'CASE_CLOSED', 'This report is closed');

    const allowed = TRANSITIONS[current];
    if (!allowed.includes(status)) {
      throw new AppError(
        409,
        'INVALID_STATUS_CHANGE',
        `Cannot change a ${current} report to ${status}. Allowed next: ${allowed.join(', ')}`,
      );
    }

    // Only matches while the status is still the one read above. If another moderator changed
    // it in the meantime nothing is updated, instead of one change silently overwriting the other.
    const { count } = await tx.report.updateMany({ where: { id, status: current }, data: { status } });
    if (count === 0) {
      throw new AppError(409, 'STATUS_CHANGED', 'The status was changed by someone else. Reload the report and try again.');
    }

    const update = await tx.statusUpdate.create({ data: { reportId: id, status, message } });
    const updated = await tx.report.findUniqueOrThrow({
      where: { id },
      select: { id: true, category: true, status: true, updatedAt: true },
    });

    return { report: updated, update };
  });
}

// Every update message is shown to the reporter through their case code, so this is not a
// place for internal moderator notes.
export async function addNote(id: string, message: string) {
  return prisma.$transaction(async (tx) => {
    const report = await tx.report.findUnique({ where: { id }, select: { status: true } });
    if (!report) throw new AppError(404, 'REPORT_NOT_FOUND', 'Report not found');

    const { count } = await tx.report.updateMany({
      where: { id, status: { in: OPEN_STATUSES } },
      data: { updatedAt: new Date() },
    });
    if (count === 0) throw new AppError(409, 'CASE_CLOSED', 'This report is closed');

    return tx.statusUpdate.create({ data: { reportId: id, status: report.status, message } });
  });
}
