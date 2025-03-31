import { Modal } from 'antd';
import React from 'react';

const AwardsForProducts = ({ modalOpen, setModalOpen }) => {
  return (
    <div>
      <Modal title="" open={modalOpen} onCancel={() => setModalOpen(false)} footer={null} width={800}>
        <div
          style={{
            maxHeight: '500px',
            overflowY: 'auto',
            padding: '0 20px',
          }}
        >
          <h2>Как начисляется премия</h2>
          <p>
            Если план выполнен, вы получаете <strong>10% от стоимости всех проданных товаров</strong>.
          </p>
          <p>
            <strong>С понедельника по четверг</strong> — если сумма продаж превышает <strong>10 000 ₽</strong>, премия{' '}
            <strong>удваивается</strong>.
          </p>

          <h3>Примеры расчёта:</h3>
          <ul>
            <li>План по продаже еды — 6500 ₽</li>
            <li>
              Продано еды на 6400 ₽ — <strong>премия 0 ₽</strong>
            </li>
            <li>
              Продано еды на 7000 ₽ — <strong>премия 700 ₽</strong>
            </li>
            <li>
              Продано еды на 11000 ₽ (в пн-чт) — <strong>премия 2200 ₽</strong>
            </li>
          </ul>

          <p style={{ marginTop: '20px' }}>
            Учитывается только та категория товаров, по которой установлен план (например, еда или напитки).
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default AwardsForProducts;
