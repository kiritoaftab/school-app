import type { NextFunction, Request, Response } from 'express';

/** Wrap async route handlers so thrown errors reach the error middleware. */
export function ah(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

export class HttpError extends Error {
  /**
   * `details` is spread into the JSON body alongside `error`, so a handler can
   * hand the client something actionable — a `code` to branch on, or the counts
   * behind a 409 ("4 exams, 312 marks") so the UI can explain what it protects.
   */
  constructor(
    public status: number,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}
