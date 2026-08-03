import type { ErrorRequestHandler, RequestHandler } from 'express';
import { MulterError } from 'multer';
import { ZodError } from 'zod';
import { AppError, NotFoundError } from '../core/errors/app-error.js';
import type { ErrorEnvelope } from '../core/http/response.js';
import { logger } from '../core/logger.js';
import { env } from '../config/env.js';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl}`));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    const body: ErrorEnvelope = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: err.flatten(),
      },
    };
    res.status(422).json(body);
    return;
  }

  if (err instanceof MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'File is too large (images max 5MB, materials max 50MB)'
        : err.message || 'Upload failed';
    const body: ErrorEnvelope = {
      success: false,
      error: { code: 'UPLOAD_ERROR', message },
    };
    res.status(400).json(body);
    return;
  }

  if (err instanceof AppError) {
    const body: ErrorEnvelope = {
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
    };
    res.status(err.statusCode).json(body);
    return;
  }

  logger.error({ err }, 'Unhandled error');

  const body: ErrorEnvelope = {
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Something went wrong. Please try again.',
      details: env.isProduction ? undefined : String(err),
    },
  };
  res.status(500).json(body);
};
