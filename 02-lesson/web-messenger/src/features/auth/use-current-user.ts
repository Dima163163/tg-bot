import { useQuery } from '@tanstack/react-query';
import { getAuthSession } from '../../shared/api/auth-session';

export const currentUserQueryKey = ['auth', 'current-user'] as const;

export function useAuthSession() {
  return useQuery({
    queryKey: currentUserQueryKey,
    queryFn: getAuthSession,
    staleTime: 15_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
  });
}

export function useCurrentUser() {
  const query = useAuthSession();
  return { ...query, data: query.data?.user ?? null };
}
