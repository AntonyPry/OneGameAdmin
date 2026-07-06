const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const router = require('./routes');
const { initializeTokenService } = require('./services/token.service');

dotenv.config();

const app = express();
const BACKEND_PORT = process.env.BACKEND_PORT;

const DEFAULT_DEV_CLIENT_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

const getAllowedClientOrigins = () => {
  const configuredOrigins = (process.env.CLIENT_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const devOrigins =
    process.env.NODE_ENV === 'production' ? [] : DEFAULT_DEV_CLIENT_ORIGINS;

  return Array.from(new Set([...configuredOrigins, ...devOrigins]));
};

const allowedClientOrigins = getAllowedClientOrigins();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedClientOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS origin is not allowed: ${origin}`));
    },
  }),
);
app.use(express.json());
app.use('/api', router);

app.get('/', (req, res) => {
  res.send('Home Route');
});

initializeTokenService();

// Запуск сервера
app.listen(BACKEND_PORT, () => {
  console.log(`Listening on port ${BACKEND_PORT}`);
});
