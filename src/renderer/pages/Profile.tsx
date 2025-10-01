import React from 'react';
import { Container, Typography, Paper } from '@mui/material';

function Profile() {
  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Mein Profil
      </Typography>
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="body1">
          Hier können Sie später Ihr Profil bearbeiten.
        </Typography>
      </Paper>
    </Container>
  );
}

export default Profile;
