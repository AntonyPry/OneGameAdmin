// pages/AdminPage/AdminPage.jsx
import React, { useEffect, useState } from 'react';
import { Button, Divider, Popover, Statistic } from 'antd';
import { InfoCircleOutlined, CopyOutlined } from '@ant-design/icons';
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
  foulLanguage: 'маты',
};

const AdminPage = () => {
  const [currentStatsObject, setCurrentStatsObject] = useState({
    totalRevenue: 0, // общая выручка
    goodsRevenue: 0, // выручка за все продукты
    psServiceRevenue: 0, // выручка за PS5 + услуги + автосимулятор
    pcRevenue: 0, // выручка за ПК
  });

  const [planStatsObject, setPlanStatsObject] = useState({
    totalRevenue: 0, // общая выручка
    foodRevenue: 0, // выручка за всю еду без шоколада
    chocolateRevenue: 0, // выручка за шоколад
    drinksRevenue: 0, // выручка за напитки
    psServiceRevenue: 0, // выручка за PS5 + услуги
    pcRevenue: 0,
  });

  const [currentAwardsObject, setCurrentAwardsObject] = useState({
    baseSalary: 0, // гарантированный оклад
    goodsBonus: 0, // премия за товары
    psBonus: 0, // премия за PS5 + услуги
    pcBonus: 0, // премия за ПК
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

  const renderResponsibilityCard = () => {
    return (
      <div className={styles.cardContent} style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
        <h3 className={styles.cardName}>Обязанности администратора</h3>
        <ul
          style={{
            listStyle: 'none',
            paddingLeft: 0,
            margin: '12px 0',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            columnGap: '16px',
            rowGap: '4px',
          }}
        >
          {Object.entries(responsibilityMap).map(([key, label]) => {
            const check = currentAwardsObject?.responsibilitiesCheck;
            let color = 'gray';

            if (check?.status === 'ok') {
              color = 'green';
            } else if (check?.status === 'fail') {
              color = check.notPassed?.includes(key) ? 'red' : 'green';
            }

            return (
              <li key={key} style={{ color, fontSize: '14px', marginBottom: '4px' }}>
                ● {label}
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

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
                title="Товары"
                value={
                  planStatsObject.foodRevenue +
                    planStatsObject.drinksRevenue +
                    planStatsObject.chocolateRevenue -
                    currentStatsObject.goodsRevenue >
                  0
                    ? `${
                        planStatsObject.foodRevenue +
                        planStatsObject.drinksRevenue +
                        planStatsObject.chocolateRevenue -
                        currentStatsObject.goodsRevenue
                      }₽`
                    : '✅'
                }
                valueStyle={{ fontSize: '18px', fontWeight: '600', lineHeight: '1.2' }}
              />
              <Statistic
                title="PS5 + услуги + автосимулятор"
                value={
                  planStatsObject.psServiceRevenue - currentStatsObject.psServiceRevenue > 0
                    ? `${planStatsObject.psServiceRevenue - currentStatsObject.psServiceRevenue}₽`
                    : '✅'
                }
                valueStyle={{ fontSize: '18px', fontWeight: '600', lineHeight: '1.2' }}
              />
              <Statistic
                title="ПК"
                value={
                  planStatsObject.pcRevenue - currentStatsObject.pcRevenue > 0
                    ? `${planStatsObject.pcRevenue - currentStatsObject.pcRevenue}₽`
                    : '✅'
                }
                valueStyle={{ fontSize: '18px', fontWeight: '600', lineHeight: '1.2' }}
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
                      valueStyle={{ fontSize: '18px', fontWeight: '600', lineHeight: '1.2' }}
                    />
                  </div>
                  <div style={{ flex: '0 0 33%' }}>
                    <Statistic
                      title="План"
                      value={`${planStatsObject.totalRevenue}₽`}
                      valueStyle={{ fontSize: '18px', fontWeight: '600', lineHeight: '1.2' }}
                    />
                  </div>
                  <div style={{ flex: '0 0 33%' }}>
                    <Statistic
                      title="Выполнение"
                      value={
                        planStatsObject.totalRevenue
                          ? `${Math.floor((currentStatsObject.totalRevenue / planStatsObject.totalRevenue) * 100)}%`
                          : '-'
                      }
                      valueStyle={{ fontSize: '18px', fontWeight: '600', lineHeight: '1.2' }}
                    />
                  </div>
                </div>
              </div>

              <Divider style={{ backgroundColor: '#ccc', margin: '12px 0' }} />

              <div>
                <h4 style={{ marginBottom: '8px' }}>Товары:</h4>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: '0 0 33%' }}>
                    <Statistic
                      title="Факт"
                      value={`${currentStatsObject.goodsRevenue}₽`}
                      valueStyle={{ fontSize: '18px', fontWeight: '600', lineHeight: '1.2' }}
                    />
                  </div>
                  <div style={{ flex: '0 0 33%' }}>
                    <Statistic
                      title="План"
                      value={`${
                        planStatsObject.foodRevenue + planStatsObject.drinksRevenue + planStatsObject.chocolateRevenue
                      }₽`}
                      valueStyle={{ fontSize: '18px', fontWeight: '600', lineHeight: '1.2' }}
                    />
                  </div>
                  <div style={{ flex: '0 0 33%' }}>
                    <Statistic
                      title="Выполнение"
                      value={
                        planStatsObject.foodRevenue && planStatsObject.drinksRevenue && planStatsObject.chocolateRevenue
                          ? `${Math.floor(
                              (currentStatsObject.goodsRevenue /
                                (planStatsObject.foodRevenue +
                                  planStatsObject.drinksRevenue +
                                  planStatsObject.chocolateRevenue)) *
                                100
                            )}%`
                          : '-'
                      }
                      valueStyle={{ fontSize: '18px', fontWeight: '600', lineHeight: '1.2' }}
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
                      value={`${currentStatsObject.psServiceRevenue}₽`}
                      valueStyle={{ fontSize: '18px', fontWeight: '600', lineHeight: '1.2' }}
                    />
                  </div>
                  <div style={{ flex: '0 0 33%' }}>
                    <Statistic
                      title="План"
                      value={`${planStatsObject.psServiceRevenue}₽`}
                      valueStyle={{ fontSize: '18px', fontWeight: '600', lineHeight: '1.2' }}
                    />
                  </div>
                  <div style={{ flex: '0 0 33%' }}>
                    <Statistic
                      title="Выполнение"
                      value={
                        planStatsObject.psServiceRevenue
                          ? `${Math.floor(
                              (currentStatsObject.psServiceRevenue / planStatsObject.psServiceRevenue) * 100
                            )}%`
                          : '-'
                      }
                      valueStyle={{ fontSize: '18px', fontWeight: '600', lineHeight: '1.2' }}
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
                      value={`${currentStatsObject.pcRevenue}₽`}
                      titleStyle={{ margin: 0 }}
                      valueStyle={{ fontSize: '18px', fontWeight: '600', lineHeight: '1.2' }}
                    />
                  </div>
                  <div style={{ flex: '0 0 33%' }}>
                    <Statistic
                      title="План"
                      value={`${planStatsObject.pcRevenue}₽`}
                      valueStyle={{ fontSize: '18px', fontWeight: '600', lineHeight: '1.2' }}
                    />
                  </div>
                  <div style={{ flex: '0 0 33%' }}>
                    <Statistic
                      title="Выполнение"
                      value={
                        planStatsObject.pcRevenue
                          ? `${Math.floor((currentStatsObject.pcRevenue / planStatsObject.pcRevenue) * 100)}%`
                          : '-'
                      }
                      valueStyle={{ fontSize: '18px', fontWeight: '600', lineHeight: '1.2' }}
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
            <div
              style={{
                marginTop: 2,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
              }}
            >
              <Statistic
                title="Оклад"
                value={`${currentAwardsObject.baseSalary}₽`}
                valueStyle={{ fontSize: '18px', fontWeight: '600', lineHeight: '1.2' }}
              />
              <Statistic
                title="За выполнение обязанностей"
                value={'+500₽'}
                formatter={() => (
                  <>
                    <span
                      style={{
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
                      {'+500₽'}
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
                    {/* {currentAwardsObject?.responsibilitiesCheck?.status === 'fail' &&
                      currentAwardsObject?.responsibilitiesCheck?.notPassed?.length > 0 && (
                        <div style={{ fontSize: '12px', color: 'red', marginTop: 4 }}>
                          Нарушения:{' '}
                          {currentAwardsObject?.responsibilitiesCheck?.notPassed
                            .map((key) => responsibilityMap[key] || key)
                            .join(', ')}
                        </div>
                      )} */}
                  </>
                )}
                valueStyle={{ fontSize: '18px', fontWeight: '600', lineHeight: '1.2' }}
              />
              <Statistic
                title="Товары"
                formatter={() => (
                  <>
                    {`${currentAwardsObject.goodsBonus}₽`}
                    {/* <Popover
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
                    </Popover> */}
                  </>
                )}
                valueStyle={{ fontSize: '18px', fontWeight: '600', lineHeight: '1.2' }}
              />
              <Statistic
                title="PS, услуги, автосимулятор"
                formatter={() => <>{`${currentAwardsObject.psBonus}₽`}</>}
                valueStyle={{ fontSize: '18px', fontWeight: '600', lineHeight: '1.2' }}
              />
              <Statistic
                title="ПК"
                formatter={() => <>{`${currentAwardsObject.pcBonus}₽`}</>}
                valueStyle={{ fontSize: '18px', fontWeight: '600', lineHeight: '1.2' }}
              />
              <Statistic
                title="Суммарно"
                value={`${currentAwardsObject.totalAward}₽`}
                valueStyle={{ fontSize: '18px', fontWeight: '600', lineHeight: '1.2' }}
              />
            </div>
            <div
              style={{
                marginTop: 16,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', gap: '12px' }}>
                <Button
                  style={{ width: '250px', alignSelf: 'flex-end' }}
                  onClick={(e) => {
                    e.preventDefault();
                    setIsManagerModalOpen(true);
                  }}
                >
                  Подтвердить выполнение
                </Button>
                <Button
                  style={{ alignSelf: 'flex-end' }}
                  onClick={() => {
                    const planGoods =
                      planStatsObject.foodRevenue + planStatsObject.drinksRevenue + planStatsObject.chocolateRevenue;
                    const goodsFact = currentStatsObject.goodsRevenue;
                    const psFact = currentStatsObject.psServiceRevenue;
                    const psPlan = planStatsObject.psServiceRevenue;
                    const pcFact = currentStatsObject.pcRevenue;
                    const pcPlan = planStatsObject.pcRevenue;
                    const totalFact = currentStatsObject.totalRevenue;
                    const totalPlan = planStatsObject.totalRevenue;

                    const percent = (fact, plan) => (plan > 0 ? Math.floor((fact / plan) * 100) : 0);

                    const doneEmoji = (fact, plan) => (fact >= plan ? '✅' : '❌');

                    const totalPercent = percent(totalFact, totalPlan);
                    const goodsPercent = percent(goodsFact, planGoods);
                    const psPercent = percent(psFact, psPlan);
                    const pcPercent = percent(pcFact, pcPlan);

                    const responsibilities = currentAwardsObject.responsibilitiesCheck;
                    let responsibilityInfo = 'Выполнение обязанностей: не подтверждено';
                    if (responsibilities?.status === 'ok') {
                      responsibilityInfo = 'Выполнение обязанностей: подтверждено ✅';
                    } else if (responsibilities?.status === 'fail') {
                      const failed =
                        responsibilities.notPassed?.map((key) => responsibilityMap[key] || key).join(', ') || '';
                      responsibilityInfo = `Выполнение обязанностей: не выполнено ❌\nНарушения: ${failed}`;
                    }

                    const adminName = `${currentWorkshift.worker.first_name} ${currentWorkshift.worker.last_name}`;

                    const textToCopy = `
${currentWorkshift?.created_at?.split(' ')[0] || '-'} - ${getShiftType()}
Админ: ${adminName}
Начало: ${currentWorkshift?.created_at?.split(' ')[1] || '-'}
Продолжительность: ${getWorkshiftDuration()}

                
Выручка:
Общая: ${totalFact}/${totalPlan} (${totalPercent}%) ${doneEmoji(totalFact, totalPlan)}
Товары: ${goodsFact}/${planGoods} (${goodsPercent}%) ${doneEmoji(goodsFact, planGoods)}
PS+услуги: ${psFact}/${psPlan} (${psPercent}%) ${doneEmoji(psFact, psPlan)}
ПК: ${pcFact}/${pcPlan} (${pcPercent}%) ${doneEmoji(pcFact, pcPlan)}

Премии:
Оклад: ${currentAwardsObject.baseSalary}₽
За обязанности: ${
                      responsibilities?.status === 'ok'
                        ? '+500₽ ✅'
                        : responsibilities?.status === 'fail'
                        ? '0₽ ❌ (нарушения)'
                        : 'неизвестно'
                    }
Товары: ${currentAwardsObject.goodsBonus}₽
PS+услуги: ${currentAwardsObject.psBonus}₽
ПК: ${currentAwardsObject.pcBonus}₽
Сумма: ${currentAwardsObject.totalAward}₽
                
${responsibilityInfo}
                    `.trim();

                    navigator.clipboard.writeText(textToCopy);
                  }}
                >
                  <CopyOutlined />
                </Button>
              </div>
            </div>
          </div>

          {renderResponsibilityCard()}

          {/* Карточка 4 */}
          <div className={styles.cardContent} style={{ backgroundColor: 'rgb(255, 255, 255)', position: 'relative' }}>
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
                    valueStyle={{ fontSize: '18px', fontWeight: '600', lineHeight: '1.2' }}
                  />
                </div>
                <div style={{ flex: '0 0 33%' }}>
                  <Statistic
                    title="Начало"
                    value={`${currentWorkshift?.created_at ? currentWorkshift.created_at.split(' ')[1] : '-'}`}
                    valueStyle={{ fontSize: '18px', fontWeight: '600', lineHeight: '1.2' }}
                  />
                </div>
                <div style={{ flex: '0 0 33%' }}>
                  <Statistic
                    title="Продолжительность"
                    value={`${getWorkshiftDuration()}`}
                    valueStyle={{ fontSize: '18px', fontWeight: '600', lineHeight: '1.2' }}
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
