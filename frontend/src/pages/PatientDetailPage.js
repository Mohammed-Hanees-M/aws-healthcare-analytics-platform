import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { patientsAPI } from '../services/api';
import { format } from 'date-fns';
import { ArrowLeft, Heart, Thermometer, Wind, Droplets, Activity, User } from 'lucide-react';
import VitalsTrendChart from '../components/Charts/VitalsTrendChart';
import './PatientDetailPage.css';

const VitalBadge = ({ label, value, unit, icon: Icon, status }) => (
  <div className={`vital-badge ${status}`}>
    <div className="vital-badge-header">
      <Icon size={16} />
      <span>{label}</span>
    </div>
    <div className="vital-badge-value">{value ?? '—'}<span className="vital-unit">{unit}</span></div>
  </div>
);

export default function PatientDetailPage() {
  const { id } = useParams();

  const { data: patient, isLoading } = useQuery({
    queryKey: ['patient', id],
    queryFn: () => patientsAPI.getById(id).then(r => r.data)
  });

  const { data: vitals } = useQuery({
    queryKey: ['patient-vitals', id],
    queryFn: () => patientsAPI.getVitals(id, { hours: 24 }).then(r => r.data),
    refetchInterval: 30000
  });

  if (isLoading) return <div className="loading-overlay"><div className="spinner" /></div>;
  if (!patient) return <div>Patient not found</div>;

  const latestVital = patient.vitals?.[0];
  const statusColors = { critical: 'red', stable: 'green', admitted: 'blue', observation: 'orange', discharged: '' };

  // Format vitals for chart
  const vitalsChartData = (vitals || []).map(v => ({
    hour: v.recorded_at,
    avg_hr: v.heart_rate,
    avg_systolic: v.systolic_bp,
    avg_diastolic: v.diastolic_bp,
    avg_spo2: v.oxygen_saturation,
    avg_temp: v.temperature
  }));

  return (
    <div className="patient-detail-page fade-in">
      <Link to="/patients" className="btn btn-ghost back-btn">
        <ArrowLeft size={16} /> Back to Patients
      </Link>

      <div className="patient-header card">
        <div className="patient-header-left">
          <div className="patient-large-avatar">
            <User size={32} />
          </div>
          <div>
            <h1>{patient.first_name} {patient.last_name}</h1>
            <p className="patient-meta">
              <code>{patient.patient_id}</code>
              {patient.age && <span>• {patient.age} years</span>}
              {patient.gender && <span>• {patient.gender}</span>}
              {patient.blood_type && <span>• Blood: {patient.blood_type}</span>}
            </p>
            <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className={`badge badge-${statusColors[patient.status] || 'blue'}`}>{patient.status}</span>
              {patient.ward && <span className="badge badge-blue">Ward: {patient.ward}</span>}
              {patient.diabetes && <span className="badge badge-orange">Diabetic</span>}
              {patient.heart_disease && <span className="badge badge-red">Heart Disease</span>}
            </div>
          </div>
        </div>
        <div className="patient-header-right">
          <div className="info-row"><span>Attending</span><strong>{patient.attending_physician || '—'}</strong></div>
          <div className="info-row"><span>Admitted</span><strong>{patient.admission_date ? format(new Date(patient.admission_date), 'MMM dd, yyyy') : '—'}</strong></div>
          <div className="info-row"><span>Diagnosis</span><strong>{patient.diagnosis || '—'}</strong></div>
        </div>
      </div>

      {/* Latest Vitals */}
      {latestVital && (
        <div>
          <h2 className="section-title">Latest Vitals <span className="section-time">Recorded {format(new Date(latestVital.recorded_at), 'MMM dd, HH:mm')}</span></h2>
          <div className="vitals-grid">
            <VitalBadge label="Heart Rate" value={latestVital.heart_rate} unit=" bpm" icon={Heart} status={latestVital.heart_rate > 120 || latestVital.heart_rate < 50 ? 'warning' : 'normal'} />
            <VitalBadge label="Blood Pressure" value={latestVital.systolic_bp && `${Math.round(latestVital.systolic_bp)}/${Math.round(latestVital.diastolic_bp)}`} unit=" mmHg" icon={Activity} status={latestVital.systolic_bp > 140 ? 'warning' : 'normal'} />
            <VitalBadge label="SpO₂" value={latestVital.oxygen_saturation} unit="%" icon={Droplets} status={latestVital.oxygen_saturation < 94 ? 'critical' : 'normal'} />
            <VitalBadge label="Temperature" value={latestVital.temperature} unit="°C" icon={Thermometer} status={latestVital.temperature > 38.5 ? 'warning' : 'normal'} />
            <VitalBadge label="Resp. Rate" value={latestVital.respiratory_rate} unit=" /min" icon={Wind} status={latestVital.respiratory_rate > 25 ? 'warning' : 'normal'} />
            <VitalBadge label="Glucose" value={latestVital.glucose_level} unit=" mg/dL" icon={Activity} status={latestVital.glucose_level > 250 ? 'warning' : 'normal'} />
          </div>
        </div>
      )}

      {/* Vitals Trend */}
      <div className="card">
        <div className="chart-header">
          <div>
            <h3 className="chart-title">Vitals Trend (24h)</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Real-time monitoring via API • auto-refreshes every 30s</p>
          </div>
        </div>
        <VitalsTrendChart data={vitalsChartData} loading={false} />
      </div>

      {/* Anomalies */}
      {patient.anomalies?.length > 0 && (
        <div>
          <h2 className="section-title">ML-Detected Anomalies</h2>
          <div className="anomalies-list">
            {patient.anomalies.map(a => (
              <div key={a.id} className={`anomaly-item card severity-${a.severity}`}>
                <div className="anomaly-header">
                  <span className={`badge badge-${a.severity === 'critical' ? 'red' : a.severity === 'high' ? 'orange' : 'blue'}`}>{a.severity}</span>
                  <code style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{a.anomaly_type?.replace(/_/g, ' ')}</code>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>Score: {a.score?.toFixed(3)}</span>
                </div>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: 8 }}>{a.description}</p>
                {a.is_acknowledged && <span className="badge badge-green" style={{ marginTop: 8, display: 'inline-flex' }}>✓ Acknowledged by {a.acknowledged_by}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
