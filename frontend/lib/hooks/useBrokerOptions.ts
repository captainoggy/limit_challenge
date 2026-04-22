'use client';

import { useQuery } from '@tanstack/react-query';

import { apiClient, COLD_START_TIMEOUT_MS } from '@/lib/api-client';
import { Broker } from '@/lib/types';

async function fetchBrokers() {
  const response = await apiClient.get<Broker[]>('/brokers/', {
    timeout: COLD_START_TIMEOUT_MS,
  });
  return response.data;
}

export function useBrokerOptions() {
  return useQuery({
    queryKey: ['brokers'],
    queryFn: fetchBrokers,
    staleTime: 5 * 60_000,
  });
}
