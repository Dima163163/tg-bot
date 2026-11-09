import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { signOut } from '../../shared/api/auth-session';
import { useCurrentUser } from './use-current-user';

export function AuthStatus() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const currentUserQuery = useCurrentUser();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);

  if (currentUserQuery.isPending) {
    return <span className="auth-status auth-status-muted" role="status">Проверяем вход…</span>;
  }

  if (currentUserQuery.isError) {
    return (
      <span className="auth-status auth-status-error" role="status">
        Не удалось проверить вход
        <button type="button" onClick={() => void currentUserQuery.refetch()}>Повторить</button>
      </span>
    );
  }

  if (!currentUserQuery.data) {
    return <Link className="auth-login-link" to="/login">Войти</Link>;
  }

  const user = currentUserQuery.data;

  async function handleSignOut() {
    setIsSigningOut(true);
    setSignOutError(false);
    try {
      await signOut();
      queryClient.clear();
      void navigate('/login', { replace: true });
    } catch (error) {
      console.error('Failed to sign out', error);
      setSignOutError(true);
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <div className="auth-status-container">
      <span className="auth-status" title={user.email ?? user.id}>
        <span className="auth-status-label">Вы вошли как</span>
        <strong>{user.email ?? user.id}</strong>
      </span>
      <button className="auth-sign-out" disabled={isSigningOut} onClick={() => void handleSignOut()} type="button">
        {isSigningOut ? 'Выходим…' : 'Sign out'}
      </button>
      {signOutError && <span className="auth-sign-out-error" role="alert">Не удалось выйти. Повторите.</span>}
    </div>
  );
}
