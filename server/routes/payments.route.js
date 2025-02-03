// routes/payments.route.js
const express = require('express');
const { paymentsFromPeriod } = require('../controllers/payments.controller');

const router = express.Router();

router.post('/paymentsFromPeriod', paymentsFromPeriod);

module.exports = router;
