// pages/HomePage/HomePage.jsx
import React from 'react';
import { Row, Col, Card } from 'antd';
import { Link } from 'react-router-dom';
import { UserOutlined, BarChartOutlined, TableOutlined } from '@ant-design/icons';
import styles from './HomePage.module.css';

const HomePage = () => {
  return (
    <div className={styles.container}>
      <Row gutter={[32, 32]}>
        <Col xs={24} md={12}>
          <Link to="/export" className={styles.activeLink}>
            <div className={styles.cardContent} style={{ backgroundColor: 'rgb(216, 255, 226)' }}>
              <h3 className={styles.cardName}>Экспорт статистики</h3>
              <TableOutlined className={styles.icon} />
            </div>
          </Link>
        </Col>

        <Col xs={24} md={12}>
          <div
            className={`${styles.cardContent} ${styles.disabledCard}`}
            style={{ backgroundColor: 'rgb(216, 226, 255)' }}
          >
            <h3 className={styles.cardName}>Дашборд (скоро)</h3>
            <BarChartOutlined className={styles.icon} />
          </div>
        </Col>
      </Row>

      <Row gutter={[32, 32]} style={{ marginTop: 32 }}>
        <Col xs={24} md={12}>
          <div
            className={`${styles.cardContent} ${styles.disabledCard}`}
            style={{ backgroundColor: 'rgb(255, 216, 216)' }}
          >
            <h3 className={styles.cardName}>Панель администратора (скоро)</h3>
            <UserOutlined className={styles.icon} />
          </div>
        </Col>
        <Col xs={24} md={12} />
      </Row>
    </div>
  );
};

export default HomePage;
