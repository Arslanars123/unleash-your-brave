import pino from 'pino';
import { env } from '../config/env.js';

export const logger = pino({
  level: env.logLevel,
  transport: env.isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
      },
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token'],
    censor: '[redacted]',
  },
});

export type Logger = typeof logger;
