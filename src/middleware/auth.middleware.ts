
import type { RequestHandler } from 'express';
import { authService } from '../services/auth.service.js';

export const requireAuth: RequestHandler = async (
  req,
  res,
  next
) => {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
    return;
  }

  const token = authorization.slice(7).trim();

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Invalid token',
    });
    return;
  }

  try {
    const user = await authService.verifyToken(token);
    res.locals.authUser = user;
    next();
  } catch {
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
    });
  }
};
