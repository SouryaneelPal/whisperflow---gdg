import { Router } from 'express';
import { submitReport, trackReport } from '../controllers/report.controller';
import { submitLimiter, trackLimiter } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import { reportSchema } from '../validators/report.schema';

const router = Router();

router.post('/', submitLimiter, validate(reportSchema), submitReport);
router.get('/status', trackLimiter, trackReport);

export default router;
