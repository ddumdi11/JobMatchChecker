import React from 'react';
import { useParams } from 'react-router-dom';
import { Container, Typography, Paper } from '@mui/material';

function JobDetail() {
  const { id } = useParams<{ id: string }>();

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Job Details
      </Typography>
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="body1">
          Job ID: {id}
        </Typography>
      </Paper>
    </Container>
  );
}

export default JobDetail;
