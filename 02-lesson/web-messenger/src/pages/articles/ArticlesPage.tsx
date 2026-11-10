import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { NavLink } from 'react-router';
import { AuthStatus } from '../../features/auth';
import { Button } from '../../shared/ui/button';
import { Input } from '../../shared/ui/input';
import type { Article } from './model/article';
import {
  useArticles,
  useCreateArticle,
  useDeleteArticle,
  useUpdateArticle,
} from './model/use-articles';
import './articles.css';

const articleDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function formatArticleDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Дата неизвестна' : articleDateFormatter.format(date);
}

export function ArticlesPage() {
  const articlesQuery = useArticles();
  const createMutation = useCreateArticle();
  const updateMutation = useUpdateArticle();
  const deleteMutation = useDeleteArticle();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const createForm = useForm<{ title: string; body: string }>({ defaultValues: { title: '', body: '' } });
  const editForm = useForm<{ title: string; body: string; expected_updated_at: string }>({
    defaultValues: { title: '', body: '', expected_updated_at: '' },
  });
  const [editingArticleId, setEditingArticleId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [expandedArticleId, setExpandedArticleId] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const isWriting = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const pages = articlesQuery.data?.pages ?? [];
  const articles = pages.flatMap((page) => page.data);

  function toggleCreate() {
    createMutation.reset();
    updateMutation.reset();
    deleteMutation.reset();
    setNotice('');
    setEditingArticleId(null);
    setConfirmDeleteId(null);
    setIsCreateOpen((isOpen) => !isOpen);
  }

  const handleCreateSubmit = createForm.handleSubmit(({ title, body }) => {
    createMutation.mutate({ title: title.trim(), body }, {
      onSuccess: () => {
        createForm.reset();
        setIsCreateOpen(false);
        setNotice('Статья создана.');
      },
    });
  });

  function startEditing(article: Article) {
    updateMutation.reset();
    deleteMutation.reset();
    setNotice('');
    setIsCreateOpen(false);
    setConfirmDeleteId(null);
    editForm.reset({ title: article.title, body: article.body, expected_updated_at: article.updated_at });
    setEditingArticleId(article.id);
  }

  const saveArticle = editForm.handleSubmit(({ title, body, expected_updated_at }) => {
    if (editingArticleId === null) return;
    updateMutation.mutate({ id: editingArticleId, title: title.trim(), body, expected_updated_at }, {
      onSuccess: () => {
        setEditingArticleId(null);
        setNotice('Изменения сохранены.');
      },
    });
  });

  function deleteArticle(article: Article) {
    deleteMutation.mutate(article.id, {
      onSuccess: () => {
        setConfirmDeleteId(null);
        setNotice('Статья удалена.');
      },
    });
  }

  return (
    <main className="articles-shell">
      <header className="app-header articles-app-header">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true"><span /></div>
          <div>
            <p className="eyebrow">Content desk</p>
            <h1>Статьи</h1>
          </div>
        </div>
        <nav className="app-navigation" aria-label="Основная навигация">
          <NavLink className="app-nav-link" end to="/">Диалоги</NavLink>
          <NavLink className="app-nav-link" to="/articles">Статьи</NavLink>
        </nav>
        <div className="app-header-actions">
          <Button
            aria-controls="article-create-form"
            aria-expanded={isCreateOpen}
            className="article-primary-action"
            disabled={isWriting}
            onClick={toggleCreate}
            type="button"
            variant="default"
            size="sm"
          >
            <span aria-hidden="true">＋</span>
            Новая статья
          </Button>
          <AuthStatus />
        </div>
      </header>

      <section className="articles-intro" aria-labelledby="articles-title">
        <div>
          <p className="eyebrow">Библиотека материалов</p>
          <h2 id="articles-title">Управляйте текстами</h2>
          <p className="articles-description">Создавайте статьи и редактируйте их содержимое.</p>
        </div>
        <div className="articles-total" aria-live="polite">
          <span className="articles-total-value">{articles.length.toLocaleString('ru-RU')}</span>
          <span>загружено</span>
        </div>
      </section>

      {notice && <p className="article-notice" role="status">{notice}</p>}
      {(updateMutation.isError || deleteMutation.isError) && (
        <p className="article-form-error" role="alert">
          {updateMutation.error?.message ?? deleteMutation.error?.message ?? 'Не удалось сохранить изменения.'}
        </p>
      )}

      {isCreateOpen && (
        <form className="article-create-card" id="article-create-form" onSubmit={(event) => void handleCreateSubmit(event)}>
          <div className="article-create-heading">
            <div>
              <p className="eyebrow">Новая запись</p>
              <h2>Добавить статью</h2>
            </div>
            <button disabled={isWriting} className="article-close-button" onClick={() => setIsCreateOpen(false)} type="button" aria-label="Закрыть форму">
              ×
            </button>
          </div>

          <div className="article-create-fields">
            <label className="article-field-group">
              <span>Заголовок</span>
              <Input
                autoFocus
                className="article-field"
                disabled={isWriting}
                maxLength={200}
                aria-invalid={Boolean(createForm.formState.errors.title)}
                {...createForm.register('title', {
                  validate: (value) => value.trim().length > 0 || 'Укажите заголовок статьи.',
                })}
                placeholder="Например, Как начать диалог"
                required
              />
            </label>
            <label className="article-field-group">
              <span>Текст статьи</span>
              <textarea
                className="article-field article-create-body"
                disabled={isWriting}
                maxLength={12_000}
                aria-invalid={Boolean(createForm.formState.errors.body)}
                {...createForm.register('body', {
                  validate: (value) => value.trim().length > 0 || 'Добавьте текст статьи.',
                })}
                placeholder="Добавьте содержание статьи…"
                required
              />
            </label>
          </div>

          {(createForm.formState.errors.title || createForm.formState.errors.body || createMutation.isError) && (
            <p className="article-form-error" role="alert">
              {createForm.formState.errors.title?.message ?? createForm.formState.errors.body?.message ?? createMutation.error?.message ?? 'Не удалось создать статью.'}
            </p>
          )}
          <div className="article-form-actions">
            <Button disabled={createMutation.isPending} type="submit" variant="default" size="sm">
              {createMutation.isPending ? 'Создаю…' : 'Создать статью'}
            </Button>
            <Button disabled={isWriting} onClick={() => setIsCreateOpen(false)} type="button" variant="outline" size="sm">
              Отмена
            </Button>
          </div>
        </form>
      )}

      <section className="articles-table-card" aria-label="Список статей">
        <div className="articles-table-heading">
          <div>
            <p className="eyebrow">Материалы</p>
            <h2>Все статьи</h2>
          </div>
          <div className="article-row-actions">
            <span className="articles-page-size">до 20 за страницу</span>
            <Button disabled={isWriting || articlesQuery.isFetching} onClick={() => void articlesQuery.refetch()} type="button" variant="outline" size="sm">
              {articlesQuery.isFetching && !articlesQuery.isFetchingNextPage ? 'Обновляю…' : 'Обновить'}
            </Button>
          </div>
        </div>

        {articlesQuery.isPending && <div className="articles-state">Загружаю статьи…</div>}
        {articlesQuery.isError && (
          <div className="articles-state articles-error-state" role="alert">
            <p>{articlesQuery.error.message}</p>
            <Button onClick={() => void articlesQuery.refetch()} type="button" variant="outline" size="sm">
              Повторить загрузку
            </Button>
          </div>
        )}

        {!articlesQuery.isPending && !articlesQuery.isError && articles.length === 0 && (
          <div className="articles-empty-state">
            <div className="articles-empty-mark" aria-hidden="true">A</div>
            <h3>Пока нет статей</h3>
            <p>Создайте первую запись — она появится в этой таблице.</p>
            <Button disabled={isWriting} onClick={() => { if (!isCreateOpen) toggleCreate(); }} type="button" variant="outline" size="sm">
              Добавить статью
            </Button>
          </div>
        )}

        {articles.length > 0 && (
          <>
            <div className="articles-table-scroll">
              <table className="articles-table">
                <thead>
                  <tr>
                    <th scope="col">Статья</th>
                    <th scope="col">Обновлена</th>
                    <th scope="col"><span className="sr-only">Действия</span></th>
                  </tr>
                </thead>
                <tbody>
                  {articles.map((article) => {
                    const isEditing = editingArticleId === article.id;
                    const isDeleteConfirming = confirmDeleteId === article.id;

                    return (
                      <tr key={article.id}>
                        <td className="article-main-cell">
                          <div className="article-title-line">
                            <span className="article-id">#{article.id}</span>
                            <strong>{article.title}</strong>
                          </div>
                          {isEditing ? (
                            <form id="article-edit-form" onSubmit={(event) => void saveArticle(event)}>
                              <input type="hidden" {...editForm.register('expected_updated_at')} />
                              <label className="article-field-group article-edit-group">
                                <span>Заголовок</span>
                                <Input
                                  autoFocus
                                  className="article-field"
                                  disabled={isWriting}
                                  maxLength={200}
                                  aria-invalid={Boolean(editForm.formState.errors.title)}
                                  {...editForm.register('title', {
                                    validate: (value) => value.trim().length > 0 || 'Укажите заголовок статьи.',
                                  })}
                                  required
                                />
                              </label>
                              <label className="article-field-group article-edit-group">
                                <span>Текст статьи</span>
                                <textarea
                                  className="article-field article-edit-body"
                                  disabled={isWriting}
                                  maxLength={12_000}
                                  aria-invalid={Boolean(editForm.formState.errors.body)}
                                  {...editForm.register('body', {
                                    validate: (value) => value.trim().length > 0 || 'Добавьте текст статьи.',
                                  })}
                                  required
                                />
                              </label>
                              {(editForm.formState.errors.title || editForm.formState.errors.body) && (
                                <p className="article-form-error" role="alert">
                                  {editForm.formState.errors.title?.message ?? editForm.formState.errors.body?.message}
                                </p>
                              )}
                            </form>
                          ) : (
                            <p id={`article-body-${article.id}`} className={`article-body-preview${expandedArticleId === article.id ? ' article-body-full' : ''}`}>
                              {article.body || 'Текст пока пустой'}
                            </p>
                          )}
                        </td>
                        <td className="article-date-cell">
                          <time dateTime={article.updated_at}>{formatArticleDate(article.updated_at)}</time>
                        </td>
                        <td className="article-actions-cell">
                          {isEditing ? (
                            <div className="article-row-actions">
                              <Button
                                disabled={isWriting || !editForm.formState.isDirty}
                                form="article-edit-form"
                                type="submit"
                                variant="default"
                                size="sm"
                              >
                                {updateMutation.isPending ? 'Сохраняю…' : 'Сохранить'}
                              </Button>
                              <Button
                                disabled={updateMutation.isPending}
                                onClick={() => setEditingArticleId(null)}
                                type="button"
                                variant="outline"
                                size="sm"
                              >
                                Отмена
                              </Button>
                            </div>
                          ) : isDeleteConfirming ? (
                            <div className="article-row-actions article-delete-confirm">
                              <span>Удалить?</span>
                              <Button
                                disabled={deleteMutation.isPending}
                                onClick={() => deleteArticle(article)}
                                type="button"
                                variant="outline"
                                size="sm"
                              >
                                {deleteMutation.isPending ? 'Удаляю…' : 'Да, удалить'}
                              </Button>
                              <Button disabled={isWriting} onClick={() => setConfirmDeleteId(null)} type="button" variant="outline" size="sm">
                                Отмена
                              </Button>
                            </div>
                          ) : (
                            <div className="article-row-actions">
                              <Button
                                disabled={isWriting}
                                aria-controls={`article-body-${article.id}`}
                                aria-expanded={expandedArticleId === article.id}
                                onClick={() => setExpandedArticleId(expandedArticleId === article.id ? null : article.id)}
                                type="button" variant="outline" size="sm"
                              >
                                {expandedArticleId === article.id ? 'Свернуть' : 'Читать'}
                              </Button>
                              <Button disabled={isWriting} onClick={() => startEditing(article)} type="button" variant="outline" size="sm">
                                Редактировать
                              </Button>
                              <Button
                                className="article-delete-button"
                                disabled={isWriting}
                                onClick={() => {
                                  updateMutation.reset();
                                  deleteMutation.reset();
                                  setNotice('');
                                  setIsCreateOpen(false);
                                  setEditingArticleId(null);
                                  setConfirmDeleteId(article.id);
                                }}
                                type="button"
                                variant="outline"
                                size="sm"
                              >
                                Удалить
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="articles-pagination">
              {articlesQuery.isFetchNextPageError && (
                <p className="article-form-error" role="alert">{articlesQuery.error.message}</p>
              )}
              {articlesQuery.hasNextPage ? (
                <Button
                  className="articles-load-more"
                  disabled={articlesQuery.isFetchingNextPage}
                  onClick={() => void articlesQuery.fetchNextPage()}
                  type="button"
                  variant="outline"
                  size="sm"
                >
                  {articlesQuery.isFetchingNextPage ? 'Загружаю…' : 'Загрузить ещё'}
                </Button>
              ) : (
                <span className="articles-end-note">Все загруженные статьи показаны</span>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
