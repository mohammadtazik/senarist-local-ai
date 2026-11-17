
import { Router } from 'express';
import { z } from 'zod';

import { authService } from '../services/auth.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

const registerSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
});

router.post('/register', async (req, res) => {
  const validation = registerSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid registration data',
      details: validation.error.issues,
    });
  }

  try {
    const result = await authService.register(
      validation.data.email,
      validation.data.password
    );

    return res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'EMAIL_ALREADY_EXISTS'
    ) {
      return res.status(409).json({
        success: false,
        error: 'Email already registered',
      });
    }

    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === '23505'
    ) {
      return res.status(409).json({
        success: false,
        error: 'Email already registered',
      });
    }

    console.error('Registration error:', error);

    return res.status(500).json({
      success: false,
      error: 'Registration failed',
    });
  }
});

router.post('/login', async (req, res) => {
  const validation = loginSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid login data',
    });
  }

  try {
    const result = await authService.login(
      validation.data.email,
      validation.data.password
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'INVALID_CREDENTIALS'
    ) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    console.error('Login error:', error);

    return res.status(500).json({
      success: false,
      error: 'Login failed',
    });
  }
});

router.get('/me', requireAuth, (_req, res) => {
  return res.status(200).json({
    success: true,
    data: res.locals.authUser,
  });
});

export default router;
