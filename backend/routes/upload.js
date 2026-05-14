const express = require('express');
const router = express.Router();
const multer = require('multer');
const AWS = require('aws-sdk');
const { authenticate, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

const s3 = new AWS.S3({
  region: process.env.AWS_REGION || 'us-east-1'
});

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowed = ['text/csv', 'application/json', 'application/vnd.ms-excel'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only CSV/JSON files allowed'), false);
  }
});

// POST /api/upload/dataset — upload dataset to S3
router.post('/dataset', authenticate, authorize('admin', 'analyst'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const key = `datasets/${Date.now()}-${req.file.originalname}`;

    if (process.env.NODE_ENV === 'production') {
      const params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
        ServerSideEncryption: 'AES256', // HIPAA: encrypt at rest
        Metadata: {
          uploaded_by: req.user.email,
          original_name: req.file.originalname
        }
      };

      const result = await s3.upload(params).promise();
      logger.info(`File uploaded to S3: ${result.Location}`);

      res.json({
        message: 'File uploaded to S3 successfully',
        key,
        location: result.Location,
        size: req.file.size
      });
    } else {
      // Local dev — simulate S3
      res.json({
        message: 'File received (S3 upload skipped in dev mode)',
        key,
        size: req.file.size
      });
    }
  } catch (err) {
    logger.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
