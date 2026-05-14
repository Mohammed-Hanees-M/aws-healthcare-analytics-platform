import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { anomaliesAPI } from '../services/api';
import { format } from 'date-fns';
import { AlertTriangle, CheckCircle, Zap, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import './AnomaliesPage.css';

const SEVERITY_CONFIG = {
  critical: { color: 'red', icon: '🔴' },
  high: { color: 'orange', icon: '🟠' },
  medium: { color: 'blue', icon: '🔵' },
  low: { color: 'green', icon: '🟢' }
};

export default function AnomaliesPage() {
  const [severity, setSeverity] = useState('');
  const [showAcknowledged, setShowAcknowledged] = useState(false);
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['anomalies', page, severity, showAcknowledged],
    queryFn: () => anomaliesAPI.getAll({
      page, limit: 15, severity,
      acknowledged: showAcknowledged ? 'all' : 'false'
    }).then(r => r.data),
    refetchInterval: 30000
  });

  const acknowledgeMutation = useMutation({
    mutationFn: ({ id, action_taken }) => anomaliesAPI.acknowledge(id, { action_taken }),
    onSuccess: () => {
      queryClient.invalidateQueries(['anomalies']);
      queryClient.invalidateQueries(['analytics-summary']);
      toast.success('Anomaly acknowledged');
    },
    onError: () => toast.error('Failed to acknowledge anomaly')
  });

  const handleAcknowledge = (id) => {
    acknowledgeMutation.mutate({ id, action_taken: 'Reviewed and acknowledged by clinical staff' });
  };

  return (
    <div className="anomalies-page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">ML Anomaly Detection</h1>
          <p className="page-subtitle">Isolation Forest model • Scikit-learn • Elastic Beanstalk • Python 3.11</p>
        </div>
        <div className="ml-info-badge">
          <Zap size={14} />
          <span>Model v1.0.0 — Isolation Forest (n_estimators=100)</span>
        </div>
      </div>

      {/* Filters */}
      <div className="card filters-bar">
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Filter by severity:</span>
          {['', 'critical', 'high', 'medium', 'low'].map(s => (
            <button
              key={s}
              className={`btn ${severity === s ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => { setSeverity(s); setPage(1); }}
              style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={showAcknowledged}
            onChange={e => setShowAcknowledged(e.target.checked)}
          />
          <span>Show acknowledged</span>
        </label>
      </div>

      {isLoading ? (
        <div className="loading-overlay"><div className="spinner" /></div>
      ) : (
        <>
          <div className="anomalies-list">
            {data?.anomalies?.length === 0 && (
              <div className="card empty-state">
                <CheckCircle size={40} color="var(--accent-green)" opacity={0.5} />
                <p>No active anomalies detected</p>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ML model is continuously monitoring patient vitals</span>
              </div>
            )}
            {data?.anomalies?.map(anomaly => {
              const cfg = SEVERITY_CONFIG[anomaly.severity] || SEVERITY_CONFIG.medium;
              return (
                <div key={anomaly.id} className={`anomaly-card card severity-${anomaly.severity} ${anomaly.is_acknowledged ? 'acknowledged' : ''}`}>
                  <div className="anomaly-card-left">
                    <div className={`severity-indicator badge-${cfg.color}`}>
                      <AlertTriangle size={16} />
                    </div>
                    <div className="anomaly-info">
                      <div className="anomaly-type">
                        {cfg.icon} {anomaly.anomaly_type?.replace(/_/g, ' ').toUpperCase()}
                      </div>
                      <div className="anomaly-patient">
                        Patient: <Link to={`/patients/${anomaly.patient?.id}`} className="patient-link">
                          {anomaly.patient?.first_name} {anomaly.patient?.last_name}
                        </Link>
                        {anomaly.patient?.ward && <span className="badge badge-blue" style={{ marginLeft: 8 }}>{anomaly.patient.ward}</span>}
                      </div>
                      <p className="anomaly-description">{anomaly.description}</p>
                      {anomaly.vital_values && (
                        <div className="vital-values">
                          {Object.entries(anomaly.vital_values).map(([k, v]) => (
                            <span key={k} className="vital-chip">
                              <span style={{ color: 'var(--text-muted)' }}>{k}:</span> {typeof v === 'number' ? v.toFixed(1) : v}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="anomaly-card-right">
                    <div className="anomaly-meta">
                      <div className="anomaly-score">
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Anomaly Score</span>
                        <div className="score-bar-wrap">
                          <div
                            className="score-bar-fill"
                            style={{
                              width: `${(anomaly.score || 0) * 100}%`,
                              background: anomaly.score > 0.85 ? 'var(--accent-red)' : 'var(--accent-orange)'
                            }}
                          />
                        </div>
                        <span style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                          {anomaly.score?.toFixed(3)}
                        </span>
                      </div>
                      <div className="anomaly-time">
                        <Clock size={12} />
                        {anomaly.created_at && !isNaN(new Date(anomaly.created_at))
                          ? format(new Date(anomaly.created_at), 'MMM dd, HH:mm')
                          : 'N/A'}
                      </div>
                      <span className={`badge badge-${cfg.color}`}>{anomaly.severity}</span>
                    </div>

                    {anomaly.is_acknowledged ? (
                      <div className="acknowledged-info">
                        <CheckCircle size={14} color="var(--accent-green)" />
                        <span>Acknowledged by {anomaly.acknowledged_by}</span>
                      </div>
                    ) : (
                      <button
                        className="btn btn-primary acknowledge-btn"
                        onClick={() => handleAcknowledge(anomaly.id)}
                        disabled={acknowledgeMutation.isLoading}
                      >
                        <CheckCircle size={14} />
                        Acknowledge
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {data?.pagination && data.pagination.total > 15 && (
            <div className="pagination">
              <span className="pagination-info">{data.pagination.total} total anomalies</span>
              <div className="pagination-controls">
                <button className="btn btn-ghost" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Previous</button>
                <button className="btn btn-ghost" disabled={page >= data.pagination.pages} onClick={() => setPage(p => p + 1)}>Next →</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
