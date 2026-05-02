import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { apiClient } from '@src/services/api/apiClient';
import type { AuthMeResponse } from '@src/services/api/schemas';

import { useSession } from './useSession';

/**
 * TanStack `useQuery` wrapper over `apiClient.getMe`. Gated on an active session.
 *
 * @returns the standard `UseQueryResult<AuthMeResponse>` from `@tanstack/react-query`
 *
 * @example
 *   const { data, isPending } = useMeQuery();
 */
export const useMeQuery = (): UseQueryResult<AuthMeResponse> => {
  const { status } = useSession();
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => apiClient.getMe(),
    enabled: status === 'active',
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
};