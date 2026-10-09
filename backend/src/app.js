import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { fileURLToPath } from 'node:url';
import { config } from './config/env.js';
import { csrf } from './middleware/security.js';
import { api } from './routes/api.js';
export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: new URL(config.CLIENT_URL).origin, credentials: true }));
  app.use(express.json({ limit: '128kb' })); app.use(cookieParser());
  app.get('/health', (req, res) => res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({ database: mongoose.connection.readyState === 1 ? 'connected' : 'unavailable' }));
  app.use('/api', rateLimit({ windowMs: 60000, limit: 200, standardHeaders: 'draft-8', legacyHeaders: false }), csrf, api);
  app.use('/api', (req, res) => res.status(404).json({ message: 'API endpoint not found.' }));
  const dist = fileURLToPath(new URL('../../frontend/dist/', import.meta.url));
  app.use(express.static(dist)); app.get('/{*path}', (req, res, next) => res.sendFile(dist + 'index.html', error => error && next(error)));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.name === 'ZodError') return res.status(400).json({ message: error.issues.map(i => `${i.path.join('.') || 'Input'}: ${i.message}`).join('; ') });
    if (error.code === 11000) return res.status(409).json({ message: 'This record already exists.' });
    if (error.name === 'MulterError') return res.status(400).json({ message: 'Upload one PDF or DOCX no larger than 5 MB.' });
    if (error.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid JSON request.' });
    const status = error.status || 500;
    if (status >= 500) console.error(`[request failure] ${error.name || 'Error'} status=${status}`);
    res.status(status).json({ message: error.status ? error.message : 'The server could not complete this request. Please try again.' });
  });
  return app;
}
