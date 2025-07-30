// pages/ExportStatisticsPage/ExportStatisticsPage.jsx
import React, { useState } from 'react';
import axios from 'axios';
import { DatePicker, Spin, Button } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import styles from './ExportStatisticsPage.module.css';

const { RangePicker } = DatePicker;

const ExportStatisticsPage = () => {
  const [paymentsFromPeriodDates, setPaymentsFromPeriodDates] = useState([]);
  const [sbpFromPeriodDates, setSbpFromPeriodDates] = useState([]);
  const [cashOrdersFromPeriodDates, setCashOrdersFromPeriodDates] = useState([]);
  const [paymentsFromPeriodLoading, setPaymentsFromPeriodLoading] = useState(false);
  const [sbpFromPeriodLoading, setSbpFromPeriodLoading] = useState(false);
  const [cashOrdersFromPeriodLoading, setCashOrdersFromPeriodLoading] = useState(false);
  const [firstSessionsLoading, setFirstSessionsLoading] = useState(false);

  const handlePaymentsFromPeriodRangeChange = (values) => {
    setPaymentsFromPeriodDates(values || []);
  };

  const downloadPaymentsFromPeriod = async () => {
    if (!paymentsFromPeriodDates || paymentsFromPeriodDates.length !== 2) {
      alert('Пожалуйста, заполните все поля!');
      return;
    }

    const startDate = paymentsFromPeriodDates[0].format('YYYY-MM-DD');
    const endDate = paymentsFromPeriodDates[1].format('YYYY-MM-DD');

    try {
      setPaymentsFromPeriodLoading(true);

      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/payments/paymentsFromPeriod`,
        { startDate: `${startDate} 00:00:00`, endDate: `${endDate} 23:59:59` },
        { responseType: 'blob' }
      );
      const blob = response.data;

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `Платежи_${startDate.split('-')[2]}.${startDate.split('-')[1]}.${startDate.split('-')[0]}-${
          endDate.split('-')[2]
        }.${endDate.split('-')[1]}.${endDate.split('-')[0]}.xlsx`
      );

      document.body.appendChild(link);
      link.click();

      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Ошибка скачивания файла:', error);
      alert('Произошла ошибка при скачивании файла');
    } finally {
      setPaymentsFromPeriodLoading(false);
    }
  };

  const handleSbpFromPeriodRangeChange = (values) => {
    setSbpFromPeriodDates(values || []);
  };

  const downloadSbpFromPeriod = async () => {
    if (!sbpFromPeriodDates || sbpFromPeriodDates.length !== 2) {
      alert('Пожалуйста, заполните все поля!');
      return;
    }

    const startDate = sbpFromPeriodDates[0].format('YYYY-MM-DD');
    const endDate = sbpFromPeriodDates[1].format('YYYY-MM-DD');

    try {
      setSbpFromPeriodLoading(true);

      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/payments/sbpFromPeriod`,
        { startDate: `${startDate} 00:00:00`, endDate: `${endDate} 23:59:59` },
        { responseType: 'blob' }
      );
      const blob = response.data;

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `СБП_${startDate.split('-')[2]}.${startDate.split('-')[1]}.${startDate.split('-')[0]}-${
          endDate.split('-')[2]
        }.${endDate.split('-')[1]}.${endDate.split('-')[0]}.xlsx`
      );

      document.body.appendChild(link);
      link.click();

      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Ошибка скачивания файла:', error);
      alert('Произошла ошибка при скачивании файла');
    } finally {
      setSbpFromPeriodLoading(false);
    }
  };

  const handleCashOrdersRangeChange = (values) => {
    setCashOrdersFromPeriodDates(values || []);
  };

  const downloadCashOrdersFromPeriod = async () => {
    if (!cashOrdersFromPeriodDates || cashOrdersFromPeriodDates.length !== 2) {
      alert('Пожалуйста, заполните все поля!');
      return;
    }

    const startDate = cashOrdersFromPeriodDates[0].format('YYYY-MM-DD');
    const endDate = cashOrdersFromPeriodDates[1].format('YYYY-MM-DD');

    try {
      setCashOrdersFromPeriodLoading(true);

      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/payments/cashOrdersFromPeriod`,
        { startDate: `${startDate} 00:00:00`, endDate: `${endDate} 23:59:59` },
        { responseType: 'blob' }
      );
      const blob = response.data;

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `Кассовые_ордера_${startDate.split('-')[2]}.${startDate.split('-')[1]}.${startDate.split('-')[0]}-${
          endDate.split('-')[2]
        }.${endDate.split('-')[1]}.${endDate.split('-')[0]}.xlsx`
      );

      document.body.appendChild(link);
      link.click();

      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Ошибка скачивания файла:', error);
      alert('Произошла ошибка при скачивании файла');
    } finally {
      setCashOrdersFromPeriodLoading(false);
    }
  };

  // Функция теперь скачивает файл, а не получает JSON
  const downloadFirstSessions = async () => {
    try {
      setFirstSessionsLoading(true);

      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/payments/firstSessionsFromPeriod`,
        {},
        {
          responseType: 'blob',
        }
      );

      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Формируем имя файла для сохранения
      const downloadFileName = `Первые_сессии_за_все_время.xlsx`;
      link.setAttribute('download', downloadFileName);

      document.body.appendChild(link);
      link.click();

      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Ошибка скачивания файла:', error);
      alert('Произошла ошибка при скачивании файла. Попробуйте позже.');
    } finally {
      setFirstSessionsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.paymentsContainer}>
        <h1 style={{ marginBottom: '20px' }}>Выберите период для загрузки данных об оплатах</h1>
        <div style={{ marginBottom: '40px' }}>
          <RangePicker placeholder={['Дата начала', 'Дата конца']} onChange={handlePaymentsFromPeriodRangeChange} />
          <Button
            onClick={downloadPaymentsFromPeriod}
            disabled={paymentsFromPeriodLoading || paymentsFromPeriodDates.length !== 2}
            style={{ marginLeft: '16px' }}
          >
            {paymentsFromPeriodLoading ? 'Загрузка...' : 'Скачать данные'}
          </Button>
          {paymentsFromPeriodLoading && (
            <Spin indicator={<LoadingOutlined spin />} size="small" style={{ marginLeft: '5px' }} />
          )}
        </div>
      </div>

      <div className={styles.paymentsContainer}>
        <h1 style={{ marginBottom: '20px' }}>Выберите период для загрузки данных об оплатах по СБП</h1>
        <div style={{ marginBottom: '40px' }}>
          <RangePicker placeholder={['Дата начала', 'Дата конца']} onChange={handleSbpFromPeriodRangeChange} />
          <Button
            onClick={downloadSbpFromPeriod}
            disabled={sbpFromPeriodLoading || sbpFromPeriodDates.length !== 2}
            style={{ marginLeft: '16px' }}
          >
            {sbpFromPeriodLoading ? 'Загрузка...' : 'Скачать данные'}
          </Button>
          {sbpFromPeriodLoading && (
            <Spin indicator={<LoadingOutlined spin />} size="small" style={{ marginLeft: '5px' }} />
          )}
        </div>
      </div>

      <div className={styles.paymentsContainer}>
        <h1 style={{ marginBottom: '20px' }}>Выберите период для загрузки данных о кассовых ордерах</h1>
        <div style={{ marginBottom: '40px' }}>
          <RangePicker placeholder={['Дата начала', 'Дата конца']} onChange={handleCashOrdersRangeChange} />
          <Button
            onClick={downloadCashOrdersFromPeriod}
            disabled={cashOrdersFromPeriodLoading || cashOrdersFromPeriodDates.length !== 2}
            style={{ marginLeft: '16px' }}
          >
            {cashOrdersFromPeriodLoading ? 'Загрузка...' : 'Скачать данные'}
          </Button>
          {cashOrdersFromPeriodLoading && (
            <Spin indicator={<LoadingOutlined spin />} size="small" style={{ marginLeft: '5px' }} />
          )}
        </div>
      </div>

      <div className={styles.paymentsContainer}>
        <h1 style={{ marginBottom: '20px' }}>Отчёт по первым сессиям клиентов</h1>
        <p style={{ marginTop: '-15px', marginBottom: '20px', color: '#888' }}>
          Отчёт формируется за всё время работы клуба (с 01.12.2024)
        </p>
        <div>
          <Button onClick={downloadFirstSessions} disabled={firstSessionsLoading}>
            {firstSessionsLoading ? 'Формирование отчёта...' : 'Скачать отчёт за всё время'}
          </Button>
          {firstSessionsLoading && (
            <Spin indicator={<LoadingOutlined spin />} size="small" style={{ marginLeft: '10px' }} />
          )}
        </div>
      </div>
    </div>
  );
};

export default ExportStatisticsPage;
