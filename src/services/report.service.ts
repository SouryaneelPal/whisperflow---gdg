import { prisma } from '../db';
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
