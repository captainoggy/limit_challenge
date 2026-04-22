'use client';

import {
  AppBar,
  Box,
  Container,
  CssBaseline,
  Link as MuiLink,
  ThemeProvider,
  Toolbar,
  Typography,
  createTheme,
} from '@mui/material';
import Link from 'next/link';
import { PropsWithChildren, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function useTheme() {
  return useMemo(
    () =>
      createTheme({
        palette: {
          primary: { main: '#0f62fe' },
          background: { default: '#f5f7fb' },
        },
        shape: { borderRadius: 10 },
        typography: {
          fontFamily:
            'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          h4: { fontWeight: 600 },
        },
        components: {
          MuiTableCell: {
            styleOverrides: {
              head: { fontWeight: 600, color: '#475569', backgroundColor: '#f8fafc' },
            },
          },
        },
      }),
    [],
  );
}

function AppShell({ children }: PropsWithChildren) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar
        position="sticky"
        elevation={0}
        color="inherit"
        sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}
      >
        <Container maxWidth="xl">
          <Toolbar disableGutters sx={{ gap: 2 }}>
            <MuiLink
              component={Link}
              href="/submissions"
              underline="none"
              color="inherit"
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: '8px',
                  bgcolor: 'primary.main',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'primary.contrastText',
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                ST
              </Box>
              <Typography variant="subtitle1" fontWeight={600}>
                Submission Tracker
              </Typography>
            </MuiLink>
            <Box sx={{ flex: 1 }} />
            <MuiLink
              component={Link}
              href="/submissions"
              underline="none"
              color="text.primary"
              sx={{ fontSize: 14, fontWeight: 500 }}
            >
              Submissions
            </MuiLink>
          </Toolbar>
        </Container>
      </AppBar>
      <Box component="main" sx={{ flex: 1, bgcolor: 'background.default' }}>
        {children}
      </Box>
    </Box>
  );
}

export default function Providers({ children }: PropsWithChildren) {
  const theme = useTheme();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AppShell>{children}</AppShell>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
