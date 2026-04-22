'use client';

import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  FormControlLabel,
  LinearProgress,
  MenuItem,
  Pagination,
  Paper,
  Skeleton,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';

import { useBrokerOptions } from '@/lib/hooks/useBrokerOptions';
import { DEFAULT_PAGE_SIZE, useSubmissionsList } from '@/lib/hooks/useSubmissions';
import { PRIORITY_META, STATUS_META, formatDate, formatRelative } from '@/lib/formatters';
import type { SubmissionListItem, SubmissionListQuery, SubmissionStatus } from '@/lib/types';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

const STATUS_OPTIONS: { label: string; value: SubmissionStatus | '' }[] = [
  { label: 'All statuses', value: '' },
  { label: 'New', value: 'new' },
  { label: 'In Review', value: 'in_review' },
  { label: 'Closed', value: 'closed' },
  { label: 'Lost', value: 'lost' },
];

/**
 * Columns in the submissions table. `sortKey` is the field name the backend
 * whitelists for `?ordering=`; `null` means the column is displayed but not
 * sortable (Latest note — derived from a subquery, not worth the index cost).
 */
type SortDirection = 'asc' | 'desc';
const COLUMNS = [
  { id: 'company', label: 'Company', sortKey: 'company__legal_name', align: 'left' as const },
  { id: 'broker', label: 'Broker', sortKey: 'broker__name', align: 'left' as const },
  { id: 'owner', label: 'Owner', sortKey: 'owner__full_name', align: 'left' as const },
  { id: 'status', label: 'Status', sortKey: 'status', align: 'left' as const },
  { id: 'priority', label: 'Priority', sortKey: 'priority', align: 'left' as const },
  { id: 'docs', label: 'Docs', sortKey: 'document_count', align: 'right' as const },
  { id: 'notes', label: 'Notes', sortKey: 'note_count', align: 'right' as const },
  { id: 'latestNote', label: 'Latest note', sortKey: null, align: 'left' as const },
  { id: 'created', label: 'Created', sortKey: 'created_at', align: 'left' as const },
] as const;

const DEFAULT_ORDERING = '-created_at';

/** Parse `?ordering=` into { key, direction }. Leading `-` means descending. */
function parseOrdering(raw: string | null): { key: string; direction: SortDirection } {
  const value = raw ?? DEFAULT_ORDERING;
  if (value.startsWith('-')) return { key: value.slice(1), direction: 'desc' };
  return { key: value, direction: 'asc' };
}

function parseBool(raw: string | null): boolean | undefined {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return undefined;
}

function useDebounced<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/**
 * Render's free tier spins the backend down after ~15 min of inactivity,
 * and the first request afterwards takes about 55 seconds to warm up.
 * If a load is still running after `QUIET_SECONDS`, we surface a banner
 * with a live countdown. If the load is still running when the countdown
 * hits zero, we hard-reload so React Query doesn't sit on a stale pending
 * promise if the waking request itself timed out.
 */
const COLD_START_SECONDS = 55;
const QUIET_SECONDS = 3;

function useColdStartCountdown(isLoading: boolean) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    // A wall-clock counter is the canonical case where set-state-in-effect
    // is intended behavior: reset when the subject transitions off, tick
    // while it is on. The lint rule targets derivation-from-props cases,
    // which this is not.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!isLoading) {
      setElapsed(0);
      return;
    }
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isLoading]);

  useEffect(() => {
    if (isLoading && elapsed >= COLD_START_SECONDS) {
      window.location.reload();
    }
  }, [isLoading, elapsed]);

  return {
    showBanner: isLoading && elapsed >= QUIET_SECONDS,
    secondsRemaining: Math.max(0, COLD_START_SECONDS - elapsed),
  };
}

export default function SubmissionsPage() {
  return (
    <Suspense fallback={<SubmissionsFallback />}>
      <SubmissionsWorkspace />
    </Suspense>
  );
}

function SubmissionsFallback() {
  return (
    <Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 } }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" component="h1" fontWeight={600}>
            Submissions
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Loading workspace…
          </Typography>
        </Box>
        <SubmissionsTableSkeleton />
      </Stack>
    </Container>
  );
}

function SubmissionsWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL is the source of truth for every filter + page.
  const urlStatus = (searchParams.get('status') ?? '') as SubmissionStatus | '';
  const urlBrokerId = searchParams.get('brokerId') ?? '';
  const urlCompanySearch = searchParams.get('companySearch') ?? '';
  const urlCreatedFrom = searchParams.get('createdFrom') ?? '';
  const urlCreatedTo = searchParams.get('createdTo') ?? '';
  // String-compare is safe because both are ISO-ordered YYYY-MM-DD from the
  // native date input. If one side is empty, the range can't be invalid yet.
  const dateRangeInvalid = Boolean(urlCreatedFrom && urlCreatedTo && urlCreatedFrom > urlCreatedTo);
  const urlHasDocuments = parseBool(searchParams.get('hasDocuments'));
  const urlHasNotes = parseBool(searchParams.get('hasNotes'));
  const urlPage = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const urlPageSize = (() => {
    const raw = Number(searchParams.get('pageSize'));
    return PAGE_SIZE_OPTIONS.includes(raw as (typeof PAGE_SIZE_OPTIONS)[number])
      ? raw
      : DEFAULT_PAGE_SIZE;
  })();
  const urlOrdering = searchParams.get('ordering');
  const sort = parseOrdering(urlOrdering);

  // Local state for the free-text company search so typing feels snappy and we
  // debounce URL updates (which drive the query).
  const [companyInput, setCompanyInput] = useState(urlCompanySearch);
  useEffect(() => {
    setCompanyInput(urlCompanySearch);
  }, [urlCompanySearch]);
  const debouncedCompany = useDebounced(companyInput, 300);

  const updateParams = useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === '') next.delete(key);
        else next.set(key, value);
      }
      // Any filter change resets pagination.
      if (!('page' in changes)) next.delete('page');
      const qs = next.toString();
      router.replace(qs ? `/submissions?${qs}` : '/submissions', { scroll: false });
    },
    [router, searchParams],
  );

  // Keep URL's companySearch in sync with the debounced input.
  useEffect(() => {
    if (debouncedCompany === urlCompanySearch) return;
    updateParams({ companySearch: debouncedCompany || null });
  }, [debouncedCompany, urlCompanySearch, updateParams]);

  const query: SubmissionListQuery = useMemo(
    () => ({
      status: urlStatus || undefined,
      brokerId: urlBrokerId || undefined,
      companySearch: urlCompanySearch || undefined,
      createdFrom: urlCreatedFrom ? `${urlCreatedFrom}T00:00:00Z` : undefined,
      createdTo: urlCreatedTo ? `${urlCreatedTo}T23:59:59Z` : undefined,
      hasDocuments: urlHasDocuments,
      hasNotes: urlHasNotes,
      page: urlPage,
      pageSize: urlPageSize,
      ordering: urlOrdering || undefined,
    }),
    [
      urlStatus,
      urlBrokerId,
      urlCompanySearch,
      urlCreatedFrom,
      urlCreatedTo,
      urlHasDocuments,
      urlHasNotes,
      urlPage,
      urlPageSize,
      urlOrdering,
    ],
  );

  /** Click handler for a column header: toggle asc -> desc -> clear (back to default). */
  const onSortChange = (sortKey: string) => {
    if (sort.key !== sortKey) {
      updateParams({ ordering: sortKey, page: null });
      return;
    }
    if (sort.direction === 'asc') {
      updateParams({ ordering: `-${sortKey}`, page: null });
      return;
    }
    updateParams({ ordering: null, page: null });
  };

  const submissionsQuery = useSubmissionsList(query, !dateRangeInvalid);
  const brokerQuery = useBrokerOptions();
  const coldStart = useColdStartCountdown(submissionsQuery.isLoading);

  const totalCount = submissionsQuery.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / urlPageSize));
  const rows = submissionsQuery.data?.results ?? [];

  const activeFilterCount = [
    urlStatus,
    urlBrokerId,
    urlCompanySearch,
    urlCreatedFrom,
    urlCreatedTo,
    urlHasDocuments !== undefined,
    urlHasNotes !== undefined,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setCompanyInput('');
    router.replace('/submissions', { scroll: false });
  };

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 } }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" component="h1" fontWeight={600}>
            Submissions
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Review broker-submitted opportunities, filter by context, and open any record for the
            full story.
          </Typography>
        </Box>

        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={2}
                alignItems={{ md: 'center' }}
              >
                <TextField
                  label="Company search"
                  placeholder="Name, industry, or city"
                  value={companyInput}
                  onChange={(e) => setCompanyInput(e.target.value)}
                  sx={{ flex: 2 }}
                  size="small"
                />
                <TextField
                  select
                  label="Status"
                  value={urlStatus}
                  onChange={(e) => updateParams({ status: e.target.value || null })}
                  sx={{ flex: 1, minWidth: 160 }}
                  size="small"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <MenuItem key={option.value || 'all'} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Broker"
                  value={urlBrokerId}
                  onChange={(e) => updateParams({ brokerId: e.target.value || null })}
                  sx={{ flex: 1, minWidth: 200 }}
                  size="small"
                  disabled={brokerQuery.isLoading}
                >
                  <MenuItem value="">All brokers</MenuItem>
                  {brokerQuery.data?.map((broker) => (
                    <MenuItem key={broker.id} value={String(broker.id)}>
                      {broker.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>

              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={2}
                alignItems={{ md: 'center' }}
                justifyContent="space-between"
              >
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    type="date"
                    label="Created from"
                    value={urlCreatedFrom}
                    onChange={(e) => updateParams({ createdFrom: e.target.value || null })}
                    size="small"
                    InputLabelProps={{ shrink: true }}
                    inputProps={{ max: urlCreatedTo || undefined }}
                    error={dateRangeInvalid}
                    helperText={dateRangeInvalid ? 'Must be on or before "Created to".' : undefined}
                  />
                  <TextField
                    type="date"
                    label="Created to"
                    value={urlCreatedTo}
                    onChange={(e) => updateParams({ createdTo: e.target.value || null })}
                    size="small"
                    InputLabelProps={{ shrink: true }}
                    inputProps={{ min: urlCreatedFrom || undefined }}
                    error={dateRangeInvalid}
                    helperText={
                      dateRangeInvalid ? 'Must be on or after "Created from".' : undefined
                    }
                  />
                </Stack>
                <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={urlHasDocuments === true}
                        onChange={(e) =>
                          updateParams({ hasDocuments: e.target.checked ? 'true' : null })
                        }
                      />
                    }
                    label="Has documents"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={urlHasNotes === true}
                        onChange={(e) =>
                          updateParams({ hasNotes: e.target.checked ? 'true' : null })
                        }
                      />
                    }
                    label="Has notes"
                  />
                  <Button
                    size="small"
                    variant="text"
                    onClick={clearFilters}
                    disabled={activeFilterCount === 0}
                  >
                    Clear filters
                    {activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                  </Button>
                </Stack>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Box>
          <ResultsHeader totalCount={totalCount} page={urlPage} pageSize={urlPageSize} />
          <LinearProgress
            sx={{
              mt: 1,
              height: 2,
              borderRadius: 1,
              visibility:
                submissionsQuery.isFetching && !submissionsQuery.isLoading ? 'visible' : 'hidden',
            }}
          />
        </Box>

        {submissionsQuery.isError ? (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={() => submissionsQuery.refetch()}>
                Retry
              </Button>
            }
          >
            Failed to load submissions. Check that the API is running at{' '}
            {process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000/api'}.
          </Alert>
        ) : submissionsQuery.isLoading ? (
          <Stack spacing={2}>
            {coldStart.showBanner ? (
              <Alert severity="info" icon={<CircularProgress size={20} thickness={5} />}>
                <AlertTitle>Waking up the backend</AlertTitle>
                The API is hosted on Render&apos;s free tier, which spins down after ~15 min of
                inactivity. First load takes about {COLD_START_SECONDS} seconds. We&apos;ll refresh
                automatically in <strong>{coldStart.secondsRemaining}s</strong>.
              </Alert>
            ) : null}
            <SubmissionsTableSkeleton />
          </Stack>
        ) : rows.length === 0 ? (
          <EmptyState onClear={activeFilterCount > 0 ? clearFilters : undefined} />
        ) : (
          <SubmissionsTable
            rows={rows}
            sort={sort}
            onSortChange={onSortChange}
            onRowClick={(id) => router.push(`/submissions/${id}`)}
          />
        )}

        {totalCount > 0 ? (
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            alignItems="center"
            justifyContent="space-between"
            pt={1}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" color="text.secondary">
                Rows per page
              </Typography>
              <TextField
                select
                size="small"
                value={urlPageSize}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  updateParams({
                    pageSize: next === DEFAULT_PAGE_SIZE ? null : String(next),
                    page: null,
                  });
                }}
                sx={{ minWidth: 88 }}
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <MenuItem key={size} value={size}>
                    {size}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
            <Pagination
              color="primary"
              count={totalPages}
              page={urlPage}
              onChange={(_, next) => updateParams({ page: next > 1 ? String(next) : null })}
              showFirstButton
              showLastButton
            />
          </Stack>
        ) : null}
      </Stack>
    </Container>
  );
}

function ResultsHeader({
  totalCount,
  page,
  pageSize,
}: {
  totalCount: number;
  page: number;
  pageSize: number;
}) {
  if (totalCount === 0) {
    return (
      <Typography color="text.secondary" variant="body2">
        0 submissions
      </Typography>
    );
  }
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);
  return (
    <Typography color="text.secondary" variant="body2">
      Showing {from}–{to} of {totalCount.toLocaleString()} submissions
    </Typography>
  );
}

function SubmissionsTable({
  rows,
  sort,
  onSortChange,
  onRowClick,
}: {
  rows: SubmissionListItem[];
  sort: { key: string; direction: SortDirection };
  onSortChange: (sortKey: string) => void;
  onRowClick: (id: number) => void;
}) {
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="medium">
        <TableHead>
          <TableRow>
            {COLUMNS.map((col) => {
              const isActive = col.sortKey !== null && sort.key === col.sortKey;
              return (
                <TableCell
                  key={col.id}
                  align={col.align}
                  sortDirection={isActive ? sort.direction : false}
                >
                  {col.sortKey ? (
                    <TableSortLabel
                      active={isActive}
                      direction={isActive ? sort.direction : 'asc'}
                      onClick={() => onSortChange(col.sortKey!)}
                      // Keep the arrow visible (faded) on inactive columns so
                      // users can see a column is sortable without hovering.
                      sx={{
                        '& .MuiTableSortLabel-icon': {
                          opacity: isActive ? 1 : 0.35,
                        },
                      }}
                    >
                      {col.label}
                    </TableSortLabel>
                  ) : (
                    col.label
                  )}
                </TableCell>
              );
            })}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.id}
              hover
              sx={{ cursor: 'pointer' }}
              onClick={() => onRowClick(row.id)}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onRowClick(row.id);
              }}
            >
              <TableCell>
                <Typography variant="body2" fontWeight={600}>
                  {row.company.legalName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {[row.company.industry, row.company.headquartersCity].filter(Boolean).join(' · ')}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2">{row.broker.name}</Typography>
                {row.broker.primaryContactEmail ? (
                  <Typography variant="caption" color="text.secondary">
                    {row.broker.primaryContactEmail}
                  </Typography>
                ) : null}
              </TableCell>
              <TableCell>
                <Typography variant="body2">{row.owner.fullName}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {row.owner.email}
                </Typography>
              </TableCell>
              <TableCell>
                <Chip
                  size="small"
                  variant="outlined"
                  label={STATUS_META[row.status].label}
                  color={STATUS_META[row.status].color}
                />
              </TableCell>
              <TableCell>
                <Chip
                  size="small"
                  label={PRIORITY_META[row.priority].label}
                  color={PRIORITY_META[row.priority].color}
                />
              </TableCell>
              <TableCell align="right">{row.documentCount}</TableCell>
              <TableCell align="right">{row.noteCount}</TableCell>
              <TableCell sx={{ maxWidth: 260 }}>
                {row.latestNote ? (
                  <Tooltip title={row.latestNote.bodyPreview} placement="top-start">
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        {row.latestNote.authorName} · {formatRelative(row.latestNote.createdAt)}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {row.latestNote.bodyPreview}
                      </Typography>
                    </Box>
                  </Tooltip>
                ) : (
                  <Typography variant="caption" color="text.disabled">
                    No notes yet
                  </Typography>
                )}
              </TableCell>
              <TableCell>
                <Typography variant="body2">{formatDate(row.createdAt)}</Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function SubmissionsTableSkeleton() {
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table>
        <TableHead>
          <TableRow>
            {COLUMNS.map((col) => (
              <TableCell key={col.id} align={col.align}>
                {col.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {Array.from({ length: 6 }).map((_, rowIndex) => (
            <TableRow key={rowIndex}>
              {COLUMNS.map((col) => (
                <TableCell key={col.id} align={col.align}>
                  <Skeleton variant="text" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function EmptyState({ onClear }: { onClear?: () => void }) {
  return (
    <Paper variant="outlined" sx={{ py: 6, textAlign: 'center' }}>
      <Typography variant="h6" gutterBottom>
        No submissions match these filters
      </Typography>
      <Typography color="text.secondary" sx={{ mb: onClear ? 2 : 0 }}>
        Try widening your search or clearing a filter to see more results.
      </Typography>
      {onClear ? (
        <Button variant="outlined" onClick={onClear}>
          Clear all filters
        </Button>
      ) : null}
    </Paper>
  );
}
