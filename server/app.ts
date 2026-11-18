import express from 'express';
import type { ErrorRequestHandler } from 'express';
import type { ApiError } from '../shared/contracts.js';
import { ApiHttpError } from './errors.js';
import { createApiRouter } from './routes.js';
import type { ApiDependencies } from './routes.js';
import { WorkflowError } from './workflowService.js';

export type AppOptions = ApiDependencies;

export function createApp(options: AppOptions = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(express.json({ limit: '16kb' }));
  app.use('/api', createApiRouter(options));
  app.use((_req, res) => {
    res.status(404).json({ code: 'NOT_FOUND', message: 'API route not found.' } satisfies ApiError);
  });

  const handleError: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    let status = 500;
    let response: ApiError = { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' };
    if (error instanceof ApiHttpError) {
      status = error.status;
      response = { code: error.code, message: error.message };
    } else if (error instanceof WorkflowError) {
      status = error.code === 'SESSION_NOT_FOUND' ? 404 : 409;
      response = { code: error.code, message: error.message };
    } else if (error && typeof error === 'object' && 'type' in error) {
      if (error.type === 'entity.parse.failed') {
        status = 400;
        response = { code: 'INVALID_INPUT', message: 'Invalid JSON request body.' };
      } else if (error.type === 'entity.too.large') {
        status = 413;
        response = { code: 'INVALID_INPUT', message: 'Request body exceeds the 16kb limit.' };
      }
    }
    res.status(status).json(response);
  };
  app.use(handleError);
  return app;
}
