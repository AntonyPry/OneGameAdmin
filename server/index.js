const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const router = require('./routes');

dotenv.config();

const app = express();
const BACKEND_PORT = process.env.BACKEND_PORT;

app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());
app.use('/api', router);

app.get('/', (req, res) => {
  res.send('Home Route');
});

// Запуск сервера
app.listen(BACKEND_PORT, () => {
  console.log(`Listening on port ${BACKEND_PORT}`);
});
