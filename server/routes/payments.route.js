// routes/payments.route.js
const express = require('express');
const { paymentsFromPeriod, sbpFromPeriod } = require('../controllers/payments.controller');

const router = express.Router();

router.post('/paymentsFromPeriod', paymentsFromPeriod);
router.post('/sbpFromPeriod', sbpFromPeriod);

module.exports = router;
