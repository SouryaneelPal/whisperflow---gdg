import path from 'node:path';
import { Router } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';

// The build copies the spec next to the compiled routes, so this path works from src/ and dist/.
const spec = YAML.load(path.join(__dirname, '../docs/openapi.yaml'));

const router = Router();

// Served over plain http from anything but localhost, upgrade-insecure-requests makes the
// browser fetch Swagger UI's own scripts and styles over https, which fails and leaves a blank
// page. Only that directive is dropped, and only here; the rest of the API keeps the default.
router.use(helmet({ contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } } }));
router.use(swaggerUi.serve);
router.get('/', swaggerUi.setup(spec));

export default router;
