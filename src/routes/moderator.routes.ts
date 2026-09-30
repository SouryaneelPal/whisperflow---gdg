import { Router } from 'express';
import { createNote, getReport, listReports, login, updateStatus } from '../controllers/moderator.controller';
import { requireModerator } from '../middleware/auth';
import { loginLimiter } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import { listQuerySchema, loginSchema, noteSchema, statusChangeSchema } from '../validators/moderator.schema';

const router = Router();

router.post('/login', loginLimiter, validate(loginSchema), login);

router.use(requireModerator);

router.get('/reports', validate(listQuerySchema, 'query'), listReports);
router.get('/reports/:id', getReport);
router.patch('/reports/:id/status', validate(statusChangeSchema), updateStatus);
router.post('/reports/:id/updates', validate(noteSchema), createNote);

export default router;
