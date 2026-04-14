import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function AdminRoute({ children }) {
  const { role, loading } = useAuth();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-slate-600">Loading...</div>;
  }

  if (role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
