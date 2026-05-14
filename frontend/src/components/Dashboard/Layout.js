import React, { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  LayoutDashboard, Users, AlertTriangle, BarChart3,
  LogOut, Menu, X, Activity, Bell, Settings, ChevronRight
} from 'lucide-react';
import './Layout.css';

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { to: '/patients', icon: Users, label: 'Patients' },
  { to: '/anomalies', icon: AlertTriangle, label: 'Anomalies' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' }
];

export default function Layout() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className={`layout ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <div className="logo-icon"><Activity size={20} /></div>
            {sidebarOpen && <span className="logo-text">HealthAnalytics</span>}
          </div>
          <button className="sidebar-toggle btn btn-ghost" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ to, icon: Icon, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              title={!sidebarOpen ? label : undefined}
            >
              <Icon size={18} />
              {sidebarOpen && <span>{label}</span>}
              {sidebarOpen && <ChevronRight size={14} className="nav-arrow" />}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info" title={!sidebarOpen ? user?.name : undefined}>
            <div className="user-avatar">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            {sidebarOpen && (
              <div className="user-details">
                <span className="user-name">{user?.name}</span>
                <span className={`badge badge-blue`}>{user?.role}</span>
              </div>
            )}
          </div>
          <button className="btn btn-ghost logout-btn" onClick={logout} title="Logout">
            <LogOut size={16} />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="top-bar">
          <div className="top-bar-left">
            <span className="aws-badge">
              <span className="aws-dot" />
              AWS Live
            </span>
          </div>
          <div className="top-bar-right">
            <button className="btn btn-ghost icon-btn"><Bell size={18} /></button>
            <button className="btn btn-ghost icon-btn"><Settings size={18} /></button>
            <div className="env-badge">EC2 + RDS + Lambda</div>
          </div>
        </header>
        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
