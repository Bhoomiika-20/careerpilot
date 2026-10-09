import { createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { AppError } from '../utils/errors.js';
function canonical(value) { if (Array.isArray(value)) return value.map(canonical); if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])])); return value; }
export const argumentHash = args => createHash('sha256').update(JSON.stringify(canonical(args))).digest('hex');
export const contextToken = (userId, capability) => jwt.sign({ capability }, config.JWT_SECRET, { subject: String(userId), audience: 'careerpilot-mcp', issuer: 'careerpilot-api', expiresIn: '5m' });
export function readContext(token) { return jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'], audience: 'careerpilot-mcp', issuer: 'careerpilot-api' }); }
export function authorizeWrite(claims, tool, args) { if (!claims.capability || claims.capability.name !== tool || claims.capability.hash !== argumentHash(args)) throw new AppError(403, 'This change requires explicit confirmation.'); }
