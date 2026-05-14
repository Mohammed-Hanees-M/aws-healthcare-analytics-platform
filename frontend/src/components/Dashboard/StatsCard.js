import React from 'react';
import './StatsCard.css';

export default function StatsCard({ title, value, subtitle, icon: Icon, color = 'blue', trend, loading }) {
  const colorMap = {
    blue: 'var(--accent-blue)',
    green: 'var(--accent-green)',
    red: 'var(--accent-red)',
    orange: 'var(--accent-orange)',
    purple: 'var(--accent-purple)',
    cyan: 'var(--accent-cyan)'
  };

  if (loading) return (
    <div className="stats-card loading-card">
      <div className="skeleton skeleton-line" style={{ width: '60%', height: 14 }} />
      <div className="skeleton skeleton-line" style={{ width: '40%', height: 32, marginTop: 8 }} />
      <div className="skeleton skeleton-line" style={{ width: '80%', height: 12, marginTop: 8 }} />
    </div>
  );

  return (
    <div className="stats-card fade-in" style={{ '--card-color': colorMap[color] }}>
      <div className="stats-header">
        <span className="stats-title">{title}</span>
        {Icon && (
          <div className="stats-icon">
            <Icon size={18} />
          </div>
        )}
      </div>
      <div className="stats-value">{value ?? '—'}</div>
      {subtitle && <div className="stats-subtitle">{subtitle}</div>}
      {trend !== undefined && (
        <div className={`stats-trend ${trend >= 0 ? 'up' : 'down'}`}>
          <span>{trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%</span>
          <span className="trend-label">vs yesterday</span>
        </div>
      )}
      <div className="stats-accent-bar" />
    </div>
  );
}
