import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { errorHandler, notFound } from './middleware/errorHandler';
import routes from './routes';

const app = express();

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
