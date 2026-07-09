import useSWR from 'swr';
import { systemApi } from './api';

/**
 * Calculates the exact time offset (in milliseconds) between the client's local
 * device clock and the authoritative server clock (Africa/Accra, Ghana).
 * This completely fixes issues caused by admins having wrong device dates or times.
 */
export function useServerTimeOffset() {
  const { data } = useSWR(
    'server-time-offset',
    () => systemApi.getServerTime().then((r) => {
      const serverTimeMs = new Date(r.data.iso).getTime();
      const localTimeMs = Date.now();
      return serverTimeMs - localTimeMs;
    }),
    {
      dedupingInterval: 60 * 60 * 1000,
      revalidateOnFocus: false,
      onErrorRetry: (_err, _key, _cfg, retry, { retryCount }) => {
        if (retryCount >= 3) return;
        setTimeout(() => retry(), 5_000);
      },
    }
  );
  return data ?? null; // Returns null while loading
}
