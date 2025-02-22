// pages/LoginPage/LoginPage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, message } from 'antd';
import axios from 'axios';
import styles from './LoginPage.module.css';

const LoginPage = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onFinish = async (values) => {
    const { password } = values;

    try {
      setLoading(true);

      // Пример запроса на сервер:
      // Предположим, что наш сервер на эндпоинте /api/auth/checkPassword
      // принимает { password }, и возвращает { valid: true/false }
      const response = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/auth/checkPassword`, { password });

      const { valid } = response.data;

      if (valid) {
        sessionStorage.setItem('validPassword', 'true');
        navigate('/');
      } else {
        message.error('Неверный пароль!');
      }
    } catch (error) {
      console.error('Ошибка при проверке пароля:', error);
      message.error('Произошла ошибка при авторизации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
      }}
    >
      <div className={styles.cardContent}>
        <Form
          name="loginForm"
          onFinish={onFinish}
          style={{
            width: 300,
          }}
        >
          <Form.Item label="Пароль" name="password" rules={[{ required: true, message: 'Введите пароль!' }]}>
            <Input.Password />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              Войти
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
};

export default LoginPage;
