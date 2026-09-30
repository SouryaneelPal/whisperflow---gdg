import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler, notFound } from './middleware/errorHandler';
import routes from './routes';

const app = express();

// Behind a hosting proxy every request seems to come from the proxy's IP, so the rate limiters
// would throttle all users as one. Trusting more hops than really exist lets a client fake
// X-Forwarded-For to dodge the limits, so set this to the exact number of proxies in front.
if (env.TRUST_PROXY > 0) app.set('trust proxy', env.TRUST_PROXY);

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Reports and tracking data must never be kept by browsers or proxies.
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

export default app;
