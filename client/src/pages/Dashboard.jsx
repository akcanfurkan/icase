import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FolderKanban,
  FlaskConical,
  FileText,
  Bug,
  ArrowRight,
  Plus,
} from 'lucide-react';
import { getProjects, getTestCases, getBugReports } from '../api/client';

export default function Dashboard() {
  const [stats, setStats] = useState({ projects: 0, testCases: 0, bugReports: 0 });
  const [recentProjects, setRecentProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [projects, testCases, bugReports] = await Promise.all([
          getProjects(),
          getTestCases(),
          getBugReports(),
        ]);
        setStats({
          projects: projects.length,
          testCases: testCases.length,
          bugReports: bugReports.length,
        });
        setRecentProjects(projects.slice(0, 5));
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <>
        <div className="page-header">
          <h2>Dashboard</h2>
          <p>Overview of your QA activities</p>
        </div>
        <div className="loading-center"><div className="spinner" /></div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>Overview of your QA activities</p>
      </div>

      <div className="page-body">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon purple"><FolderKanban size={24} /></div>
            <div className="stat-info">
              <h4>{stats.projects}</h4>
              <p>Projects</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon blue"><FileText size={24} /></div>
            <div className="stat-info">
              <h4>{stats.testCases}</h4>
              <p>Test Cases</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon red"><Bug size={24} /></div>
            <div className="stat-info">
              <h4>{stats.bugReports}</h4>
              <p>Bug Reports</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card mb-6">
          <div className="card-header">
            <h3>Quick Actions</h3>
          </div>
          <div className="card-body">
            <div className="flex gap-3 flex-wrap">
              <Link to="/generate-tests" className="btn btn-primary">
                <FlaskConical size={16} /> Generate Test Cases
              </Link>
              <Link to="/bug-generator" className="btn btn-danger">
                <Bug size={16} /> Generate Bug Report
              </Link>
              <Link to="/projects" className="btn btn-secondary">
                <Plus size={16} /> New Project
              </Link>
            </div>
          </div>
        </div>

        {/* Recent Projects */}
        <div className="card">
          <div className="card-header">
            <h3>Recent Projects</h3>
            <Link to="/projects" className="btn btn-sm btn-secondary">
              View All <ArrowRight size={14} />
            </Link>
          </div>
          {recentProjects.length === 0 ? (
            <div className="empty-state">
              <FolderKanban size={48} />
              <h3>No projects yet</h3>
              <p>Create your first project to get started</p>
              <Link to="/projects" className="btn btn-primary">
                <Plus size={16} /> Create Project
              </Link>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Test Runs</th>
                    <th>Test Cases</th>
                    <th>Bug Reports</th>
                    <th>Created</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {recentProjects.map((p) => (
                    <tr key={p.id}>
                      <td><strong>{p.name}</strong></td>
                      <td>{p.test_run_count}</td>
                      <td>{p.test_case_count}</td>
                      <td>{p.bug_report_count}</td>
                      <td className="text-sm text-secondary">
                        {new Date(p.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <Link to={`/projects/${p.id}`} className="btn btn-sm btn-secondary">
                          View <ArrowRight size={14} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
