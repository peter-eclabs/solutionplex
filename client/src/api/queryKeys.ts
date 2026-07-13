import type { QueryClient } from '@tanstack/react-query';

/**
 * After any mutation that can change plex relationships or effective labels
 * (app link/unlink, create app with solution, etc.), invalidate all related
 * query families so list cards and detail views refetch instead of showing
 * stale React Query cache.
 */
export function invalidatePlexCaches(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ['problems'] });
  void queryClient.invalidateQueries({ queryKey: ['solutions'] });
  void queryClient.invalidateQueries({ queryKey: ['apps'] });
  void queryClient.invalidateQueries({ queryKey: ['detail-lookups'] });
}
