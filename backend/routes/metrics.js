const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const os = require('os');

// GET /api/metrics/system — CloudWatch-style system metrics
router.get('/system', authenticate, async (req, res) => {
  const uptime = process.uptime();
  const mem = process.memoryUsage();
  res.json({
    uptime_seconds: Math.floor(uptime),
    memory: {
      rss_mb: (mem.rss / 1024 / 1024).toFixed(2),
      heap_used_mb: (mem.heapUsed / 1024 / 1024).toFixed(2),
      heap_total_mb: (mem.heapTotal / 1024 / 1024).toFixed(2)
    },
    cpu_load: os.loadavg(),
    node_version: process.version,
    platform: process.platform,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
