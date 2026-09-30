export type FieldProblem = { field: string; message: string };

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: FieldProblem[],
  ) {
    super(message);
    this.name = 'AppError';
  }
}
