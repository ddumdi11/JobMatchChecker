import React from 'react';
import { Box, Container, Typography, Paper } from '@mui/material';

function Dashboard() {
  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h3" component="h1" gutterBottom>
        Job Match Checker
      </Typography>
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h5" gutterBottom>
          Willkommen!
        </Typography>
        <Typography variant="body1">
          Dies ist die Dashboard-Seite. Hier werden später alle Jobs angezeigt.
        </Typography>
      </Paper>
    </Container>
  );
}

export default Dashboard;
