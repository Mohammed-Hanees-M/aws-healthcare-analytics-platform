import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { format } from 'date-fns';

export default function AdmissionsChart({ data, loading }) {
  if (loading) return <div className="loading-overlay"><div className="spinner" /></div>;

  const chartData = (data || []).map(d => ({
    day: d.day ? format(new Date(d.day), 'MMM dd') : '',
    admissions: parseInt(d.admissions)
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="day" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} stroke="var(--border)" />
        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} stroke="var(--border)" />
        <Tooltip
          contentStyle={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            fontSize: 12
          }}
        />
        <Bar dataKey="admissions" fill="var(--accent-blue)" radius={[4, 4, 0, 0]}>
          {chartData.map((_, i) => (
            <Cell
              key={i}
              fill={i === chartData.length - 1 ? 'var(--accent-cyan)' : 'var(--accent-blue)'}
              fillOpacity={0.8}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
