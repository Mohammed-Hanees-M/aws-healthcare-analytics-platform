const express = require('express');
const router = express.Router();
const { Op, fn, col, literal } = require('sequelize');
const { Patient, VitalRecord, Anomaly, sequelize } = require('../models');
const { authenticate } = require('../middleware/auth');

// GET /api/analytics/summary — dashboard KPIs
router.get('/summary', authenticate, async (req, res) => {
  try {
    const [
      totalPatients,
      criticalPatients,
      todayAdmissions,
      activeAnomalies,
      avgHeartRate,
      avgOxygenSat
    ] = await Promise.all([
      Patient.count(),
      Patient.count({ where: { status: 'critical' } }),
      Patient.count({
        where: {
          admission_date: {
            // Widened from "today only" to "last 7 days" so imported
            // historical dataset records appear in the dashboard KPI.
            [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      }),
      Anomaly.count({ where: { is_acknowledged: false } }),
      VitalRecord.findOne({
        attributes: [[fn('AVG', col('heart_rate')), 'avg_hr']],
        where: { recorded_at: { [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        raw: true
      }),
      VitalRecord.findOne({
        attributes: [[fn('AVG', col('oxygen_saturation')), 'avg_spo2']],
        where: { recorded_at: { [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        raw: true
      })
    ]);

    res.json({
      total_patients: totalPatients,
      critical_patients: criticalPatients,
      today_admissions: todayAdmissions,
      active_anomalies: activeAnomalies,
      avg_heart_rate: parseFloat(avgHeartRate?.avg_hr || 0).toFixed(1),
      avg_oxygen_saturation: parseFloat(avgOxygenSat?.avg_spo2 || 0).toFixed(1)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/vitals-trend
router.get('/vitals-trend', authenticate, async (req, res) => {
  try {
    // Default widened to 48 h so vitals inserted by load_diabetes.py
    // (which back-fills up to 24 h) are always included.
    const { hours = 48 } = req.query;
    const since = new Date(Date.now() - parseInt(hours) * 60 * 60 * 1000);

    const trend = await VitalRecord.findAll({
      attributes: [
        [fn('DATE_TRUNC', 'hour', col('recorded_at')), 'hour'],
        [fn('AVG', col('heart_rate')), 'avg_hr'],
        [fn('AVG', col('systolic_bp')), 'avg_systolic'],
        [fn('AVG', col('diastolic_bp')), 'avg_diastolic'],
        [fn('AVG', col('oxygen_saturation')), 'avg_spo2'],
        [fn('AVG', col('temperature')), 'avg_temp'],
        [fn('COUNT', col('id')), 'record_count']
      ],
      where: { recorded_at: { [Op.gte]: since } },
      group: [fn('DATE_TRUNC', 'hour', col('recorded_at'))],
      order: [[fn('DATE_TRUNC', 'hour', col('recorded_at')), 'ASC']],
      raw: true
    });

    res.json(trend);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/patient-status-distribution
router.get('/status-distribution', authenticate, async (req, res) => {
  try {
    const distribution = await Patient.findAll({
      attributes: ['status', [fn('COUNT', col('id')), 'count']],
      group: ['status'],
      raw: true
    });
    res.json(distribution);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/admissions-over-time
router.get('/admissions-trend', authenticate, async (req, res) => {
  try {
    // Default widened to 60 days; the diabetes dataset spreads
    // admission_date over the past 45 days, so 30 was hiding ~33% of records.
    const { days = 60 } = req.query;
    const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

    const admissions = await Patient.findAll({
      attributes: [
        [fn('DATE_TRUNC', 'day', col('admission_date')), 'day'],
        [fn('COUNT', col('id')), 'admissions']
      ],
      where: { admission_date: { [Op.gte]: since } },
      group: [fn('DATE_TRUNC', 'day', col('admission_date'))],
      order: [[fn('DATE_TRUNC', 'day', col('admission_date')), 'ASC']],
      raw: true
    });

    res.json(admissions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/anomaly-stats
router.get('/anomaly-stats', authenticate, async (req, res) => {
  try {
    const bySeverity = await Anomaly.findAll({
      attributes: ['severity', [fn('COUNT', col('id')), 'count']],
      group: ['severity'],
      raw: true
    });

    const byType = await Anomaly.findAll({
      attributes: ['anomaly_type', [fn('COUNT', col('id')), 'count']],
      group: ['anomaly_type'],
      raw: true
    });

    res.json({ by_severity: bySeverity, by_type: byType });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/ward-occupancy
router.get('/ward-occupancy', authenticate, async (req, res) => {
  try {
    const occupancy = await Patient.findAll({
      attributes: ['ward', [fn('COUNT', col('id')), 'patient_count']],
      where: { status: { [Op.in]: ['admitted', 'critical', 'stable', 'observation'] } },
      group: ['ward'],
      raw: true
    });
    res.json(occupancy);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
