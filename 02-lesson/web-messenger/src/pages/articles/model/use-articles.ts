import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  articlesQueryKey,
  createArticle,
  deleteArticle,
  getArticles,
  updateArticleBody,
} from './article';

export function useArticles() {
  return useInfiniteQuery({
    queryKey: articlesQueryKey,
    queryFn: ({ pageParam }) => getArticles({ cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function useCreateArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createArticle,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: articlesQueryKey }),
  });
}

export function useUpdateArticleBody() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateArticleBody,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: articlesQueryKey }),
  });
}

export function useDeleteArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteArticle,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: articlesQueryKey }),
  });
}
