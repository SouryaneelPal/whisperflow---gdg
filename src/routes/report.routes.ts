import { Router } from 'express';
import { submitReport, trackReport } from '../controllers/report.controller';

const router = Router();

router.post('/', submitReport);
router.get('/status', trackReport);

export default router;
