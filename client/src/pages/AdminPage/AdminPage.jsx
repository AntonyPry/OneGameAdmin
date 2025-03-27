// pages/AdminPage/AdminPage.jsx
import React, { useEffect, useState } from 'react';
import { Divider, Popover, Statistic } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import styles from './AdminPage.module.css';
import axios from 'axios';
import Standarts_for_admins from './Standarts_for_admins';

const AdminPage = () => {
  const [currentStatsObject, setCurrentStatsObject] = useState({
    totalRevenue: 0, // общая выручка
    foodRevenue: 0, // выручка за всю еду без шоколада
    chocolateRevenue: 0, // выручка за шоколад
    drinksRevenue: 0, // выручка за напитки
    PsServiceAutosimRevenue: 0, // выручка за PS5 + услуги + автосимулятор
    PCRevenue: 0, // выручка за ПК
  });

  const [planStatsObject, setPlanStatsObject] = useState({
    totalRevenue: 0, // общая выручка
    foodRevenue: 0, // выручка за всю еду без шоколада
    chocolateRevenue: 0, // выручка за шоколад
    drinksRevenue: 0, // выручка за напитки
    PsServiceAutosimRevenue: 0, // выручка за PS5 + услуги + автосимулятор
    PCRevenue: 0, // выручка за ПК
  });

  const [currentAwardsObject, setCurrentAwardsObject] = useState({
    baseSalary: 0, // гарантированный оклад
    goodsBonus: 0, // премия за товары
    psBonus: 0, // премия за PS5 + услуги + автосимулятор
    totalAward: 0, // суммарное вознаграждение + фиксированное за доп обязанности
  });

  // Состояние для модального окна
  const [modalOpen, setModalOpen] = useState(false);

  // Функция для форматирования даты в "YYYY-MM-DD HH:mm:ss"
  const formatDate = (date) => {
    const pad = (num) => String(num).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
      date.getMinutes()
    )}:${pad(date.getSeconds())}`;
  };

  const getAdminStatsData = async () => {
    try {
      const now = new Date();
      let startDate, endDate;
      const currentHour = now.getHours();

      if (currentHour >= 9 && currentHour < 21) {
        // Дневной период: с 09:00 до 21:00 текущего дня
        const start = new Date(now);
        start.setHours(9, 0, 0, 0);
        const end = new Date(now);
        end.setHours(21, 0, 0, 0);
        startDate = formatDate(start);
        endDate = formatDate(end);
      } else {
        // Ночной период: с 21:00 до 09:00
        if (currentHour >= 21) {
          // Если текущее время между 21:00 и 23:59
          const start = new Date(now);
          start.setHours(21, 0, 0, 0);
          const end = new Date(now);
          end.setDate(end.getDate() + 1);
          end.setHours(9, 0, 0, 0);
          startDate = formatDate(start);
          endDate = formatDate(end);
        } else {
          // Если текущее время между 00:00 и 08:59
          const start = new Date(now);
          start.setDate(start.getDate() - 1);
          start.setHours(21, 0, 0, 0);
          const end = new Date(now);
          end.setHours(9, 0, 0, 0);
          startDate = formatDate(start);
          endDate = formatDate(end);
        }
      }

      // Выполнение запроса к бэкенду с параметрами startDate и endDate
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/admin/currentStats?startDate=${startDate}&endDate=${endDate}`
      );
      console.log({
        currentStatsObject: response.data.currentStatsObject,
        planStatsObject: response.data.planStatsObject,
        currentAwardsObject: response.data.currentAwardsObject,
      });
      if (response?.data) {
        setCurrentStatsObject(response.data.currentStatsObject);
        setPlanStatsObject(response.data.planStatsObject);
        setCurrentAwardsObject(response.data.currentAwardsObject);
      }
    } catch (error) {
      console.error('adminStats ERROR ->', error);
    }
  };

  useEffect(() => {
    getAdminStatsData();
    const intervalId = setInterval(() => {
      getAdminStatsData();
    }, 60000); // интервал 1 минута

    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className={styles.container}>
      <div style={{ display: 'flex', gap: '32px' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <div className={styles.cardContent} style={{ backgroundColor: 'rgb(255, 255, 255)', position: 'relative' }}>
            <h3 className={styles.cardName}>Продай еще, чтобы выполнить план:</h3>
            <div
              style={{
                marginTop: 16,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
              }}
            >
              <Statistic
                title="еда (без шоколада)"
                value={
                  planStatsObject.foodRevenue - currentStatsObject.foodRevenue > 0
                    ? `${planStatsObject.foodRevenue - currentStatsObject.foodRevenue}₽`
                    : '✅'
                }
                valueStyle={{ fontSize: '24px', fontWeight: 'bold' }}
              />
              <Statistic
                title="Напитки"
                value={
                  planStatsObject.drinksRevenue - currentStatsObject.drinksRevenue > 0
                    ? `${planStatsObject.drinksRevenue - currentStatsObject.drinksRevenue}₽`
                    : '✅'
                }
                valueStyle={{ fontSize: '24px', fontWeight: 'bold' }}
              />
              <Statistic
                title="PS5 + услуги + автосимулятор"
                value={
                  planStatsObject.PsServiceAutosimRevenue - currentStatsObject.PsServiceAutosimRevenue > 0
                    ? `${planStatsObject.PsServiceAutosimRevenue - currentStatsObject.PsServiceAutosimRevenue}₽`
                    : '✅'
                }
                valueStyle={{ fontSize: '24px', fontWeight: 'bold' }}
              />
              <Statistic
                title="ПК"
                value={
                  planStatsObject.PCRevenue - currentStatsObject.PCRevenue > 0
                    ? `${planStatsObject.PCRevenue - currentStatsObject.PCRevenue}₽`
                    : '✅'
                }
                valueStyle={{ fontSize: '24px', fontWeight: 'bold' }}
              />
            </div>
          </div>

          <div className={styles.cardContent} style={{ backgroundColor: 'rgb(255, 255, 255)', position: 'relative' }}>
            <h3 className={styles.cardName}>Статистика</h3>
            <div style={{ marginTop: 16 }}>
              <div>
                <h4 style={{ margin: 0, marginBottom: '8px' }}>Выручка:</h4>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: '0 0 33%' }}>
                    <Statistic
                      title="Факт"
                      value={`${currentStatsObject.totalRevenue}₽`}
                      valueStyle={{ fontSize: '20px', fontWeight: 'bold' }}
                    />
                  </div>
                  <div style={{ flex: '0 0 33%' }}>
                    <Statistic
                      title="План"
                      value={`${planStatsObject.totalRevenue}₽`}
                      valueStyle={{ fontSize: '20px', fontWeight: 'bold' }}
                    />
                  </div>
                  <div style={{ flex: '0 0 33%' }}>
                    <Statistic
                      title="Выполнение"
                      value={`${Math.floor((currentStatsObject.totalRevenue / planStatsObject.totalRevenue) * 100)}%`}
                      valueStyle={{ fontSize: '20px', fontWeight: 'bold' }}
                    />
                  </div>
                </div>
              </div>

              <Divider style={{ backgroundColor: '#ccc', margin: '12px 0' }} />

              <div>
                <h4 style={{ marginBottom: '8px' }}>Еда (без шоколада):</h4>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: '0 0 33%' }}>
                    <Statistic
                      title="Факт"
                      value={`${currentStatsObject.foodRevenue}₽`}
                      valueStyle={{ fontSize: '20px', fontWeight: 'bold' }}
                    />
                  </div>
                  <div style={{ flex: '0 0 33%' }}>
                    <Statistic
                      title="План"
                      value={`${planStatsObject.foodRevenue}₽`}
                      valueStyle={{ fontSize: '20px', fontWeight: 'bold' }}
                    />
                  </div>
                  <div style={{ flex: '0 0 33%' }}>
                    <Statistic
                      title="Выполнение"
                      value={`${Math.floor((currentStatsObject.foodRevenue / planStatsObject.foodRevenue) * 100)}%`}
                      valueStyle={{ fontSize: '20px', fontWeight: 'bold' }}
                    />
                  </div>
                </div>
              </div>

              <Divider style={{ backgroundColor: '#ccc', margin: '12px 0' }} />

              <div>
                <h4 style={{ marginBottom: '8px' }}>Напитки:</h4>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: '0 0 33%' }}>
                    <Statistic
                      title="Факт"
                      value={`${currentStatsObject.drinksRevenue}₽`}
                      valueStyle={{ fontSize: '20px', fontWeight: 'bold' }}
                    />
                  </div>
                  <div style={{ flex: '0 0 33%' }}>
                    <Statistic
                      title="План"
                      value={`${planStatsObject.drinksRevenue}₽`}
                      valueStyle={{ fontSize: '20px', fontWeight: 'bold' }}
                    />
                  </div>
                  <div style={{ flex: '0 0 33%' }}>
                    <Statistic
                      title="Выполнение"
                      value={`${Math.floor((currentStatsObject.drinksRevenue / planStatsObject.drinksRevenue) * 100)}%`}
                      valueStyle={{ fontSize: '20px', fontWeight: 'bold' }}
                    />
                  </div>
                </div>
              </div>

              <Divider style={{ backgroundColor: '#ccc', margin: '12px 0' }} />

              <div>
                <h4 style={{ marginBottom: '8px' }}>Шоколад:</h4>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: '0 0 33%' }}>
                    <Statistic
                      title="Факт"
                      value={`${currentStatsObject.chocolateRevenue}₽`}
                      valueStyle={{ fontSize: '20px', fontWeight: 'bold' }}
                    />
                  </div>
                  <div style={{ flex: '0 0 33%' }}>
                    <Statistic
                      title="План"
                      value={`${planStatsObject.chocolateRevenue}₽`}
                      valueStyle={{ fontSize: '20px', fontWeight: 'bold' }}
                    />
                  </div>
                  <div style={{ flex: '0 0 33%' }}>
                    <Statistic
                      title="Выполнение"
                      value={`${Math.floor(
                        (currentStatsObject.chocolateRevenue / planStatsObject.chocolateRevenue) * 100
                      )}%`}
                      valueStyle={{ fontSize: '20px', fontWeight: 'bold' }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <h4 style={{ marginBottom: '8px' }}>PS5 + услуги + автосимулятор:</h4>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: '0 0 33%' }}>
                    <Statistic
                      title="Факт"
                      value={`${currentStatsObject.PsServiceAutosimRevenue}₽`}
                      valueStyle={{ fontSize: '20px', fontWeight: 'bold' }}
                    />
                  </div>
                  <div style={{ flex: '0 0 33%' }}>
                    <Statistic
                      title="План"
                      value={`${planStatsObject.PsServiceAutosimRevenue}₽`}
                      valueStyle={{ fontSize: '20px', fontWeight: 'bold' }}
                    />
                  </div>
                  <div style={{ flex: '0 0 33%' }}>
                    <Statistic
                      title="Выполнение"
                      value={`${Math.floor(
                        (currentStatsObject.PsServiceAutosimRevenue / planStatsObject.PsServiceAutosimRevenue) * 100
                      )}%`}
                      valueStyle={{ fontSize: '20px', fontWeight: 'bold' }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <h4 style={{ marginBottom: '8px' }}>ПК:</h4>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: '0 0 33%' }}>
                    <Statistic
                      title="Факт"
                      value={`${currentStatsObject.PCRevenue}₽`}
                      titleStyle={{ margin: 0 }}
                      valueStyle={{ fontSize: '20px', fontWeight: 'bold' }}
                    />
                  </div>
                  <div style={{ flex: '0 0 33%' }}>
                    <Statistic
                      title="План"
                      value={`${planStatsObject.PCRevenue}₽`}
                      valueStyle={{ fontSize: '20px', fontWeight: 'bold' }}
                    />
                  </div>
                  <div style={{ flex: '0 0 33%' }}>
                    <Statistic
                      title="Выполнение"
                      value={`${Math.floor((currentStatsObject.PCRevenue / planStatsObject.PCRevenue) * 100)}%`}
                      valueStyle={{ fontSize: '20px', fontWeight: 'bold' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Правая колонка: карточки 2 и 4 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Карточка 2 */}
          <div className={styles.cardContent} style={{ backgroundColor: 'rgb(255, 255, 255)', position: 'relative' }}>
            <h3 className={styles.cardName}>Текущая премия:</h3>
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column' }}>
              <Statistic
                title="База"
                formatter={() => (
                  <>
                    {`${currentAwardsObject.baseSalary}₽`}
                    <span style={{ marginLeft: 4 }}>+500₽</span>
                    <Popover
                      content={
                        <span>
                          +500₽ при выполнении всех{' '}
                          <a
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              setModalOpen(true);
                            }}
                          >
                            обязательств
                          </a>
                        </span>
                      }
                      trigger="hover"
                      placement="bottom"
                      title=""
                    >
                      <InfoCircleOutlined style={{ marginLeft: 8, cursor: 'pointer', fontSize: '16px' }} />
                    </Popover>
                  </>
                )}
                valueStyle={{ fontSize: '24px', fontWeight: 'bold' }}
              />
              <Divider style={{ backgroundColor: '#ccc', margin: '12px 0' }} />
              <Statistic
                title="За выполнение плана по товарам"
                value={`${currentAwardsObject.goodsBonus}₽`}
                valueStyle={{ fontSize: '24px', fontWeight: 'bold' }}
              />
              <Divider style={{ backgroundColor: '#ccc', margin: '12px 0' }} />
              <Statistic
                title="За выполнение плана по PS, услугам и автосимуляторам"
                value={`${currentAwardsObject.psBonus}₽`}
                valueStyle={{ fontSize: '24px', fontWeight: 'bold' }}
              />
              <Divider style={{ backgroundColor: '#ccc', margin: '12px 0' }} />
              <Statistic
                title="Суммарно"
                value={`${currentAwardsObject.totalAward}₽`}
                valueStyle={{ fontSize: '26px', fontWeight: 'bold' }}
              />
            </div>
          </div>

          {/* Карточка 4 (пустая) */}
          <div
            className={styles.cardContent}
            style={{
              backgroundColor: 'rgb(255, 255, 255)',
              position: 'relative',
              minHeight: '300px',
            }}
          >
            {/* Пустая карточка */}
          </div>
        </div>
      </div>
      <Standarts_for_admins modalOpen={modalOpen} setModalOpen={setModalOpen} />
    </div>
  );
};

export default AdminPage;
