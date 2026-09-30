import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError, FieldProblem } from '../utils/AppError';

function toProblems(error: z.ZodError): FieldProblem[] {
  return error.issues.flatMap((issue) => {
    if (issue.code === 'unrecognized_keys') {
      return issue.keys.map((key) => ({ field: key, message: 'Unknown field' }));
    }
    return [{ field: issue.path.join('.') || 'body', message: issue.message }];
  });
}

export function validate(schema: z.ZodType) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      next(new AppError(400, 'VALIDATION_ERROR', 'Request body is invalid', toProblems(result.error)));
      return;
    }

    req.body = result.data;
    next();
  };
}
