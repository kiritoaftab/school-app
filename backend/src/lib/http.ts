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
  constructor(public status: number, message: string) {
    super(message);
  }
}
