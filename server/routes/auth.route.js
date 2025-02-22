// routes/auth.route.js
const express = require('express');
const { checkPassword } = require('../controllers/auth.controller');

const router = express.Router();

router.post('/checkPassword', checkPassword);

module.exports = router;
