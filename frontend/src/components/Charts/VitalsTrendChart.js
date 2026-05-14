import React, { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { format } from 'date-fns';

const VITAL_CONFIGS = [
  { key: 'avg_hr', label: 'Heart Rate', color: '#ef4444', unit: 'bpm', normalMin: 60, normalMax: 100 },
  { key: 'avg_systolic', label: 'Systolic BP', color: '#3b82f6', unit: 'mmHg', normalMin: 90, normalMax: 140 },
  { key: 'avg_spo2', label: 'SpO₂', color: '#10b981', unit: '%', normalMin: 95, normalMax: 100 },
  { key: 'avg_temp', label: 'Temperature', color: '#f59e0b', unit: '°C', normalMin: 36.1, normalMax: 37.2 }
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: '12px 16px',
      fontSize: 12
    }}>
      <p style={{ color: 'var(--text-muted)', marginBottom: 8 }}>
        {label ? format(new Date(label), 'MMM dd, HH:mm') : ''}
      </p>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color, marginBottom: 4 }}>
          <span style={{ color: 'var(--text-secondary)' }}>{p.name}: </span>
          <strong>{parseFloat(p.value).toFixed(1)}</strong>
        </div>
      ))}
    </div>
  );
};

export default function VitalsTrendChart({ data, loading }) {
  const [activeVitals, setActiveVitals] = useState(['avg_hr', 'avg_spo2']);

  const toggleVital = (key) => {
    setActiveVitals(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  if (loading) return (
    <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" />
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {VITAL_CONFIGS.map(v => (
          <button
            key={v.key}
            onClick={() => toggleVital(v.key)}
            style={{
              padding: '4px 12px',
              borderRadius: 9999,
              fontSize: 12,
              fontWeight: 500,
              border: `1px solid ${activeVitals.includes(v.key) ? v.color : 'var(--border)'}`,
              background: activeVitals.includes(v.key) ? `${v.color}20` : 'transparent',
              color: activeVitals.includes(v.key) ? v.color : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {v.label} ({v.unit})
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="hour"
            tickFormatter={(v) => v ? format(new Date(v), 'HH:mm') : ''}
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            stroke="var(--border)"
          />
          <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} stroke="var(--border)" />
          <Tooltip content={<CustomTooltip />} />
          {VITAL_CONFIGS.filter(v => activeVitals.includes(v.key)).map(v => (
            <Line
              key={v.key}
              type="monotone"
              dataKey={v.key}
              stroke={v.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              name={v.label}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
