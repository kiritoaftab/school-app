import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { ZodError } from 'zod';
import { config } from './config.js';
import { prisma } from './db.js';
import { HttpError } from './lib/http.js';
import { authRouter } from './routes/auth.js';
import { parentRouter } from './routes/parent.js';
import { teacherRouter } from './routes/teacher.js';
import { adminRouter } from './routes/admin.js';

export function createApp() {
  const app = express();
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());

  app.get('/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ ok: true, db: 'up' });
    } catch {
      res.status(503).json({ ok: false, db: 'down' });
    }
  });

  app.use('/auth', authRouter);
  app.use('/parent', parentRouter);
  app.use('/teacher', teacherRouter);
  app.use('/admin', adminRouter);

  // 404
  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

  // error handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.flatten() });
    }
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
