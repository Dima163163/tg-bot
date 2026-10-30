import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { AuthStatus } from '../../features/auth';
import { currentUserQueryKey } from '../../features/auth/use-current-user';
import { signIn } from '../../shared/api/auth-session';
import { Button } from '../../shared/ui/button';

export function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { register, handleSubmit, setError, clearErrors, formState: { errors, isSubmitting } } = useForm<{
    email: string;
    password: string;
  }>();

  const submit = handleSubmit(async ({ email, password }) => {
    clearErrors('root');

    try {
      const session = await signIn(email.trim(), password);
      queryClient.clear();
      queryClient.setQueryData(currentUserQueryKey, session);
      void navigate('/', { replace: true });
    } catch (error) {
      setError('root', { message: error instanceof Error ? error.message : 'Сервис входа недоступен.' });
    }
  });

  return (
    <main className="login-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true"><span /></div>
          <div>
            <p className="eyebrow">Telegram inbox</p>
            <h1>Вход</h1>
          </div>
        </div>
        <AuthStatus />
      </header>

      <section className="login-card" aria-labelledby="login-title">
        <p className="eyebrow">Авторизация</p>
        <h2 id="login-title">Вход в панель</h2>
        <p>Войдите с учётной записью назначенного оператора.</p>
        <form className="login-form" onSubmit={(event) => void submit(event)}>
          <label className="login-field">
            <span>Email</span>
            <input
              autoComplete="email"
              disabled={isSubmitting}
              {...register('email', { required: 'Укажите email.' })}
              required
              type="email"
            />
          </label>
          <label className="login-field">
            <span>Пароль</span>
            <input
              autoComplete="current-password"
              disabled={isSubmitting}
              {...register('password', { required: 'Укажите пароль.' })}
              required
              type="password"
            />
          </label>
          {(errors.email || errors.password || errors.root) && (
            <p className="login-error" role="alert">
              {errors.email?.message ?? errors.password?.message ?? errors.root?.message}
            </p>
          )}
          <Button className="login-submit" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Входим…' : 'Войти'}
          </Button>
        </form>
        <Link className="login-back-link" to="/">Вернуться к диалогам</Link>
      </section>
    </main>
  );
}
