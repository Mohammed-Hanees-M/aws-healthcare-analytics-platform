import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsAPI } from '../services/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Cell
} from 'recharts';
import AdmissionsChart from '../components/Charts/AdmissionsChart';
import StatusDistributionChart from '../components/Charts/StatusDistributionChart';
import VitalsTrendChart from '../components/Charts/VitalsTrendChart';
import { BarChart3, Clock } from 'lucide-react';
import './AnalyticsPage.css';

const WARD_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4'];

export default function AnalyticsPage() {
  const [vitalsHours, setVitalsHours] = useState(24);
  const [admissionsDays, setAdmissionsDays] = useState(30);

  const { data: vitalsTrend, isLoading: vitalsLoading } = useQuery({
    queryKey: ['vitals-trend', vitalsHours],
    queryFn: () => analyticsAPI.getVitalsTrend({ hours: vitalsHours }).then(r => r.data),
    refetchInterval: 60000
  });

  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ['status-distribution'],
    queryFn: () => analyticsAPI.getStatusDistribution().then(r => r.data)
  });

  const { data: admissionsData, isLoading: admissionsLoading } = useQuery({
    queryKey: ['admissions-trend', admissionsDays],
    queryFn: () => analyticsAPI.getAdmissionsTrend({ days: admissionsDays }).then(r => r.data)
  });

  const { data: wardData, isLoading: wardLoading } = useQuery({
    queryKey: ['ward-occupancy'],
    queryFn: () => analyticsAPI.getWardOccupancy().then(r => r.data)
  });

  const { data: anomalyStats, isLoading: anomalyLoading } = useQuery({
    queryKey: ['anomaly-stats'],
    queryFn: () => analyticsAPI.getAnomalyStats().then(r => r.data)
  });

  const wardChartData = (wardData || []).map(w => ({
    ward: w.ward || 'Unknown',
    patients: parseInt(w.patient_count)
  }));

  const anomalyTypeData = (anomalyStats?.by_type || []).map(a => ({
    type: a.anomaly_type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Unknown',
    count: parseInt(a.count)
  }));

  return (
    <div className="analytics-page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics & Insights</h1>
          <p className="page-subtitle">PostgreSQL aggregations • RDS • CloudWatch metrics • ETL pipeline</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          <Clock size={14} />
          <span>Auto-refreshes every 60s</span>
        </div>
      </div>

      {/* Vitals Trend with time selector */}
      <div className="card">
        <div className="chart-header-row">
          <div>
            <h3 className="chart-title">Vitals Trend Analysis</h3>
            <p className="chart-subtitle">Hourly aggregated averages across all patients</p>
          </div>
          <div className="time-selector">
            {[6, 12, 24, 48].map(h => (
              <button
                key={h}
                className={`btn ${vitalsHours === h ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setVitalsHours(h)}
                style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
              >
                {h}h
              </button>
            ))}
          </div>
        </div>
        <VitalsTrendChart data={vitalsTrend} loading={vitalsLoading} />
      </div>

      {/* Two column row */}
      <div className="analytics-grid-2">
        <div className="card">
          <div className="chart-header-row">
            <div>
              <h3 className="chart-title">Admissions Trend</h3>
              <p className="chart-subtitle">Daily patient admissions</p>
            </div>
            <div className="time-selector">
              {[7, 14, 30].map(d => (
                <button
                  key={d}
                  className={`btn ${admissionsDays === d ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setAdmissionsDays(d)}
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
          <AdmissionsChart data={admissionsData} loading={admissionsLoading} />
        </div>

        <div className="card">
          <h3 className="chart-title" style={{ marginBottom: '1rem' }}>Patient Status Distribution</h3>
          <StatusDistributionChart data={statusData} loading={statusLoading} />
        </div>
      </div>

      {/* Three column row */}
      <div className="analytics-grid-3">
        {/* Ward Occupancy */}
        <div className="card">
          <h3 className="chart-title" style={{ marginBottom: '1rem' }}>Ward Occupancy</h3>
          {wardLoading ? (
            <div className="loading-overlay"><div className="spinner" /></div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={wardChartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} stroke="var(--border)" />
                <YAxis dataKey="ward" type="category" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} stroke="var(--border)" width={80} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="patients" radius={[0, 4, 4, 0]}>
                  {wardChartData.map((_, i) => (
                    <Cell key={i} fill={WARD_COLORS[i % WARD_COLORS.length]} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Anomaly Types */}
        <div className="card">
          <h3 className="chart-title" style={{ marginBottom: '1rem' }}>Anomaly Types (ML)</h3>
          {anomalyLoading ? (
            <div className="loading-overlay"><div className="spinner" /></div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={anomalyTypeData} margin={{ top: 5, right: 10, bottom: 40, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="type" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} stroke="var(--border)" angle={-35} textAnchor="end" />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} stroke="var(--border)" />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" fill="var(--accent-purple)" fillOpacity={0.8} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Anomaly Severity Radar */}
        <div className="card">
          <h3 className="chart-title" style={{ marginBottom: '1rem' }}>Severity Distribution</h3>
          {anomalyLoading ? (
            <div className="loading-overlay"><div className="spinner" /></div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={anomalyStats?.by_severity?.map(a => ({
                severity: a.severity,
                count: parseInt(a.count)
              })) || []}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="severity" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <PolarRadiusAxis tick={{ fill: 'var(--text-muted)', fontSize: 9 }} />
                <Radar dataKey="count" stroke="var(--accent-cyan)" fill="var(--accent-cyan)" fillOpacity={0.2} />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Data Pipeline Info */}
      <div className="card pipeline-card">
        <div className="pipeline-header">
          <BarChart3 size={18} color="var(--accent-blue)" />
          <h3 className="chart-title">AWS Data Pipeline Architecture</h3>
        </div>
        <div className="pipeline-steps">
          {[
            { step: '1', label: 'Kaggle Dataset', detail: 'Heart Disease + Diabetes CSVs', color: 'var(--accent-blue)' },
            { step: '2', label: 'Lambda Ingestion', detail: 'Python ETL → S3 bucket upload', color: 'var(--accent-purple)' },
            { step: '3', label: 'S3 Trigger', detail: 'ObjectCreated event → Lambda', color: 'var(--accent-orange)' },
            { step: '4', label: 'ETL Transform', detail: 'Pandas cleaning → RDS insert', color: 'var(--accent-cyan)' },
            { step: '5', label: 'ML Inference', detail: 'Isolation Forest anomaly scoring', color: 'var(--accent-purple)' },
            { step: '6', label: 'API + Dashboard', detail: 'Node.js REST → React visualizations', color: 'var(--accent-green)' }
          ].map((s, i) => (
            <React.Fragment key={s.step}>
              <div className="pipeline-step">
                <div className="pipeline-step-num" style={{ background: s.color + '20', color: s.color, border: `1px solid ${s.color}40` }}>
                  {s.step}
                </div>
                <div>
                  <div className="pipeline-step-label">{s.label}</div>
                  <div className="pipeline-step-detail">{s.detail}</div>
                </div>
              </div>
              {i < 5 && <div className="pipeline-arrow">→</div>}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
