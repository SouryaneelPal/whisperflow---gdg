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

export function validate(schema: z.ZodType, source: 'body' | 'query' = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const message = source === 'body' ? 'Request body is invalid' : 'Query parameters are invalid';
      next(new AppError(400, 'VALIDATION_ERROR', message, toProblems(result.error)));
      return;
    }

    // Express 5 makes req.query read-only, so parsed query values live in res.locals.
    if (source === 'query') res.locals.query = result.data;
    else req.body = result.data;
    next();
  };
}
