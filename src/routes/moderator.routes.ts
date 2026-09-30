import { Router } from 'express';
import { getReport, listReports, login, updateStatus } from '../controllers/moderator.controller';

const router = Router();

router.post('/login', login);
router.get('/reports', listReports);
router.get('/reports/:id', getReport);
router.patch('/reports/:id/status', updateStatus);

export default router;
