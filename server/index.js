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

/**
 * Эндпоинт для скачивания XLSX файла.
 * Принимает query-параметр period (?period=week, ?period=month или ?period=year)
 */
app.get('/download', async (req, res) => {
  try {
    const { period } = req.query;
    if (!period || !['week', 'month', 'year'].includes(period)) {
      return res.status(400).send('Некорректный параметр period. Используйте "week", "month" или "year".');
    }

    // Получаем access_token (эмуляция)
    const accessToken = await getAccessToken();

    // Получаем данные с API (эмуляция)
    const data = await getPaymentData(period, accessToken);

    // Генерируем XLSX файл
    const xlsxBuffer = await generateXlsx(data);

    // Настраиваем заголовки для скачивания файла
    res.setHeader('Content-Disposition', `attachment; filename=payments_${period}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(xlsxBuffer);
  } catch (error) {
    console.error(error);
    res.status(500).send('Ошибка сервера');
  }
});

app.get('/', (req, res) => {
  res.send('Home Route');
});

// Запуск сервера
app.listen(BACKEND_PORT, () => {
  console.log(`Listening on port ${BACKEND_PORT}`);
});
