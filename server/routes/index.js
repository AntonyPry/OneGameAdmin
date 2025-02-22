// routes/index.js
const express = require('express');
const paymentsRoute = require('./payments.route');
const authRoute = require('./auth.route');

const router = express.Router();

router.use('/payments', paymentsRoute);
router.use('/auth', authRoute);

module.exports = router;
