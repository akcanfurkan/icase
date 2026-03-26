import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  FolderKanban,
  FlaskConical,
  Bug,
  FileText,
  Settings,
  LogOut,
  AlertCircle,
} from 'lucide-react';
import ICaseLogo from './ICaseLogo';

export default function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <ICaseLogo size={38} />
          </div>
          <div>
            <h1>iCase</h1>
            <p>AI-Powered QA Platform</p>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section">
          <div className="sidebar-section-title">Main</div>
          <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <LayoutDashboard size={18} />
            Dashboard
          </NavLink>
          <NavLink to="/projects" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <FolderKanban size={18} />
            Projects
          </NavLink>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-title">Tools</div>
          <NavLink to="/generate-tests" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <FlaskConical size={18} />
            Generate Tests
          </NavLink>
          <NavLink to="/bug-generator" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Bug size={18} />
            Bug Generator
          </NavLink>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-title">Reports</div>
          <NavLink to="/test-cases" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <FileText size={18} />
            All Test Cases
          </NavLink>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-title">Account</div>
          <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Settings size={18} />
            Settings
            {user && !user.hasApiKey && (
              <AlertCircle size={14} className="sidebar-warning-icon" />
            )}
          </NavLink>
        </div>
      </nav>

      {user && (
        <div className="sidebar-user">
          <div className="sidebar-user-info">
            <div className="sidebar-user-avatar">
              {user.name?.charAt(0).toUpperCase()}
            </div>
            <div className="sidebar-user-details">
              <span className="sidebar-user-name">{user.name}</span>
              <span className="sidebar-user-email">{user.email}</span>
            </div>
          </div>
          <button className="sidebar-logout-btn" onClick={logout} title="Logout">
            <LogOut size={16} />
          </button>
        </div>
      )}
    </aside>
  );
}
