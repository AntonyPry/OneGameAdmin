// pages/HomePage/HomePage.jsx
import React, { useEffect, useState } from 'react';
import { Row, Col } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { UserOutlined, BarChartOutlined, TableOutlined } from '@ant-design/icons';
import styles from './HomePage.module.css';

const HomePage = () => {
  const [accessLevel, setAccessLevel] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const storedAccessLevel = sessionStorage.getItem('accessLevel');
    if (!storedAccessLevel) {
      navigate('/login');
    }
    setAccessLevel(storedAccessLevel);
  }, [navigate]);

  return (
    <div className={styles.container}>
      <Row gutter={[32, 32]}>
        <Col xs={24} md={12}>
          <Link to="/export" className={`${styles.activeLink} ${accessLevel !== 'full' && styles.disabledLink}`}>
            <div
              className={`${styles.cardContent} ${accessLevel !== 'full' && styles.disabledCard}`}
              style={{ backgroundColor: 'rgb(194, 246, 207)' }}
            >
              <div>
                <h3 className={styles.cardName}>Экспорт статистики</h3>
                <p style={{ marginTop: '5px', color: 'grey', fontSize: 'min(5vw, 20px)' }}>
                  {accessLevel !== 'full' && '(нет доступа)'}
                </p>
              </div>
              <TableOutlined className={styles.icon} />
            </div>
          </Link>
        </Col>

        <Col xs={24} md={12}>
          <Link to="/dashboard" className={`${styles.activeLink} ${styles.disabledLink}`}>
            <div
              className={`${styles.cardContent} ${styles.disabledCard}`}
              style={{ backgroundColor: 'rgb(216, 226, 255)' }}
            >
              <div>
                <h3 className={styles.cardName}>Дашборд (скоро)</h3>
                <p style={{ marginTop: '5px', color: 'grey', fontSize: 'min(5vw, 20px)' }}>
                  {accessLevel !== 'full' && '(нет доступа)'}
                </p>
              </div>
              <BarChartOutlined className={styles.icon} />
            </div>
          </Link>
        </Col>
      </Row>

      <Row gutter={[32, 32]} style={{ marginTop: 32 }}>
        <Col xs={24} md={12}>
          <Link to="/admin" className={`${styles.activeLink}`}>
            <div className={`${styles.cardContent}`} style={{ backgroundColor: 'rgb(255, 216, 216)' }}>
              <h3 className={styles.cardName}>Панель администратора</h3>
              <UserOutlined className={styles.icon} />
            </div>
          </Link>
        </Col>
      </Row>
    </div>
  );
};

export default HomePage;
