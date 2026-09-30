import { Router } from 'express';
import moderatorRoutes from './moderator.routes';
import reportRoutes from './report.routes';

const router = Router();

router.use('/reports', reportRoutes);
router.use('/moderator', moderatorRoutes);

export default router;
