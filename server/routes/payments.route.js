// routes/payments.route.js
const express = require('express');
const { paymentsFromPeriod, sbpFromPeriod, cashOrdersFromPeriod } = require('../controllers/payments.controller');

const router = express.Router();

router.post('/paymentsFromPeriod', paymentsFromPeriod);
router.post('/sbpFromPeriod', sbpFromPeriod);
router.post('/cashOrdersFromPeriod', cashOrdersFromPeriod);

module.exports = router;
