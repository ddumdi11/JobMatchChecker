import { useState, useEffect } from 'react';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// Import layout
import { Layout } from './components/Layout';

// Import components
import FirstRunDialog from './components/FirstRunDialog';
import ErrorBoundary from './components/ErrorBoundary';

// Import pages
import Dashboard from './pages/Dashboard';
import JobDetail from './pages/JobDetail';
import JobList from './pages/JobList';
import JobAdd from './pages/JobAdd';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Import from './pages/Import';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

// Create Hash Router with Data Router API (required for useBlocker)
// Uses HashRouter for Electron compatibility (file:// protocol)
const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <Dashboard />,
      },
      {
        path: 'profile',
        element: <Profile />,
      },
      {
        path: 'jobs',
        element: <JobList />,
      },
      {
        path: 'jobs/add',
        element: <JobAdd />,
      },
      {
        path: 'jobs/:id',
        element: <JobDetail />,
      },
      {
        path: 'jobs/:id/edit',
        element: <JobAdd />,
      },
      {
        path: 'settings',
        element: <Settings />,
      },
      {
        path: 'import',
        element: <Import />,
      },
    ],
  },
]);

function App() {
  const [showFirstRun, setShowFirstRun] = useState(false);
  const [isCheckingProfile, setIsCheckingProfile] = useState(true);

  // Check if this is the first run
  useEffect(() => {
    checkFirstRun();
  }, []);

  const checkFirstRun = async () => {
    try {
      const profile = await window.api.getProfile();
      if (!profile || !profile.id) {
        // No profile exists, show first-run dialog
        setShowFirstRun(true);
      }
    } catch (err) {
      // Error loading profile (likely doesn't exist), show first-run dialog
      setShowFirstRun(true);
    } finally {
      setIsCheckingProfile(false);
    }
  };

  const handleFirstRunComplete = () => {
    setShowFirstRun(false);
  };

  if (isCheckingProfile) {
    // Show nothing while checking (or could show a loading spinner)
    return null;
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary>
        <RouterProvider router={router} />
        <FirstRunDialog open={showFirstRun} onComplete={handleFirstRunComplete} />
      </ErrorBoundary>
    </ThemeProvider>
  );
}

export default App;
