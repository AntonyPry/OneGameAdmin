// routes/index.js
const express = require('express');
const paymentsRoute = require('./payments.route');

const router = express.Router();

router.use('/payments', paymentsRoute);

module.exports = router;
