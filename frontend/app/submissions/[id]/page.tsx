'use client';

import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Grid,
  Link as MuiLink,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { useSubmissionDetail } from '@/lib/hooks/useSubmissions';
import {
  PRIORITY_META,
  STATUS_META,
  formatDate,
  formatDateTime,
  formatRelative,
} from '@/lib/formatters';
import type { Contact, Document, NoteDetail } from '@/lib/types';

export default function SubmissionDetailPage() {
  const params = useParams<{ id: string }>();
  const submissionId = params?.id ?? '';
  const detailQuery = useSubmissionDetail(submissionId);
  const submission = detailQuery.data;

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      <Stack spacing={3}>
        <Box>
          <MuiLink component={Link} href="/submissions" underline="hover" variant="body2">
            ← Back to submissions
          </MuiLink>
        </Box>

        {detailQuery.isError ? (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={() => detailQuery.refetch()}>
                Retry
              </Button>
            }
          >
            Could not load this submission. It may have been removed, or the API is unreachable.
          </Alert>
        ) : detailQuery.isLoading || !submission ? (
          <DetailSkeleton />
        ) : (
          <>
            <Card variant="outlined">
              <CardContent>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={2}
                  alignItems={{ md: 'flex-start' }}
                  justifyContent="space-between"
                >
                  <Box>
                    <Typography variant="overline" color="text.secondary">
                      Submission #{submission.id}
                    </Typography>
                    <Typography variant="h4" component="h1" fontWeight={600}>
                      {submission.company.legalName}
                    </Typography>
                    <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                      {[submission.company.industry, submission.company.headquartersCity]
                        .filter(Boolean)
                        .join(' · ') || 'Company details unavailable'}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Chip
                      label={STATUS_META[submission.status].label}
                      color={STATUS_META[submission.status].color}
                      variant="outlined"
                    />
                    <Chip
                      label={`${PRIORITY_META[submission.priority].label} priority`}
                      color={PRIORITY_META[submission.priority].color}
                    />
                  </Stack>
                </Stack>

                <Divider sx={{ my: 3 }} />

                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Fact label="Broker" value={submission.broker.name}>
                      {submission.broker.primaryContactEmail}
                    </Fact>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Fact label="Owner" value={submission.owner.fullName}>
                      {submission.owner.email}
                    </Fact>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Fact label="Created" value={formatDate(submission.createdAt)}>
                      {formatRelative(submission.createdAt)}
                    </Fact>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Fact label="Last updated" value={formatDate(submission.updatedAt)}>
                      {formatRelative(submission.updatedAt)}
                    </Fact>
                  </Grid>
                </Grid>

                {submission.summary ? (
                  <>
                    <Divider sx={{ my: 3 }} />
                    <Typography variant="overline" color="text.secondary">
                      Summary
                    </Typography>
                    <Typography sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
                      {submission.summary}
                    </Typography>
                  </>
                ) : null}
              </CardContent>
            </Card>

            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 7 }}>
                <Stack spacing={3}>
                  <ContactsCard contacts={submission.contacts} />
                  <DocumentsCard documents={submission.documents} />
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, md: 5 }}>
                <NotesCard notes={submission.notes} />
              </Grid>
            </Grid>
          </>
        )}
      </Stack>
    </Container>
  );
}

function Fact({
  label,
  value,
  children,
}: {
  label: string;
  value: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <Box>
      <Typography variant="overline" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body1" fontWeight={500}>
        {value || '—'}
      </Typography>
      {children ? (
        <Typography variant="caption" color="text.secondary">
          {children}
        </Typography>
      ) : null}
    </Box>
  );
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
      <Typography variant="h6" fontWeight={600}>
        {title}
      </Typography>
      <Chip size="small" label={count} />
    </Stack>
  );
}

function ContactsCard({ contacts }: { contacts: Contact[] }) {
  return (
    <Card variant="outlined">
      <CardContent>
        <SectionHeader title="Contacts" count={contacts.length} />
        {contacts.length === 0 ? (
          <EmptySection text="No contacts linked to this submission yet." />
        ) : (
          <Stack divider={<Divider flexItem />} spacing={0}>
            {contacts.map((contact) => (
              <Box key={contact.id} sx={{ py: 1.5 }}>
                <Typography variant="body1" fontWeight={500}>
                  {contact.name}
                </Typography>
                {contact.role ? (
                  <Typography variant="body2" color="text.secondary">
                    {contact.role}
                  </Typography>
                ) : null}
                <Stack direction="row" spacing={2} sx={{ mt: 0.5 }} flexWrap="wrap">
                  {contact.email ? (
                    <MuiLink href={`mailto:${contact.email}`} variant="body2">
                      {contact.email}
                    </MuiLink>
                  ) : null}
                  {contact.phone ? (
                    <Typography variant="body2" color="text.secondary">
                      {contact.phone}
                    </Typography>
                  ) : null}
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

function DocumentsCard({ documents }: { documents: Document[] }) {
  return (
    <Card variant="outlined">
      <CardContent>
        <SectionHeader title="Documents" count={documents.length} />
        {documents.length === 0 ? (
          <EmptySection text="No documents uploaded yet." />
        ) : (
          <Stack divider={<Divider flexItem />} spacing={0}>
            {documents.map((doc) => (
              <Box
                key={doc.id}
                sx={{
                  py: 1.5,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body1" fontWeight={500} noWrap>
                    {doc.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {doc.docType} · uploaded {formatDate(doc.uploadedAt)}
                  </Typography>
                </Box>
                {doc.fileUrl ? (
                  <Button
                    size="small"
                    variant="outlined"
                    component="a"
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Open
                  </Button>
                ) : null}
              </Box>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

function NotesCard({ notes }: { notes: NoteDetail[] }) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <SectionHeader title="Notes" count={notes.length} />
        {notes.length === 0 ? (
          <EmptySection text="No notes recorded yet." />
        ) : (
          <Stack spacing={2.5}>
            {notes.map((note) => (
              <Stack key={note.id} direction="row" spacing={1.5} alignItems="flex-start">
                <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32, fontSize: 14 }}>
                  {initials(note.authorName)}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="baseline" flexWrap="wrap">
                    <Typography variant="body2" fontWeight={600}>
                      {note.authorName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDateTime(note.createdAt)}
                    </Typography>
                  </Stack>
                  <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                    {note.body}
                  </Typography>
                </Box>
              </Stack>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

function EmptySection({ text }: { text: string }) {
  return (
    <Paper variant="outlined" sx={{ py: 3, textAlign: 'center', bgcolor: 'background.default' }}>
      <Typography variant="body2" color="text.secondary">
        {text}
      </Typography>
    </Paper>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function DetailSkeleton() {
  return (
    <Stack spacing={3}>
      <Card variant="outlined">
        <CardContent>
          <Skeleton variant="text" width={140} />
          <Skeleton variant="text" width="60%" height={48} />
          <Skeleton variant="text" width="40%" />
          <Divider sx={{ my: 3 }} />
          <Grid container spacing={3}>
            {[0, 1, 2, 3].map((i) => (
              <Grid key={i} size={{ xs: 12, sm: 6, md: 3 }}>
                <Skeleton variant="text" width={80} />
                <Skeleton variant="text" width="80%" />
                <Skeleton variant="text" width="60%" />
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Skeleton variant="rounded" height={180} />
          <Box sx={{ mt: 3 }}>
            <Skeleton variant="rounded" height={180} />
          </Box>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <Skeleton variant="rounded" height={380} />
        </Grid>
      </Grid>
    </Stack>
  );
}
