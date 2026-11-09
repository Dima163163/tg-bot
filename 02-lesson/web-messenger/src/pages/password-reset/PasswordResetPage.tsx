import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { acceptPasswordRecovery, requestPasswordReset, updatePassword } from '../../shared/api/auth-session';
import { Button } from '../../shared/ui/button';

type RecoveryMode = 'request' | 'checking' | 'email-sent' | 'new-password' | 'invalid-link' | 'complete';

interface EmailForm {
  email: string;
}

interface PasswordForm {
  password: string;
  confirmation: string;
}

function hasRecoveryResponse(params: URLSearchParams): boolean {
  return params.get('type') === 'recovery' || params.has('access_token') || params.has('error') || params.has('error_code');
}

interface RecoveryResponse {
  type: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  hasError: boolean;
}

function readRecoveryResponse(): RecoveryResponse | null {
  const params = new URLSearchParams(window.location.hash.slice(1));
  if (!hasRecoveryResponse(params)) return null;
  return {
    type: params.get('type'),
    accessToken: params.get('access_token'),
    refreshToken: params.get('refresh_token'),
    hasError: params.has('error') || params.has('error_code'),
  };
}

export function PasswordResetPage() {
  const [recoveryResponse] = useState(readRecoveryResponse);
  const [mode, setMode] = useState<RecoveryMode>(() => recoveryResponse ? 'checking' : 'request');
  const recoveryExchangeStarted = useRef(false);
  const emailForm = useForm<EmailForm>();
  const passwordForm = useForm<PasswordForm>();

  useEffect(() => {
    if (!recoveryResponse) return;

    window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`);
    if (recoveryExchangeStarted.current) return;
    recoveryExchangeStarted.current = true;

    const { type, accessToken, refreshToken, hasError } = recoveryResponse;
    if (type !== 'recovery' || !accessToken || !refreshToken || hasError) {
      setMode('invalid-link');
      return;
    }

    async function establishRecoverySession() {
      try {
        await acceptPasswordRecovery(accessToken, refreshToken);
        setMode('new-password');
      } catch (error) {
        console.error(
          'Password recovery verification failed',
          error instanceof Error ? error.name : 'Unknown error',
        );
        setMode('invalid-link');
      }
    }
    void establishRecoverySession();
  }, [recoveryResponse]);

  const submitEmail = emailForm.handleSubmit(async ({ email }) => {
    emailForm.clearErrors('root');
    try {
      await requestPasswordReset(email.trim());
      setMode('email-sent');
    } catch (error) {
      emailForm.setError('root', {
        message: error instanceof Error ? error.message : 'Не удалось отправить запрос. Попробуйте ещё раз.',
      });
    }
  });

  const submitPassword = passwordForm.handleSubmit(async ({ password }) => {
    passwordForm.clearErrors('root');
    try {
      await updatePassword(password);
      setMode('complete');
    } catch (error) {
      passwordForm.setError('root', {
        message: error instanceof Error ? error.message : 'Не удалось изменить пароль. Попробуйте ещё раз.',
      });
    }
  });

  const copy: Record<RecoveryMode, { title: string; description: string }> = {
    request: {
      title: 'Восстановление доступа',
      description: 'Укажите email учётной записи оператора. Если аккаунт существует, мы отправим ссылку для сброса пароля.',
    },
    checking: {
      title: 'Проверяем ссылку',
      description: 'Подождите, пока мы проверим ссылку восстановления.',
    },
    'email-sent': {
      title: 'Проверьте почту',
      description: 'Если аккаунт с таким email существует, письмо со ссылкой отправлено. Проверьте также папку «Спам».',
    },
    'new-password': {
      title: 'Новый пароль',
      description: 'Придумайте новый пароль для входа в панель.',
    },
    'invalid-link': {
      title: 'Ссылка недействительна',
      description: 'Ссылка истекла или уже использована. Запросите письмо для восстановления ещё раз.',
    },
    complete: {
      title: 'Пароль обновлён',
      description: 'Теперь войдите в панель с новым паролем.',
    },
  };

  return (
    <main className="login-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true"><span /></div>
          <div>
            <p className="eyebrow">Telegram inbox</p>
            <h1>Сброс пароля</h1>
          </div>
        </div>
      </header>

      <section className="login-card" aria-labelledby="password-reset-title">
        <p className="eyebrow">Авторизация</p>
        <h2 id="password-reset-title">{copy[mode].title}</h2>
        <p>{copy[mode].description}</p>

        {mode === 'request' && (
          <form className="login-form" onSubmit={(event) => void submitEmail(event)}>
            <label className="login-field">
              <span>Email</span>
              <input
                autoComplete="email"
                disabled={emailForm.formState.isSubmitting}
                {...emailForm.register('email', { required: 'Укажите email.' })}
                required
                type="email"
              />
            </label>
            {emailForm.formState.errors.email && (
              <p className="login-error" role="alert">{emailForm.formState.errors.email.message}</p>
            )}
            {emailForm.formState.errors.root && (
              <p className="login-error" role="alert">{emailForm.formState.errors.root.message}</p>
            )}
            <Button className="login-submit" disabled={emailForm.formState.isSubmitting} type="submit">
              {emailForm.formState.isSubmitting ? 'Отправляем…' : 'Отправить ссылку'}
            </Button>
          </form>
        )}

        {mode === 'checking' && <p className="login-feedback" role="status">Проверяем ссылку…</p>}
        {mode === 'email-sent' && <p className="login-feedback login-feedback-success" role="status">Письмо может прийти не сразу.</p>}
        {mode === 'invalid-link' && (
          <button className="login-text-button" onClick={() => setMode('request')} type="button">
            Запросить новую ссылку
          </button>
        )}
        {mode === 'new-password' && (
          <form className="login-form" onSubmit={(event) => void submitPassword(event)}>
            <label className="login-field">
              <span>Новый пароль</span>
              <input
                autoComplete="new-password"
                disabled={passwordForm.formState.isSubmitting}
                {...passwordForm.register('password', {
                  required: 'Укажите новый пароль.',
                  minLength: { value: 6, message: 'Пароль должен содержать не менее 6 символов.' },
                })}
                required
                type="password"
              />
            </label>
            <label className="login-field">
              <span>Повторите новый пароль</span>
              <input
                autoComplete="new-password"
                disabled={passwordForm.formState.isSubmitting}
                {...passwordForm.register('confirmation', {
                  required: 'Повторите новый пароль.',
                  validate: (value) => value === passwordForm.getValues('password') || 'Пароли не совпадают.',
                })}
                required
                type="password"
              />
            </label>
            {(passwordForm.formState.errors.password || passwordForm.formState.errors.confirmation) && (
              <p className="login-error" role="alert">
                {passwordForm.formState.errors.password?.message ?? passwordForm.formState.errors.confirmation?.message}
              </p>
            )}
            {passwordForm.formState.errors.root && (
              <p className="login-error" role="alert">{passwordForm.formState.errors.root.message}</p>
            )}
            <Button className="login-submit" disabled={passwordForm.formState.isSubmitting} type="submit">
              {passwordForm.formState.isSubmitting ? 'Сохраняем…' : 'Сохранить пароль'}
            </Button>
          </form>
        )}

        {mode === 'complete' && <p className="login-feedback login-feedback-success" role="status">Сессия восстановления завершена.</p>}
        {mode === 'complete' ? (
          <Link className="login-back-link" to="/login">Перейти ко входу</Link>
        ) : (
          <Link className="login-back-link" to="/login">Вернуться ко входу</Link>
        )}
      </section>
    </main>
  );
}
