import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { patientsAPI } from '../services/api';
import { Search, ChevronRight, User, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import './PatientsPage.css';

const STATUS_BADGE = {
  critical: 'badge-red',
  stable: 'badge-green',
  admitted: 'badge-blue',
  observation: 'badge-orange',
  discharged: ''
};

export default function PatientsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['patients', page, search, status],
    queryFn: () => patientsAPI.getAll({ page, limit: 20, search, status }).then(r => r.data),
    keepPreviousData: true
  });

  return (
    <div className="patients-page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Patient Records</h1>
          <p className="page-subtitle">CRUD operations via Node.js RESTful API • sub-200ms latency</p>
        </div>
      </div>

      <div className="card filters-bar">
        <div className="search-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search patients by name, ID, diagnosis..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="search-input"
          />
        </div>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          <option value="critical">Critical</option>
          <option value="admitted">Admitted</option>
          <option value="stable">Stable</option>
          <option value="observation">Observation</option>
          <option value="discharged">Discharged</option>
        </select>
      </div>

      {isLoading ? (
        <div className="loading-overlay"><div className="spinner" /></div>
      ) : (
        <>
          <div className="card patients-table-card">
            <table className="patients-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>ID</th>
                  <th>Age</th>
                  <th>Diagnosis</th>
                  <th>Ward</th>
                  <th>Status</th>
                  <th>Admitted</th>
                  <th>Physician</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data?.patients?.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div className="patient-name-cell">
                        <div className="patient-avatar">
                          <User size={14} />
                        </div>
                        <span>{p.first_name} {p.last_name}</span>
                      </div>
                    </td>
                    <td><code className="patient-id">{p.patient_id}</code></td>
                    <td>{p.age || '—'}</td>
                    <td className="diagnosis-cell">{p.diagnosis || '—'}</td>
                    <td><span className="badge badge-blue">{p.ward || '—'}</span></td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[p.status] || ''}`}>
                        {p.status === 'critical' && <AlertTriangle size={10} style={{ marginRight: 4 }} />}
                        {p.status}
                      </span>
                    </td>
                    <td>{p.admission_date ? format(new Date(p.admission_date), 'MMM dd, yyyy') : '—'}</td>
                    <td className="physician-cell">{p.attending_physician || '—'}</td>
                    <td>
                      <Link to={`/patients/${p.id}`} className="btn btn-ghost view-btn">
                        View <ChevronRight size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data?.patients?.length && (
              <div className="empty-state">
                <User size={40} opacity={0.3} />
                <p>No patients found</p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {data?.pagination && (
            <div className="pagination">
              <span className="pagination-info">
                Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, data.pagination.total)} of {data.pagination.total} patients
              </span>
              <div className="pagination-controls">
                <button className="btn btn-ghost" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Previous</button>
                {Array.from({ length: Math.min(5, data.pagination.pages) }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    className={`btn ${p === page ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setPage(p)}
                  >{p}</button>
                ))}
                <button className="btn btn-ghost" disabled={page >= data.pagination.pages} onClick={() => setPage(p => p + 1)}>Next →</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
