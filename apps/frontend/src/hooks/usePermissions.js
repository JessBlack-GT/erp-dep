import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

// UX only. The API resolves current permissions from persisted identity on every request.
export function usePermissions() {
  const session = useContext(AuthContext);
  return permission => !!session?.isAuthenticated && !!session.user?.permissions?.includes(permission);
}
