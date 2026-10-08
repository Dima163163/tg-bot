import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { Button } from '../../shared/ui/button';
import { Input } from '../../shared/ui/input';
import type { Article } from './model/article';
import {
  useArticles,
  useCreateArticle,
  useDeleteArticle,
  useUpdateArticleBody,
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
  const updateMutation = useUpdateArticleBody();
  const deleteMutation = useDeleteArticle();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [createValidationError, setCreateValidationError] = useState<string | null>(null);
  const [editingArticle, setEditingArticle] = useState<{ id: number; body: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const pages = articlesQuery.data?.pages ?? [];
  const articles = pages.flatMap((page) => page.data);

  function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = newTitle.trim();
    if (!title) {
      setCreateValidationError('Укажите заголовок статьи.');
      return;
    }

    setCreateValidationError(null);
    createMutation.mutate({ title, body: newBody }, {
      onSuccess: () => {
        setNewTitle('');
        setNewBody('');
        setIsCreateOpen(false);
      },
    });
  }

  function startEditing(article: Article) {
    setConfirmDeleteId(null);
    setEditingArticle({ id: article.id, body: article.body });
  }

  function saveArticleBody(article: Article) {
    if (!editingArticle || editingArticle.id !== article.id) return;

    updateMutation.mutate(editingArticle, {
      onSuccess: () => setEditingArticle(null),
    });
  }

  function deleteArticle(article: Article) {
    deleteMutation.mutate(article.id, {
      onSuccess: () => setConfirmDeleteId(null),
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
          <Link activeProps={{ 'aria-current': 'page' }} className="app-nav-link" to="/">Диалоги</Link>
          <Link activeProps={{ 'aria-current': 'page' }} className="app-nav-link" to="/articles">Статьи</Link>
        </nav>
        <Button
          aria-controls="article-create-form"
          aria-expanded={isCreateOpen}
          className="article-primary-action"
          onClick={() => setIsCreateOpen((isOpen) => !isOpen)}
          type="button"
          variant="default"
          size="sm"
        >
          <span aria-hidden="true">＋</span>
          Новая статья
        </Button>
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

      {isCreateOpen && (
        <form className="article-create-card" id="article-create-form" onSubmit={handleCreateSubmit}>
          <div className="article-create-heading">
            <div>
              <p className="eyebrow">Новая запись</p>
              <h2>Добавить статью</h2>
            </div>
            <button className="article-close-button" onClick={() => setIsCreateOpen(false)} type="button" aria-label="Закрыть форму">
              ×
            </button>
          </div>

          <div className="article-create-fields">
            <label className="article-field-group">
              <span>Заголовок</span>
              <Input
                autoFocus
                className="article-field"
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder="Например, Как начать диалог"
                required
                value={newTitle}
              />
            </label>
            <label className="article-field-group">
              <span>Текст статьи</span>
              <textarea
                className="article-field article-create-body"
                onChange={(event) => setNewBody(event.target.value)}
                placeholder="Добавьте содержание статьи…"
                value={newBody}
              />
            </label>
          </div>

          {(createValidationError || createMutation.isError) && (
            <p className="article-form-error" role="alert">
              {createValidationError ?? createMutation.error?.message ?? 'Не удалось создать статью.'}
            </p>
          )}
          <div className="article-form-actions">
            <Button disabled={createMutation.isPending} type="submit" variant="default" size="sm">
              {createMutation.isPending ? 'Создаю…' : 'Создать статью'}
            </Button>
            <Button onClick={() => setIsCreateOpen(false)} type="button" variant="outline" size="sm">
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
          <span className="articles-page-size">до 20 за страницу</span>
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
            <Button onClick={() => setIsCreateOpen(true)} type="button" variant="outline" size="sm">
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
                    const isEditing = editingArticle?.id === article.id;
                    const isDeleteConfirming = confirmDeleteId === article.id;

                    return (
                      <tr key={article.id}>
                        <td className="article-main-cell">
                          <div className="article-title-line">
                            <span className="article-id">#{article.id}</span>
                            <strong>{article.title}</strong>
                          </div>
                          {isEditing ? (
                            <label className="article-field-group article-edit-group">
                              <span className="sr-only">Текст статьи «{article.title}»</span>
                              <textarea
                                autoFocus
                                className="article-field article-edit-body"
                                onChange={(event) => setEditingArticle({ id: article.id, body: event.target.value })}
                                value={editingArticle.body}
                              />
                            </label>
                          ) : (
                            <p className="article-body-preview">{article.body || 'Текст пока пустой'}</p>
                          )}
                        </td>
                        <td className="article-date-cell">
                          <time dateTime={article.updated_at}>{formatArticleDate(article.updated_at)}</time>
                        </td>
                        <td className="article-actions-cell">
                          {isEditing ? (
                            <div className="article-row-actions">
                              <Button
                                disabled={updateMutation.isPending || editingArticle.body === article.body}
                                onClick={() => saveArticleBody(article)}
                                type="button"
                                variant="default"
                                size="sm"
                              >
                                {updateMutation.isPending ? 'Сохраняю…' : 'Сохранить'}
                              </Button>
                              <Button
                                disabled={updateMutation.isPending}
                                onClick={() => setEditingArticle(null)}
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
                              <Button onClick={() => setConfirmDeleteId(null)} type="button" variant="outline" size="sm">
                                Отмена
                              </Button>
                            </div>
                          ) : (
                            <div className="article-row-actions">
                              <Button onClick={() => startEditing(article)} type="button" variant="outline" size="sm">
                                Изменить текст
                              </Button>
                              <Button
                                className="article-delete-button"
                                onClick={() => {
                                  setEditingArticle(null);
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

            {(updateMutation.isError || deleteMutation.isError) && (
              <p className="article-mutation-error" role="alert">
                {updateMutation.error?.message ?? deleteMutation.error?.message ?? 'Не удалось сохранить изменения.'}
              </p>
            )}

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
