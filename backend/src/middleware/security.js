import jwt from 'jsonwebtoken';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { config } from '../config/env.js';
import { User } from '../models/index.js';
import { AppError } from '../utils/errors.js';
export const cookieOptions = { httpOnly: true, secure: config.NODE_ENV === 'production', sameSite: 'strict', path: '/' };
export async function authenticate(req, res, next) {
  try {
    const claims = jwt.verify(req.cookies.cp_session || '', config.JWT_SECRET, { algorithms: ['HS256'], audience: 'careerpilot-web', issuer: 'careerpilot' });
    const user = await User.findById(claims.sub).lean();
    if (!user || user.sessionVersion !== claims.ver) throw new Error();
    req.user = user; next();
  } catch { next(new AppError(401, 'Please sign in to continue.')); }
}
export function setSession(res, user) {
  const token = jwt.sign({ ver: user.sessionVersion }, config.JWT_SECRET, { subject: String(user._id), audience: 'careerpilot-web', issuer: 'careerpilot', expiresIn: '8h' });
  res.cookie('cp_session', token, { ...cookieOptions, maxAge: 8 * 3600000 });
}
export function issueCsrf(req, res) {
  const token = randomBytes(32).toString('hex');
  res.cookie('cp_csrf', token, { ...cookieOptions, maxAge: 8 * 3600000 });
  res.json({ token });
}
export function csrf(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const a = req.cookies.cp_csrf, b = req.get('X-CSRF-Token');
  if (req.get('origin') && req.get('origin') !== new URL(config.CLIENT_URL).origin) return next(new AppError(403, 'Request origin is not allowed.'));
  if (typeof a !== 'string' || typeof b !== 'string' || !/^[a-f0-9]{64}$/.test(a) || !/^[a-f0-9]{64}$/.test(b) || !timingSafeEqual(Buffer.from(a), Buffer.from(b))) return next(new AppError(403, 'Session check expired. Refresh the page and try again.'));
  next();
}
