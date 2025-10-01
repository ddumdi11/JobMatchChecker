import React from 'react';
import { Container, Typography, Paper } from '@mui/material';

function Settings() {
  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Einstellungen
      </Typography>
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="body1">
          Hier können Sie später die App-Einstellungen verwalten.
        </Typography>
      </Paper>
    </Container>
  );
}

export default Settings;
