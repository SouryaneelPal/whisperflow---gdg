export const CATEGORIES = ['SECURITY', 'HARASSMENT', 'CORRUPTION', 'TECHNICAL', 'OTHER'] as const;

export const STATUSES = ['SUBMITTED', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'] as const;

export type Status = (typeof STATUSES)[number];

export const TRANSITIONS: Record<Status, readonly Status[]> = {
  SUBMITTED: ['UNDER_REVIEW'],
  UNDER_REVIEW: ['RESOLVED', 'DISMISSED'],
  RESOLVED: [],
  DISMISSED: [],
};
