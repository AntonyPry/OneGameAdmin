import React, { useState } from 'react';
import axios from 'axios';
import styles from './App.module.css';
import { DatePicker, Spin, Button } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';

const { RangePicker } = DatePicker;

const App = () => {
  const [dates, setDates] = useState([]);
  const [loading, setLoading] = useState(false);

  // Обработка выбора диапазона дат
  const handleRangeChange = (values) => {
    setDates(values || []);
  };

  // Функция для скачивания XLSX файла с выбранными параметрами
  const downloadFile = async () => {
    if (!dates || dates.length !== 2) {
      alert('Пожалуйста, заполните все поля!');
      return;
    }

    // Форматируем выбранные даты в строку (например, 2023-05-15)
    const startDate = dates[0].format('YYYY-MM-DD');
    const endDate = dates[1].format('YYYY-MM-DD');
    // Берем год из первой выбранной даты
    const year = dates[0].format('YYYY');

    try {
      setLoading(true);

      // Отправляем POST-запрос с параметрами year, startDate и endDate.
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/payments/paymentsFromPeriod`,
        { year, startDate, endDate },
        { responseType: 'blob' }
      );
      const blob = response.data;

      // Создаем URL для Blob и инициируем скачивание файла
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `payments_${year}_${startDate}_${endDate}.xlsx`);

      document.body.appendChild(link);
      link.click();

      // Очистка
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Ошибка скачивания файла:', error);
      alert('Произошла ошибка при скачивании файла');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.paymentsContainer}>
        <h1 style={{ marginBottom: '20px' }}>Выберите период для загрузки данных об оплатах</h1>
        <div style={{ marginBottom: '40px' }}>
          <RangePicker placeholder={['Дата начала', 'Дата конца']} onChange={handleRangeChange} />
          <Button onClick={downloadFile} disabled={loading || dates.length !== 2} style={{ marginLeft: '16px' }}>
            {loading ? 'Загрузка...' : 'Скачать данные'}
          </Button>
          {loading && <Spin indicator={<LoadingOutlined spin />} size="small" style={{ marginLeft: '5px' }} />}
        </div>
      </div>
    </div>
  );
};

export default App;
