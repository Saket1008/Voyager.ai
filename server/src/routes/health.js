import { Router } from 'express';
import clerkRequireAuth from '../middleware/auth.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

router.get('/api/me', clerkRequireAuth, (req, res) => {
  res.json({ userId: req.auth?.userId, user: req.user || null });
});

export default router;

