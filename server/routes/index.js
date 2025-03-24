// routes/index.js
const express = require('express');
const paymentsRoute = require('./payments.route');
const authRoute = require('./auth.route');
const adminRoute = require('./admin.route.js');

const router = express.Router();

router.use('/payments', paymentsRoute);
router.use('/auth', authRoute);
router.use('/admin', adminRoute);

module.exports = router;
