import { Navigate, Outlet, Route, Routes } from 'react-router';
import { useCurrentUser } from '../features/auth';
import { ArticlesPage } from '../pages/articles';
import { LoginPage } from '../pages/login';
import { MessengerPage } from '../pages/messenger/MessengerPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<RequireAuth />}>
        <Route path="/" element={<MessengerPage />} />
        <Route path="/articles" element={<ArticlesPage />} />
      </Route>
      <Route path="/login" element={<LoginPage />} />
    </Routes>
  );
}

function RequireAuth() {
  const currentUser = useCurrentUser();
  if (currentUser.isPending) return <main className="auth-route-state" role="status">Проверяем вход…</main>;
  if (currentUser.isError) {
    return (
      <main className="auth-route-state" role="alert">
        Не удалось проверить вход.
        <button onClick={() => void currentUser.refetch()} type="button">Повторить</button>
      </main>
    );
  }
  if (!currentUser.data) return <Navigate replace to="/login" />;
  return <Outlet />;
}
