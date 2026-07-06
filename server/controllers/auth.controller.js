const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { User } = require('../models');
const {
  createAccessToken,
  getUserWithMembershipsById,
  getUserWithPasswordAndMembershipsByEmail,
  serializeUserSession,
} = require('../services/auth.service');
const { SYSTEM_ROLES } = require('../rbac/roles');

const safeTokenEquals = (actual, expected) => {
  if (!actual || !expected) return false;

  const actualBuffer = Buffer.from(String(actual));
  const expectedBuffer = Buffer.from(String(expected));
  return (
    actualBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  );
};

const isPublicRegisterAllowed = (req) => {
  if (process.env.AUTH_PUBLIC_REGISTER_ENABLED !== 'true') return false;

  const expectedToken = process.env.AUTH_REGISTER_TOKEN;
  const providedToken =
    req.headers['x-register-token'] || (req.body || {}).registrationToken;

  return safeTokenEquals(providedToken, expectedToken);
};

const register = async (req, res) => {
  try {
    const { email, password, first_name, last_name } = req.body || {};

    if (!isPublicRegisterAllowed(req)) {
      return res.status(403).send({
        error: true,
        message: 'Публичная регистрация отключена',
      });
    }

    if (!email || !password || !first_name || !last_name) {
      return res.status(400).send({
        error: true,
        message: 'Необходимы email, password, first_name и last_name',
      });
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).send({
        error: true,
        message: 'Пользователь с таким email уже существует',
      });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      email,
      password_hash,
      first_name,
      last_name,
      system_role: SYSTEM_ROLES.USER,
    });

    return res.status(201).send({
      error: false,
      message: 'Пользователь успешно создан',
      user: {
        id: newUser.id,
        email: newUser.email,
        first_name: newUser.first_name,
        last_name: newUser.last_name,
        systemRole: SYSTEM_ROLES.USER,
      },
    });
  } catch (error) {
    console.error('Register ERROR ->', error);
    return res
      .status(500)
      .send({ error: true, message: 'Внутренняя ошибка сервера' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res
        .status(400)
        .send({ error: true, message: 'Необходимы email и password' });
    }

    const user = await getUserWithPasswordAndMembershipsByEmail(email);

    if (!user) {
      return res
        .status(401)
        .send({ error: true, message: 'Неверный email или пароль' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res
        .status(401)
        .send({ error: true, message: 'Неверный email или пароль' });
    }

    const token = createAccessToken(user);
    const session = serializeUserSession(user);

    return res.status(200).send({
      valid: true,
      token,
      ...session,
    });
  } catch (error) {
    console.error('Login ERROR ->', error);
    return res
      .status(500)
      .send({ error: true, message: 'Внутренняя ошибка сервера' });
  }
};

const me = async (req, res) => {
  try {
    const user = await getUserWithMembershipsById(req.user.id);
    if (!user) {
      return res
        .status(401)
        .send({ error: true, message: 'Пользователь не найден' });
    }

    return res.status(200).send({
      valid: true,
      ...serializeUserSession(user),
    });
  } catch (error) {
    console.error('Me ERROR ->', error);
    return res
      .status(500)
      .send({ error: true, message: 'Внутренняя ошибка сервера' });
  }
};

module.exports = {
  register,
  login,
  me,
};
