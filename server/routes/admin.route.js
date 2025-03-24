// routes/admin.route.js
const express = require('express');
const { currentStats } = require('../controllers/admin.controller.js');

const router = express.Router();

router.get('/currentStats', currentStats);

module.exports = router;
