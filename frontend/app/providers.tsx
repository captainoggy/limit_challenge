'use client';

import {
  AppBar,
  Box,
  ButtonBase,
  Container,
  CssBaseline,
  ThemeProvider,
  Toolbar,
  Typography,
  createTheme,
} from '@mui/material';
import { usePathname, useRouter } from 'next/navigation';
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
  const router = useRouter();
  const pathname = usePathname();

  // Home is /submissions. Clicking the logo or the "Submissions" nav link
  // should always drop filters, pagination, and sort — i.e., take the user
  // to a *fresh* list. On any other route, it's just a normal navigation.
  const goHome = () => {
    if (pathname === '/submissions') {
      router.replace('/submissions', { scroll: false });
    } else {
      router.push('/submissions');
    }
  };

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
            <ButtonBase
              onClick={goHome}
              aria-label="Go to submissions home"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                borderRadius: 1,
                px: 0.5,
                py: 0.5,
              }}
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
            </ButtonBase>
            <Box sx={{ flex: 1 }} />
            <ButtonBase
              onClick={goHome}
              sx={{
                fontSize: 14,
                fontWeight: 500,
                color: 'text.primary',
                borderRadius: 1,
                px: 1,
                py: 0.5,
              }}
            >
              Submissions
            </ButtonBase>
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
