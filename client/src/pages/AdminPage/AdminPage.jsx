// pages/AdminPage/AdminPage.jsx
import React, { useEffect, useState } from 'react';
import { Button, Divider, Popover, Statistic } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import styles from './AdminPage.module.css';
import axios from 'axios';
import Standarts_for_admins from './Standarts_for_admins';
import ManagerModal from './ManagerModal';
import AwardsForProducts from './AwardsForProducts';

const responsibilityMap = {
  clubCleanliness: 'чистота клуба',
  kitchenCleanliness: 'чистота кухни',
  quickVkAnswers: 'ответы вк',
  quickPhoneAnswers: 'ответы телефон',
  workspaceCleanliness: 'чистота рабочего места',
  noStrangersNearTheWorkspace: 'посторонние за стойкой',
  clubClimateControl: 'климат-контроль',
  refrigeratorOccupancy: 'холодильник не заполнен',
};

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

  const [currentWorkshift, setCurrentWorkshift] = useState({
    comment: '',
    created_at: 0,
    worker: {
      last_name: '',
      first_name: '',
    },
  });

  // Состояние для модального окна
  const [standarts_for_adminsModalOpen, setStandarts_for_adminsModalOpen] = useState(false);
  const [awardsForProductsModalOpen, setAwardsForProductsModalOpen] = useState(false);
  const [isManagerModalOpen, setIsManagerModalOpen] = useState(false);

  // Функция для форматирования даты в "YYYY-MM-DD HH:mm:ss"
  const formatDate = (date) => {
    const pad = (num) => String(num).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
      date.getMinutes()
    )}:${pad(date.getSeconds())}`;
  };

  const getWorkshiftDuration = () => {
    if (!currentWorkshift.created_at) return '';

    // created_at уже в МСК
    const createdAtDate = new Date(currentWorkshift.created_at.replace(' ', 'T') + '+03:00');
    const now = new Date(); // текущее время

    const diffInMs = now - createdAtDate; // корректно сравниваем
    const diffInMinutes = Math.floor(diffInMs / 1000 / 60);
    const hours = Math.floor(diffInMinutes / 60);
    const minutes = diffInMinutes % 60;

    return `${hours} ч ${minutes} мин`;
  };

  const getShiftType = () => {
    if (!currentWorkshift.created_at) return '';

    const createdAt = new Date(currentWorkshift.created_at.replace(' ', 'T') + '+03:00');
    const hours = createdAt.getHours();

    if (hours >= 6 && hours < 12) {
      return 'День';
    } else if (hours >= 18 && hours < 24) {
      return 'Ночь';
    } else {
      return '—';
    }
  };

  const getAdminStatsData = async () => {
    try {
      const activeWorkshift = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/admin/getActiveWorkshift`);
      setCurrentWorkshift(activeWorkshift.data.currentWorkshift);
      const now = new Date();
      let startDate = activeWorkshift.data.currentWorkshift.created_at,
        endDate;

      const createdAt = new Date(activeWorkshift.data.currentWorkshift.created_at.replace(' ', 'T') + '+03:00');
      const hours = createdAt.getHours();

      if (hours >= 6 && hours < 12) {
        const end = new Date(now);
        end.setHours(21, 0, 0, 0);
        endDate = formatDate(end);
      } else if (hours >= 18 && hours < 24) {
        const end = new Date(createdAt);
        end.setDate(createdAt.getDate() + 1);
        end.setHours(9, 0, 0, 0);
        endDate = formatDate(end);
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
      console.log('adminStats ERROR ->', error);
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
                title="Еда + напитки"
                value={
                  planStatsObject.foodRevenue +
                    planStatsObject.drinksRevenue +
                    planStatsObject.chocolateRevenue -
                    currentStatsObject.foodRevenue -
                    currentStatsObject.drinksRevenue -
                    currentStatsObject.chocolateRevenue >
                  0
                    ? `${planStatsObject.foodRevenue - currentStatsObject.foodRevenue}₽`
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
                <h4 style={{ marginBottom: '8px' }}>Еда + напитки:</h4>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: '0 0 33%' }}>
                    <Statistic
                      title="Факт"
                      value={`${
                        currentStatsObject.foodRevenue +
                        currentStatsObject.drinksRevenue +
                        currentStatsObject.chocolateRevenue
                      }₽`}
                      valueStyle={{ fontSize: '20px', fontWeight: 'bold' }}
                    />
                  </div>
                  <div style={{ flex: '0 0 33%' }}>
                    <Statistic
                      title="План"
                      value={`${
                        planStatsObject.foodRevenue + planStatsObject.drinksRevenue + planStatsObject.chocolateRevenue
                      }₽`}
                      valueStyle={{ fontSize: '20px', fontWeight: 'bold' }}
                    />
                  </div>
                  <div style={{ flex: '0 0 33%' }}>
                    <Statistic
                      title="Выполнение"
                      value={`${Math.floor(
                        ((currentStatsObject.foodRevenue +
                          currentStatsObject.drinksRevenue +
                          currentStatsObject.chocolateRevenue) /
                          (planStatsObject.foodRevenue +
                            planStatsObject.drinksRevenue +
                            planStatsObject.chocolateRevenue)) *
                          100
                      )}%`}
                      valueStyle={{ fontSize: '20px', fontWeight: 'bold' }}
                    />
                  </div>
                </div>
              </div>

              {/* <Divider style={{ backgroundColor: '#ccc', margin: '12px 0' }} />

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
              </div> */}

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
                    <span
                      style={{
                        marginLeft: 4,
                        color:
                          currentAwardsObject?.responsibilitiesCheck?.status === 'ok'
                            ? 'green'
                            : currentAwardsObject?.responsibilitiesCheck?.status === 'fail'
                            ? 'red'
                            : 'gray',
                        textDecoration:
                          currentAwardsObject?.responsibilitiesCheck?.status === 'fail' ? 'line-through' : 'none',
                      }}
                    >
                      +500₽
                    </span>
                    <Popover
                      content={
                        <span>
                          +500₽ при выполнении всех{' '}
                          <a
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              setStandarts_for_adminsModalOpen(true);
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
                    {currentAwardsObject?.responsibilitiesCheck?.status === 'fail' &&
                      currentAwardsObject?.responsibilitiesCheck?.notPassed?.length > 0 && (
                        <div style={{ fontSize: '12px', color: 'red', marginTop: 4 }}>
                          Нарушения:{' '}
                          {currentAwardsObject?.responsibilitiesCheck?.notPassed
                            .map((key) => responsibilityMap[key] || key)
                            .join(', ')}
                        </div>
                      )}
                  </>
                )}
                valueStyle={{ fontSize: '24px', fontWeight: 'bold' }}
              />
              <Divider style={{ backgroundColor: '#ccc', margin: '12px 0' }} />
              <Statistic
                title="За выполнение плана по товарам"
                formatter={() => (
                  <>
                    {`${currentAwardsObject.goodsBonus}₽`}
                    <Popover
                      content={
                        <span>
                          при выполнении{' '}
                          <a
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              setAwardsForProductsModalOpen(true);
                            }}
                          >
                            условий
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
                title="За выполнение плана по PS, услугам и автосимулятору"
                formatter={() => (
                  <>
                    {`${currentAwardsObject.psBonus}₽`}
                    {/* <Popover
                      content={
                        <span>
                          при выполнении{' '}
                          <a
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              setStandarts_for_adminsModalOpen(true);
                            }}
                          >
                            условий
                          </a>
                        </span>
                      }
                      trigger="hover"
                      placement="bottom"
                      title=""
                    >
                      <InfoCircleOutlined style={{ marginLeft: 8, cursor: 'pointer', fontSize: '16px' }} />
                    </Popover> */}
                  </>
                )}
                valueStyle={{ fontSize: '24px', fontWeight: 'bold' }}
              />
              <Divider style={{ backgroundColor: '#ccc', margin: '12px 0' }} />
              <Statistic
                title="Суммарно"
                value={`${currentAwardsObject.totalAward}₽`}
                valueStyle={{ fontSize: '26px', fontWeight: 'bold' }}
              />
            </div>
            <Button
              style={{ width: '250px', alignSelf: 'flex-end' }}
              disabled={currentAwardsObject?.responsibilitiesCheck?.alreadyChecked}
              onClick={(e) => {
                e.preventDefault();
                setIsManagerModalOpen(true);
              }}
            >
              Подтвердить выполнение
            </Button>
          </div>

          {/* Карточка 4 (пустая) */}
          <div className={styles.cardContent} style={{ backgroundColor: 'rgb(255, 255, 255)', position: 'relative' }}>
            <h3 className={styles.cardName}>Смена</h3>
            <div>
              <h4 style={{ marginBottom: '8px' }}>
                Админ: {currentWorkshift.worker.first_name + ' ' + currentWorkshift.worker.last_name}
              </h4>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: '0 0 33%' }}>
                  <Statistic
                    title="Смена"
                    value={`${getShiftType()}`}
                    titleStyle={{ margin: 0 }}
                    valueStyle={{ fontSize: '20px', fontWeight: 'bold' }}
                  />
                </div>
                <div style={{ flex: '0 0 33%' }}>
                  <Statistic
                    title="Начало"
                    value={`${currentWorkshift?.created_at ? currentWorkshift.created_at.split(' ')[1] : '-'}`}
                    valueStyle={{ fontSize: '20px', fontWeight: 'bold' }}
                  />
                </div>
                <div style={{ flex: '0 0 33%' }}>
                  <Statistic
                    title="Продолжительность"
                    value={`${getWorkshiftDuration()}`}
                    valueStyle={{ fontSize: '20px', fontWeight: 'bold' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Standarts_for_admins modalOpen={standarts_for_adminsModalOpen} setModalOpen={setStandarts_for_adminsModalOpen} />
      <AwardsForProducts modalOpen={awardsForProductsModalOpen} setModalOpen={setAwardsForProductsModalOpen} />
      <ManagerModal modalOpen={isManagerModalOpen} setModalOpen={setIsManagerModalOpen} />
    </div>
  );
};

export default AdminPage;
