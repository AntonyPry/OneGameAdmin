import { Checkbox, Divider, Form, Input, message, Modal, notification } from 'antd';
import axios from 'axios';
import { useState } from 'react';

const ManagerModal = ({ modalOpen, setModalOpen }) => {
  const [form] = Form.useForm();
  const [api, contextHolder] = notification.useNotification();
  const [adminResponsibilities, setAdminResponsibilities] = useState({});

  const onFinish = async (values) => {
    try {
      const response = await axios
        .post(
          `${process.env.REACT_APP_BACKEND_URL}/api/admin/approveAdminResponsibilities`,
          {
            adminResponsibilities,
            password: values.password,
          },
          {
            validateStatus: () => true,
          }
        )
        .catch((e) => {});

      if (!response.data.error) {
        api['success']({
          message: 'Обязанности успешно подтверждены',
          description: '',
        });
        setModalOpen(false);
      } else {
        api['error']({
          message: 'Не удалось подтвердить обязанности',
          description: '',
        });
      }
    } catch (error) {
      console.error('Ошибка:', error);
      api['error']({
        message: 'Ошибка при попытке подтвердить выполнение обязанностей',
        description: '',
      });
    }
  };

  const checkboxes = [
    ['clubCleanliness', 'Чистота клуба'],
    ['kitchenCleanliness', 'Чистота на кухне'],
    ['quickVkAnswers', 'Оперативные ответы вк'],
    ['quickPhoneAnswers', 'Оперативные ответы телефон'],
    ['workspaceCleanliness', 'Порядок на рабочем месте'],
    ['noStrangersNearTheWorkspace', 'Отсутствие посторонних за стойкой или около неё'],
    ['clubClimateControl', 'Климат-контроль клуба'],
    ['refrigeratorOccupancy', 'Заполняемость холодильников'],
    ['foulLanguage', 'Маты'],
  ];

  return (
    <>
      {contextHolder}
      <Modal
        title="Подтверждение выполнения обязанностей администратора"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => {
          form
            .validateFields()
            .then(async (values) => {
              form.resetFields();
              await onFinish(values);
            })
            .catch((e) => {});
        }}
        width={600}
      >
        <div style={{ height: '330px', padding: '20px 20px 0' }}>
          <Form name="timurManagerPassword" form={form} autoComplete="off">
            <Form.Item
              label="Пароль"
              name="password"
              rules={[{ required: true, message: 'Необходимо указать пароль!' }]}
            >
              <Input.Password style={{ width: '250px' }} />
            </Form.Item>
          </Form>

          <Divider style={{ backgroundColor: '#ccc', margin: '30px 0 20px' }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {checkboxes.map(([key, label]) => (
              <Checkbox
                key={key}
                onChange={(e) => setAdminResponsibilities((prev) => ({ ...prev, [key]: e.target.checked }))}
              >
                {label}
              </Checkbox>
            ))}
          </div>
        </div>
      </Modal>
    </>
  );
};

export default ManagerModal;
