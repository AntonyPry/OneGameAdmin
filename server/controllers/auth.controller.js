// controllers/payments.controller.js

exports.checkPassword = async (req, res) => {
  try {
    const valid = req.body.password === 'qwe123qwe';
    return res.status(200).send({ valid });
  } catch (error) {
    console.log('checkPassword ERROR ->', error);
    return res.status(500).send({ error: true, message: error.message });
  }
};
