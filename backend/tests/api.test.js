/**
 * Healthcare Analytics API — Test Suite
 * Run: npm test
 */

const request = require('supertest');
const app = require('../server');

let authToken = '';
let testPatientId = '';

// ─── Auth Tests ──────────────────────────────────────────────────────────────
describe('Authentication', () => {
  test('POST /api/auth/login — valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@hospital.com', password: 'Admin@2025' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.role).toBe('admin');
    authToken = res.body.token;
  });

  test('POST /api/auth/login — invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'bad@email.com', password: 'wrongpass' });

    expect(res.statusCode).toBe(401);
  });

  test('GET /api/auth/me — authenticated', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.user).toHaveProperty('email');
  });

  test('GET /api/auth/me — unauthenticated returns 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.statusCode).toBe(401);
  });
});

// ─── Analytics Tests ─────────────────────────────────────────────────────────
describe('Analytics API', () => {
  test('GET /api/analytics/summary', async () => {
    const res = await request(app)
      .get('/api/analytics/summary')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('total_patients');
    expect(res.body).toHaveProperty('critical_patients');
    expect(res.body).toHaveProperty('active_anomalies');
  });

  test('GET /api/analytics/vitals-trend', async () => {
    const res = await request(app)
      .get('/api/analytics/vitals-trend?hours=24')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/analytics/status-distribution', async () => {
    const res = await request(app)
      .get('/api/analytics/status-distribution')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ─── Patient CRUD Tests ───────────────────────────────────────────────────────
describe('Patient CRUD', () => {
  test('GET /api/patients — returns paginated list', async () => {
    const res = await request(app)
      .get('/api/patients?page=1&limit=10')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('patients');
    expect(res.body).toHaveProperty('pagination');
    expect(Array.isArray(res.body.patients)).toBe(true);
  });

  test('POST /api/patients — create patient', async () => {
    const res = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        patient_id: `TEST_${Date.now()}`,
        first_name: 'Test',
        last_name: 'Patient',
        date_of_birth: '1980-06-15',
        gender: 'male',
        diagnosis: 'Test Diagnosis',
        status: 'observation',
        ward: 'General',
        age: 44
      });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('id');
    testPatientId = res.body.id;
  });

  test('GET /api/patients/:id — get by ID', async () => {
    if (!testPatientId) return;
    const res = await request(app)
      .get(`/api/patients/${testPatientId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.first_name).toBe('Test');
  });

  test('PUT /api/patients/:id — update patient', async () => {
    if (!testPatientId) return;
    const res = await request(app)
      .put(`/api/patients/${testPatientId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'stable', ward: 'Cardiology' });

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('stable');
  });

  test('DELETE /api/patients/:id — admin can delete', async () => {
    if (!testPatientId) return;
    const res = await request(app)
      .delete(`/api/patients/${testPatientId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
  });

  test('GET /api/patients — search filter works', async () => {
    const res = await request(app)
      .get('/api/patients?search=Smith')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
  });
});

// ─── Anomalies Tests ──────────────────────────────────────────────────────────
describe('Anomalies API', () => {
  test('GET /api/anomalies — returns list', async () => {
    const res = await request(app)
      .get('/api/anomalies')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('anomalies');
  });
});

// ─── Health Check ─────────────────────────────────────────────────────────────
describe('Health Check', () => {
  test('GET /health — server is healthy', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('healthy');
  });
});

// ─── System Metrics ───────────────────────────────────────────────────────────
describe('System Metrics', () => {
  test('GET /api/metrics/system — returns system info', async () => {
    const res = await request(app)
      .get('/api/metrics/system')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('uptime_seconds');
    expect(res.body).toHaveProperty('memory');
  });
});
