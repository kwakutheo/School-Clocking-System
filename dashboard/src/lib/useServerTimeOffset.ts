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

/**
 * Returns a function that generates a "fake" local Date object.
 * This Date object is mathematically shifted so that standard local methods
 * (like .getHours(), .getDate(), format(), etc.) will perfectly output the
 * true Ghana (UTC) time, completely ignoring the device's actual OS timezone.
 * 
 * Do NOT use .toISOString() on the returned date, as its UTC representation is warped.
 */
export function useGhanaTime() {
  const offset = useServerTimeOffset() ?? 0;
  
  return function getGhanaTime() {
    const trueEpoch = Date.now() + offset;
    const tzOffsetMs = new Date().getTimezoneOffset() * 60000;
    return new Date(trueEpoch + tzOffsetMs);
  };
}

/**
 * Shifts any absolute epoch timestamp into a "fake" local Date object
 * so that standard local formatting methods will output true Ghana (UTC) time.
 */
export function shiftToGhanaTime(trueEpoch: number): Date {
  const tzOffsetMs = new Date().getTimezoneOffset() * 60000;
  return new Date(trueEpoch + tzOffsetMs);
}

/**
 * Returns a function that gets the true absolute epoch string for the server time,
 * which is safe to use with .toISOString().
 */
export function useTrueEpoch() {
  const offset = useServerTimeOffset() ?? 0;
  
  return function getTrueEpoch() {
    return new Date(Date.now() + offset);
  };
}
