const express = require('express');
const router = express.Router();
const { Anomaly, Patient } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { Op } = require('sequelize');

// GET /api/anomalies
router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 20, severity, acknowledged = 'false' } = req.query;
    const where = {};
    if (severity) where.severity = severity;
    if (acknowledged !== 'all') where.is_acknowledged = acknowledged === 'true';

    const { count, rows } = await Anomaly.findAndCountAll({
      where,
      include: [{ model: Patient, as: 'patient', attributes: ['id', 'first_name', 'last_name', 'patient_id', 'ward'] }],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [['created_at', 'DESC']]
    });

    res.json({
      anomalies: rows,
      pagination: { total: count, page: parseInt(page), limit: parseInt(limit) }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/anomalies/:id/acknowledge
router.patch('/:id/acknowledge', authenticate, authorize('admin', 'doctor', 'nurse'), async (req, res) => {
  try {
    const anomaly = await Anomaly.findByPk(req.params.id);
    if (!anomaly) return res.status(404).json({ error: 'Anomaly not found' });

    await anomaly.update({
      is_acknowledged: true,
      acknowledged_by: req.user.name,
      acknowledged_at: new Date(),
      action_taken: req.body.action_taken
    });

    res.json(anomaly);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
