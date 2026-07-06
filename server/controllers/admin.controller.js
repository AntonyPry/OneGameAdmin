// controllers/admin.controller.js
const adminService = require('../services/admin.service');

const currentStats = async (req, res) => {
  try {
    let { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).send({
        error: true,
        message: 'Необходимы параметры startDate и endDate',
      });
    }

    const statsData = await adminService.calculateCurrentStats({
      startDate,
      endDate,
      dbClubId: req.dbClubId,
      smartshellCompanyId: req.smartshellCompanyId,
      club: req.currentClub,
    });

    if (statsData.error) {
      const statusCode =
        statsData.statusCode ||
        (String(statsData.code || '').startsWith('SMARTSHELL') ? 502 : 400);
      return res.status(statusCode).send(statsData);
    }

    return res.status(200).send(statsData);
  } catch (error) {
    console.log('currentStats ERROR ->', error);
    return res.status(500).send({ error: true, message: error.message });
  }
};

const getActiveWorkshift = async (req, res) => {
  try {
    const { dbClubId, smartshellCompanyId } = req;

    const currentWorkshift =
      await adminService.getActiveWorkshiftStartDate(smartshellCompanyId);

    if (currentWorkshift?.error) {
      return res.status(502).send({
        error: true,
        code: 'SMARTSHELL_WORKSHIFT_ERROR',
        message: currentWorkshift.message || 'Не удалось получить смену',
        currentWorkshift: null,
      });
    }

    if (!currentWorkshift) {
      return res.status(200).send({
        currentWorkshift: null,
        responsibilitiesCheck: {
          alreadyChecked: false,
          status: 'notChecked',
          notPassed: [],
        },
      });
    }

    const responsibilitiesCheck = await adminService.getResponsibilitiesCheck(
      currentWorkshift,
      dbClubId,
      req.currentClubSettings,
    );

    return res.status(200).send({ currentWorkshift, responsibilitiesCheck });
  } catch (error) {
    console.log('getActiveWorkshift ERROR ->', error);
    return res.status(500).send({ error: true, message: error.message });
  }
};

const approveAdminResponsibilities = async (req, res) => {
  try {
    const { adminResponsibilities } = req.body;

    if (
      !adminResponsibilities ||
      typeof adminResponsibilities !== 'object' ||
      Array.isArray(adminResponsibilities)
    ) {
      return res
        .status(400)
        .send({ error: true, message: 'Неверный формат чек-листа' });
    }

    const result = await adminService.saveAdminResponsibilities({
      adminResponsibilities,
      dbClubId: req.dbClubId,
      smartshellCompanyId: req.smartshellCompanyId,
      clubSettings: req.currentClubSettings,
    });

    if (result.error) {
      return res.status(result.statusCode || 400).send(result);
    }

    return res.status(200).send(result);
  } catch (error) {
    console.log('approveAdminResponsibilities ERROR ->', error);
    return res.status(500).send({ error: true, message: error.message });
  }
};

const getPlans = async (req, res) => {
  try {
    let { month } = req.query;
    if (!month) {
      return res
        .status(400)
        .send({ error: true, message: 'Необходим параметр month (YYYY-MM)' });
    }

    const plans = await adminService.getMonthlyPlans(month, req.dbClubId);
    return res.status(200).send(plans);
  } catch (error) {
    console.log('getPlans ERROR ->', error);
    return res.status(500).send({ error: true, message: error.message });
  }
};

const updatePlan = async (req, res) => {
  try {
    let { planData } = req.body;
    const planItems = Array.isArray(planData) ? planData : [planData];
    const invalidPlan = planItems.find(
      (item) => !item || !item.date || !item.shift_type,
    );

    if (!planItems.length || invalidPlan) {
      return res
        .status(400)
        .send({ error: true, message: 'Неверный формат planData' });
    }

    const savedPlans = await adminService.saveDailyPlans(
      planItems,
      req.dbClubId,
    );
    return res.status(200).send({
      error: false,
      message:
        savedPlans.length === 1
          ? 'План успешно сохранен'
          : `Планы успешно сохранены: ${savedPlans.length}`,
      plan: savedPlans[0],
      plans: savedPlans,
      count: savedPlans.length,
    });
  } catch (error) {
    console.log('updatePlan ERROR ->', error);
    return res.status(500).send({ error: true, message: error.message });
  }
};

module.exports = {
  currentStats,
  getActiveWorkshift,
  approveAdminResponsibilities,
  getPlans,
  updatePlan,
};
