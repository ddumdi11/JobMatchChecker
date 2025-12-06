import React from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import { Error as ErrorIcon, Refresh as RefreshIcon } from '@mui/icons-material';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global ErrorBoundary component that catches React errors
 * and displays a user-friendly error message with recovery options.
 */
class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '60vh',
            p: 4
          }}
        >
          <Paper sx={{ p: 4, textAlign: 'center', maxWidth: 500 }}>
            <ErrorIcon color="error" sx={{ fontSize: 80, mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              Etwas ist schiefgelaufen
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut.
            </Typography>
            {this.state.error && (
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  mb: 3,
                  bgcolor: 'grey.100',
                  textAlign: 'left',
                  overflow: 'auto',
                  maxHeight: 150
                }}
              >
                <Typography variant="caption" component="pre" sx={{ fontFamily: 'monospace' }}>
                  {this.state.error.message}
                </Typography>
              </Paper>
            )}
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
              <Button
                variant="contained"
                startIcon={<RefreshIcon />}
                onClick={this.handleReload}
              >
                Neu laden
              </Button>
              <Button
                variant="outlined"
                onClick={this.handleReset}
              >
                Erneut versuchen
              </Button>
            </Box>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
