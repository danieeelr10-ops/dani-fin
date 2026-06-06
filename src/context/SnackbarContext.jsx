import { createContext, useContext, useState, useCallback } from 'react';
import { Snackbar, Alert } from '@mui/material';

const SnackbarContext = createContext(null);

export function SnackbarProvider({ children }) {
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  const showToast = useCallback((message, severity = 'success') => {
    setSnack({ open: true, message, severity: severity === 'error' ? 'error' : 'success' });
  }, []);

  const handleClose = () => setSnack(prev => ({ ...prev, open: false }));

  return (
    <SnackbarContext.Provider value={{ showToast, showSnackbar: showToast }}>
      {children}
      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ bottom: '88px !important' }}
      >
        <Alert onClose={handleClose} severity={snack.severity} variant="filled" sx={{ width: '100%' }}>
          {snack.message}
        </Alert>
      </Snackbar>
    </SnackbarContext.Provider>
  );
}

export const useSnackbar = () => useContext(SnackbarContext);
