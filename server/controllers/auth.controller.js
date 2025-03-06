// controllers/payments.controller.js

exports.checkPassword = async (req, res) => {
  try {
    const { password } = req.body;
    let accessLevel = null;

    if (password === 'qwe123qwe') {
      accessLevel = 'full'; // Полный доступ
    } else if (password === 'admin0603') {
      accessLevel = 'admin'; // Только админ-панель
    } else {
      return res.status(401).send({ valid: false });
    }

    return res.status(200).send({ valid: true, accessLevel });
  } catch (error) {
    console.log('checkPassword ERROR ->', error);
    return res.status(500).send({ error: true, message: error.message });
  }
};
