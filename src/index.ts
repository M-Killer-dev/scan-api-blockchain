import * as Sentry from '@sentry/node';
import { RewriteFrames } from '@sentry/integrations';
import express, { Response, Request, NextFunction } from 'express';
import morgan from 'morgan';
import config from './utils/config';
import contractRouter from './routes/contract';
import verificationRouter from './routes/verification';
import { getReefPrice } from './services/utils';
import { StatusError } from './utils/utils';
import { getProvider } from './utils/connector';
import { backtrackEvents } from './backtracking/backtracking';
import { sequelize } from './db/sequelize.db';
import { VerifiedContractMainnet, VerifiedContractTestnet } from './db/VerifiedContract.db';
import { importBackupFromFiles } from './services/verification';

/* eslint "no-underscore-dangle": "off" */
Sentry.init({
  dsn: config.sentryDns,
  tracesSampleRate: 1.0,
  integrations: [
    new RewriteFrames({
      root: global.__dirname,
    }),
  ],
  environment: config.environment,
});
Sentry.setTag('component', 'api');
Sentry.setTag('network', config.network);

const cors = require('cors');

const app = express();

export const verifiedContractRepository = config.network === 'mainnet' 
  ? sequelize.getRepository(VerifiedContractMainnet) 
  : sequelize.getRepository(VerifiedContractTestnet);

// add sentry request handler
app.use(Sentry.Handlers.requestHandler() as express.RequestHandler);

// Parse incoming requests with JSON payloads
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());
app.use(morgan('dev'));

app.use('/api', contractRouter);
app.use('/api/verificator', verificationRouter);

app.get('/api/price/reef', async (_, res: Response, next: NextFunction) => {
  try {
    const price = await getReefPrice();
    res.send(price);
  } catch (err) {
    next(err);
  }
});

// add sentry error handler
app.use(
  Sentry.Handlers.errorHandler({
    shouldHandleError() {
      return true;
    },
  }) as express.ErrorRequestHandler,
);

/* eslint "no-unused-vars": "off" */
const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  console.log({
    request: req,
    error: err,
  });
  const status = err instanceof StatusError ? err.status : 400;
  const message = err.message || 'Something went wrong';
  res.status(status).send({ error: message });
};

app.use(errorHandler);

app.listen(config.httpPort, async () => {
  await getProvider().api.isReadyOrError;
  await sequelize.sync();
  console.log(`Reef explorer API is running on port ${config.httpPort}.`);
  if (process.env.IMPORT_BACKUP_ON_START === 'true') {
    importBackupFromFiles();
  }
  backtrackEvents();
});
