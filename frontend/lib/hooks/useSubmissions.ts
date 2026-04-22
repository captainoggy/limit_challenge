'use client';

import { keepPreviousData, QueryKey, useQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';
import {
  PaginatedResponse,
  SubmissionDetail,
  SubmissionListItem,
  SubmissionListQuery,
} from '@/lib/types';

const SUBMISSIONS_QUERY_KEY = 'submissions';
export const DEFAULT_PAGE_SIZE = 10;

export function buildParams(query: SubmissionListQuery) {
  const params: Record<string, string | number | boolean> = {};
  if (query.status) params.status = query.status;
  if (query.brokerId) params.brokerId = query.brokerId;
  if (query.companySearch) params.companySearch = query.companySearch;
  if (query.createdFrom) params.createdFrom = query.createdFrom;
  if (query.createdTo) params.createdTo = query.createdTo;
  if (query.hasDocuments !== undefined) params.hasDocuments = query.hasDocuments;
  if (query.hasNotes !== undefined) params.hasNotes = query.hasNotes;
  if (query.page && query.page > 1) params.page = query.page;
  if (query.pageSize && query.pageSize !== DEFAULT_PAGE_SIZE) params.pageSize = query.pageSize;
  return params;
}

async function fetchSubmissions(query: SubmissionListQuery) {
  const response = await apiClient.get<PaginatedResponse<SubmissionListItem>>('/submissions/', {
    params: buildParams(query),
  });
  return response.data;
}

async function fetchSubmissionDetail(id: string | number) {
  const response = await apiClient.get<SubmissionDetail>(`/submissions/${id}/`);
  return response.data;
}

export function useSubmissionsList(query: SubmissionListQuery) {
  return useQuery({
    queryKey: [SUBMISSIONS_QUERY_KEY, 'list', query] as QueryKey,
    queryFn: () => fetchSubmissions(query),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function useSubmissionDetail(id: string | number) {
  return useQuery({
    queryKey: [SUBMISSIONS_QUERY_KEY, 'detail', String(id)] as QueryKey,
    queryFn: () => fetchSubmissionDetail(id),
    enabled: Boolean(id),
    staleTime: 60_000,
  });
}
