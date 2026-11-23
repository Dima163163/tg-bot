import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  articlesQueryKey,
  createArticle,
  deleteArticle,
  getArticles,
  updateArticle,
} from './article';

export function useArticles(search: string) {
  return useInfiniteQuery({
    queryKey: [...articlesQueryKey, search],
    queryFn: ({ pageParam }) => getArticles({ cursor: pageParam, search }),
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

export function useUpdateArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateArticle,
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
