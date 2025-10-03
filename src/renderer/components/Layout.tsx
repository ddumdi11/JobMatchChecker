import React, { createContext, useContext } from 'react';
import { Outlet } from 'react-router-dom';
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button
} from '@mui/material';
import { Sidebar } from './Sidebar';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';

export interface UnsavedChangesContextValue {
  isDirty: boolean;
  setIsDirty: (dirty: boolean) => void;
  onSave?: () => Promise<void>;
  setOnSave: (callback: (() => Promise<void>) | undefined) => void;
}

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(null);

export const useUnsavedChangesContext = () => {
  const context = useContext(UnsavedChangesContext);
  if (!context) {
    throw new Error('useUnsavedChangesContext must be used within Layout');
  }
  return context;
};

export const Layout: React.FC = () => {
  const [isDirty, setIsDirty] = React.useState(false);
  const [onSave, setOnSave] = React.useState<(() => Promise<void>) | undefined>(() => undefined);

  const { blocker, handleSave, handleDiscard, handleCancel } = useUnsavedChanges(isDirty, onSave);

  const contextValue: UnsavedChangesContextValue = {
    isDirty,
    setIsDirty,
    onSave,
    setOnSave: (callback) => setOnSave(() => callback)
  };

  const isBlocked = blocker.state === 'blocked';

  return (
    <UnsavedChangesContext.Provider value={contextValue}>
      <Box sx={{ display: 'flex' }}>
        <Sidebar />
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: 3
          }}
        >
          <Outlet />
        </Box>
      </Box>

      {/* Unsaved Changes Dialog */}
      <Dialog open={isBlocked} onClose={handleCancel}>
        <DialogTitle>Unsaved Changes</DialogTitle>
        <DialogContent>
          <DialogContentText>
            You have unsaved changes. Do you want to save them before leaving this page?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancel} color="secondary">
            Cancel
          </Button>
          <Button onClick={handleDiscard} color="error">
            Discard
          </Button>
          <Button onClick={handleSave} color="primary" variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </UnsavedChangesContext.Provider>
  );
};
