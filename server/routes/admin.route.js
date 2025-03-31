// routes/admin.route.js
const express = require('express');
const {
  currentStats,
  getActiveWorkshift,
  approveAdminResponsibilities,
} = require('../controllers/admin.controller.js');

const router = express.Router();

router.get('/currentStats', currentStats);
router.get('/getActiveWorkshift', getActiveWorkshift);
router.post('/approveAdminResponsibilities', approveAdminResponsibilities);

module.exports = router;
