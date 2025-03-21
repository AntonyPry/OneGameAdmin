// pages/AdminPage/AdminPage.jsx
import React from 'react';
import { Divider, Statistic } from 'antd';
import styles from './AdminPage.module.css';

const AdminPage = () => {
  return (
    <div className={styles.container}>
      <div style={{ display: 'flex', gap: '32px' }}>
        {/* Левая колонка: карточки 1 и 3 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Карточка 1 */}
          <div className={styles.cardContent} style={{ backgroundColor: 'rgb(255,216,216)', position: 'relative' }}>
            <h3 className={styles.cardName}>Продай еще, чтобы выполнить план:</h3>
            {/* Сетка на 2 столбца */}
            <div
              style={{
                marginTop: 16,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
              }}
            >
              <Statistic title="френч-доги" value={25} valueStyle={{ fontSize: '24px', fontWeight: 'bold' }} />
              <Statistic title="часов в PS" value={8} valueStyle={{ fontSize: '24px', fontWeight: 'bold' }} />
              <Statistic title="часов в ПК" value={5} valueStyle={{ fontSize: '24px', fontWeight: 'bold' }} />
              <Statistic
                title="Напитков по ? рублей"
                value={12}
                valueStyle={{ fontSize: '24px', fontWeight: 'bold' }}
              />
            </div>
          </div>

          {/* Карточка 3 */}
          <div className={styles.cardContent} style={{ backgroundColor: 'rgb(255,216,216)', position: 'relative' }}>
            <h3 className={styles.cardName}>Статистика</h3>
            <div style={{ marginTop: 16 }}>
              {/* Раздел "Выручка" */}
              <div>
                <h4 style={{ marginBottom: '8px' }}>Выручка:</h4>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: '0 0 33%' }}>
                    <Statistic title="Факт" value={20000} valueStyle={{ fontSize: '20px', fontWeight: 'bold' }} />
                  </div>
                  <div style={{ flex: '0 0 33%' }}>
                    <Statistic title="План" value={25000} valueStyle={{ fontSize: '20px', fontWeight: 'bold' }} />
                  </div>
                  <div style={{ flex: '0 0 33%' }}>
                    <Statistic title="Выполнение" value="80%" valueStyle={{ fontSize: '20px', fontWeight: 'bold' }} />
                  </div>
                </div>
              </div>

              {/* Раздел "Еда" */}
              <div>
                <h4 style={{ marginBottom: '8px' }}>Еда:</h4>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: '0 0 33%' }}>
                    <Statistic title="Факт" value={5000} valueStyle={{ fontSize: '20px', fontWeight: 'bold' }} />
                  </div>
                  <div style={{ flex: '0 0 33%' }}>
                    <Statistic title="План" value={6000} valueStyle={{ fontSize: '20px', fontWeight: 'bold' }} />
                  </div>
                  <div style={{ flex: '0 0 33%' }}>
                    <Statistic title="Выполнение" value="83%" valueStyle={{ fontSize: '20px', fontWeight: 'bold' }} />
                  </div>
                </div>
              </div>

              <Divider style={{ backgroundColor: '#ccc', margin: '12px 0' }} />

              {/* После разделителя: фиксированные 3 столбца */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '16px',
                }}
              >
                <Statistic title="Напитки (Факт)" value={3000} valueStyle={{ fontSize: '18px', fontWeight: 'bold' }} />
                <Statistic title="Напитки (План)" value={3500} valueStyle={{ fontSize: '18px', fontWeight: 'bold' }} />
                <Statistic
                  title="Напитки (Выполнение)"
                  value="86%"
                  valueStyle={{ fontSize: '18px', fontWeight: 'bold' }}
                />
                <Statistic title="Шоколад (Факт)" value={1500} valueStyle={{ fontSize: '18px', fontWeight: 'bold' }} />
                <Statistic title="Шоколад (План)" value={1800} valueStyle={{ fontSize: '18px', fontWeight: 'bold' }} />
                <Statistic
                  title="Шоколад (Выполнение)"
                  value="83%"
                  valueStyle={{ fontSize: '18px', fontWeight: 'bold' }}
                />
                <Statistic
                  title="Френч-доги и сендвичи (Факт)"
                  value={2200}
                  valueStyle={{ fontSize: '18px', fontWeight: 'bold' }}
                />
                <Statistic
                  title="Френч-доги и сендвичи (План)"
                  value={2500}
                  valueStyle={{ fontSize: '18px', fontWeight: 'bold' }}
                />
                <Statistic
                  title="Френч-доги и сендвичи (Выполнение)"
                  value="88%"
                  valueStyle={{ fontSize: '18px', fontWeight: 'bold' }}
                />
                <Statistic title="PS (Факт)" value={4000} valueStyle={{ fontSize: '18px', fontWeight: 'bold' }} />
                <Statistic title="PS (План)" value={4500} valueStyle={{ fontSize: '18px', fontWeight: 'bold' }} />
                <Statistic title="PS (Выполнение)" value="89%" valueStyle={{ fontSize: '18px', fontWeight: 'bold' }} />
                <Statistic title="ПК (Факт)" value={3200} valueStyle={{ fontSize: '18px', fontWeight: 'bold' }} />
                <Statistic title="ПК (План)" value={3500} valueStyle={{ fontSize: '18px', fontWeight: 'bold' }} />
                <Statistic title="ПК (Выполнение)" value="91%" valueStyle={{ fontSize: '18px', fontWeight: 'bold' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Правая колонка: карточки 2 и 4 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Карточка 2 */}
          <div className={styles.cardContent} style={{ backgroundColor: 'rgb(255,216,216)', position: 'relative' }}>
            <h3 className={styles.cardName}>Текущая премия:</h3>
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Statistic title="База" value={1000} valueStyle={{ fontSize: '24px', fontWeight: 'bold' }} />
              <Statistic
                title="За выполнение плана"
                value={500}
                valueStyle={{ fontSize: '24px', fontWeight: 'bold' }}
              />
              <Statistic
                title="За выполнение плана по еде"
                value={300}
                valueStyle={{ fontSize: '24px', fontWeight: 'bold' }}
              />
              <Divider style={{ backgroundColor: '#ccc', margin: '12px 0' }} />
              <Statistic title="Суммарно" value={1800} valueStyle={{ fontSize: '26px', fontWeight: 'bold' }} />
            </div>
          </div>

          {/* Карточка 4 (пустая) */}
          <div
            className={styles.cardContent}
            style={{
              backgroundColor: 'rgb(255,216,216)',
              position: 'relative',
              minHeight: '300px',
            }}
          >
            {/* Пустая карточка */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
