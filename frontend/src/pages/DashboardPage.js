import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsAPI } from '../services/api';
import StatsCard from '../components/Dashboard/StatsCard';
import VitalsTrendChart from '../components/Charts/VitalsTrendChart';
import StatusDistributionChart from '../components/Charts/StatusDistributionChart';
import AdmissionsChart from '../components/Charts/AdmissionsChart';
import { Users, AlertTriangle, Activity, HeartPulse, TrendingUp, Zap } from 'lucide-react';
import './DashboardPage.css';

export default function DashboardPage() {
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['analytics-summary'],
    queryFn: () => analyticsAPI.getSummary().then(r => r.data),
    refetchInterval: 30000
  });

  const { data: vitalsTrend, isLoading: vitalsLoading } = useQuery({
    queryKey: ['vitals-trend'],
    queryFn: () => analyticsAPI.getVitalsTrend({ hours: 24 }).then(r => r.data),
    refetchInterval: 60000
  });

  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ['status-distribution'],
    queryFn: () => analyticsAPI.getStatusDistribution().then(r => r.data)
  });

  const { data: admissionsData, isLoading: admissionsLoading } = useQuery({
    queryKey: ['admissions-trend'],
    queryFn: () => analyticsAPI.getAdmissionsTrend({ days: 14 }).then(r => r.data)
  });

  const { data: anomalyStats } = useQuery({
    queryKey: ['anomaly-stats'],
    queryFn: () => analyticsAPI.getAnomalyStats().then(r => r.data)
  });

  return (
    <div className="dashboard-page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Clinical Dashboard</h1>
          <p className="page-subtitle">Real-time patient monitoring • AWS Lambda ETL • ML Anomaly Detection</p>
        </div>
        <div className="header-badges">
          <span className="pipeline-badge"><Zap size={12} /> ETL Active</span>
          <span className="ml-badge"><Activity size={12} /> ML Model v1.0</span>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="stats-grid">
        <StatsCard
          title="Total Patients"
          value={summary?.total_patients}
          subtitle="Across all wards"
          icon={Users}
          color="blue"
          loading={summaryLoading}
        />
        <StatsCard
          title="Critical Cases"
          value={summary?.critical_patients}
          subtitle="Require immediate attention"
          icon={AlertTriangle}
          color="red"
          loading={summaryLoading}
        />
        <StatsCard
          title="Today's Admissions"
          value={summary?.today_admissions}
          subtitle="New patients today"
          icon={TrendingUp}
          color="green"
          loading={summaryLoading}
        />
        <StatsCard
          title="Active Anomalies"
          value={summary?.active_anomalies}
          subtitle="Unacknowledged ML flags"
          icon={Zap}
          color="orange"
          loading={summaryLoading}
        />
        <StatsCard
          title="Avg Heart Rate"
          value={summary?.avg_heart_rate ? `${summary.avg_heart_rate} bpm` : null}
          subtitle="24h average across patients"
          icon={HeartPulse}
          color="red"
          loading={summaryLoading}
        />
        <StatsCard
          title="Avg SpO₂"
          value={summary?.avg_oxygen_saturation ? `${summary.avg_oxygen_saturation}%` : null}
          subtitle="Oxygen saturation 24h avg"
          icon={Activity}
          color="cyan"
          loading={summaryLoading}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="charts-row-main">
        <div className="card chart-card vitals-chart-card">
          <div className="chart-header">
            <div>
              <h3 className="chart-title">Patient Vitals Trends</h3>
              <p className="chart-subtitle">24-hour aggregated vital signs • Lambda ETL pipeline</p>
            </div>
          </div>
          <VitalsTrendChart data={vitalsTrend} loading={vitalsLoading} />
        </div>

        <div className="card chart-card">
          <div className="chart-header">
            <div>
              <h3 className="chart-title">Patient Status</h3>
              <p className="chart-subtitle">Current status distribution</p>
            </div>
          </div>
          <StatusDistributionChart data={statusData} loading={statusLoading} />
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="charts-row-secondary">
        <div className="card chart-card">
          <div className="chart-header">
            <div>
              <h3 className="chart-title">Daily Admissions (14 days)</h3>
              <p className="chart-subtitle">Patient admission trend</p>
            </div>
          </div>
          <AdmissionsChart data={admissionsData} loading={admissionsLoading} />
        </div>

        <div className="card chart-card">
          <div className="chart-header">
            <h3 className="chart-title">Anomaly Breakdown</h3>
          </div>
          <div className="anomaly-breakdown">
            {anomalyStats?.by_severity?.map(item => {
              const colors = { critical: 'red', high: 'orange', medium: 'blue', low: 'green' };
              const color = colors[item.severity] || 'blue';
              return (
                <div key={item.severity} className="anomaly-row">
                  <div className="anomaly-label">
                    <span className={`badge badge-${color}`}>{item.severity}</span>
                  </div>
                  <div className="anomaly-bar-wrap">
                    <div
                      className="anomaly-bar-fill"
                      style={{
                        width: `${Math.min(100, (parseInt(item.count) / 20) * 100)}%`,
                        background: `var(--accent-${color})`
                      }}
                    />
                  </div>
                  <span className="anomaly-count">{item.count}</span>
                </div>
              );
            }) ?? <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No anomalies detected</p>}
          </div>
        </div>

        <div className="card chart-card aws-info-card">
          <h3 className="chart-title">AWS Infrastructure</h3>
          <div className="aws-services">
            {[
              { name: 'EC2 Instance', status: 'running', detail: 't3.medium • us-east-1' },
              { name: 'RDS PostgreSQL', status: 'running', detail: 'db.t3.micro • Multi-AZ' },
              { name: 'Lambda ETL', status: 'running', detail: '3 functions • Python 3.11' },
              { name: 'S3 Storage', status: 'running', detail: 'AES-256 encrypted' },
              { name: 'API Gateway', status: 'running', detail: 'REST API • JWT auth' },
              { name: 'CloudWatch', status: 'running', detail: 'Monitoring active' }
            ].map(svc => (
              <div key={svc.name} className="aws-service-row">
                <div className="aws-service-dot" />
                <div className="aws-service-info">
                  <span className="aws-service-name">{svc.name}</span>
                  <span className="aws-service-detail">{svc.detail}</span>
                </div>
                <span className="aws-service-status">●</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
