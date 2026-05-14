const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Patient, VitalRecord, Anomaly } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/patients — with search, filter, pagination
router.get('/', authenticate, async (req, res) => {
  try {
    const {
      page = 1, limit = 20, search = '',
      status, ward, sort = 'created_at', order = 'DESC'
    } = req.query;

    const where = {};
    if (search) {
      where[Op.or] = [
        { first_name: { [Op.iLike]: `%${search}%` } },
        { last_name: { [Op.iLike]: `%${search}%` } },
        { patient_id: { [Op.iLike]: `%${search}%` } },
        { diagnosis: { [Op.iLike]: `%${search}%` } }
      ];
    }
    if (status) where.status = status;
    if (ward) where.ward = ward;

    const { count, rows } = await Patient.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [[sort, order]],
      include: [{
        model: VitalRecord,
        as: 'vitals',
        limit: 1,
        order: [['recorded_at', 'DESC']]
      }]
    });

    res.json({
      patients: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / parseInt(limit))
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/patients/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const patient = await Patient.findByPk(req.params.id, {
      include: [
        { model: VitalRecord, as: 'vitals', limit: 50, order: [['recorded_at', 'DESC']] },
        { model: Anomaly, as: 'anomalies', limit: 10, order: [['created_at', 'DESC']] }
      ]
    });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    res.json(patient);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/patients
router.post('/', authenticate, authorize('admin', 'doctor', 'nurse'), async (req, res) => {
  try {
    const patient = await Patient.create(req.body);
    res.status(201).json(patient);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/patients/:id
router.put('/:id', authenticate, authorize('admin', 'doctor', 'nurse'), async (req, res) => {
  try {
    const patient = await Patient.findByPk(req.params.id);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    await patient.update(req.body);
    res.json(patient);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/patients/:id
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const patient = await Patient.findByPk(req.params.id);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    await patient.destroy();
    res.json({ message: 'Patient record deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/patients/:id/vitals
router.post('/:id/vitals', authenticate, async (req, res) => {
  try {
    const patient = await Patient.findByPk(req.params.id);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const vital = await VitalRecord.create({
      ...req.body,
      patient_id: req.params.id,
      recorded_by: req.user.name
    });

    res.status(201).json(vital);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/patients/:id/vitals
router.get('/:id/vitals', authenticate, async (req, res) => {
  try {
    const { hours = 24 } = req.query;
    const since = new Date(Date.now() - parseInt(hours) * 60 * 60 * 1000);

    const vitals = await VitalRecord.findAll({
      where: {
        patient_id: req.params.id,
        recorded_at: { [Op.gte]: since }
      },
      order: [['recorded_at', 'ASC']]
    });

    res.json(vitals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
