const jwt = require('jsonwebtoken');
const {
  getUserWithMembershipsById,
  serializeUserSession,
} = require('../services/auth.service');

const getBearerToken = (authHeader) => {
  if (!authHeader) return null;

  const [scheme, token] = String(authHeader).split(' ');
  return scheme === 'Bearer' && token ? token : null;
};

const authenticateToken = async (req, res, next) => {
  try {
    const token = getBearerToken(req.headers['authorization']);

    if (!token) {
      return res
        .status(401)
        .send({ error: true, message: 'Отсутствует токен доступа' });
    }

    if (!process.env.JWT_SECRET) {
      return res
        .status(500)
        .send({ error: true, message: 'JWT_SECRET не настроен' });
    }

    let decodedUser;
    try {
      decodedUser = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return res
        .status(401)
        .send({ error: true, message: 'Токен недействителен или истек' });
    }

    if (!decodedUser?.id) {
      return res
        .status(401)
        .send({ error: true, message: 'Токен недействителен или истек' });
    }

    const user = await getUserWithMembershipsById(decodedUser.id);
    if (!user) {
      return res
        .status(401)
        .send({ error: true, message: 'Пользователь не найден' });
    }

    const session = serializeUserSession(user);
    req.auth = session;
    req.user = session.user;
    req.userSystemRole = session.systemRole;
    req.userMemberships = session.memberships;

    next();
  } catch (error) {
    console.error('authenticateToken ERROR ->', error);
    return res
      .status(500)
      .send({ error: true, message: 'Ошибка проверки токена' });
  }
};

module.exports = {
  authenticateToken,
};
