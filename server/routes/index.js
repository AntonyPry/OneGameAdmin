// routes/index.js
const express = require('express');
const paymentsRoute = require('./payments.routes');
const authRoute = require('./auth.routes');
const adminRoute = require('./admin.routes');
const platformRoute = require('./platform.routes');
const clubsRoute = require('./clubs.routes');

const router = express.Router();

router.use('/payments', paymentsRoute);
router.use('/auth', authRoute);
router.use('/admin', adminRoute);
router.use('/platform', platformRoute);
router.use('/clubs', clubsRoute);

module.exports = router;
