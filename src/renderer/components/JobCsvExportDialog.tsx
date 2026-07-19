import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  CircularProgress
} from '@mui/material';
import { Download as DownloadIcon } from '@mui/icons-material';

interface JobCsvExportDialogProps {
  open: boolean;
  onClose: () => void;
  /** Rückmeldung nach erfolgreichem Export (für Snackbar o. ä.). */
  onExported: (message: string, severity: 'success' | 'error') => void;
}

/** Lokales ISO-Datum (YYYY-MM-DD) – passend zu den <input type="date">-Feldern. */
function localIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 6); // letzte 7 Tage inklusive heute
  return { from: localIso(from), to: localIso(to) };
}

/**
 * Dialog für den CSV-Export von Jobs über einen Datumsbereich ("hinzugefügt am").
 * Default: letzte 7 Tage. Der eigentliche Speichern-Dialog kommt aus dem
 * Main-Prozess (exportService.exportJobsCsv).
 */
export default function JobCsvExportDialog({ open, onClose, onExported }: JobCsvExportDialogProps) {
  const initial = defaultRange();
  const [dateFrom, setDateFrom] = useState(initial.from);
  const [dateTo, setDateTo] = useState(initial.to);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rangeInvalid = !!dateFrom && !!dateTo && dateFrom > dateTo;

  const handleExport = async () => {
    if (rangeInvalid) {
      setError('Das Von-Datum liegt nach dem Bis-Datum.');
      return;
    }
    setExporting(true);
    setError(null);
    try {
      const res = await window.api.exportJobsCsv({
        dateFrom: dateFrom || null,
        dateTo: dateTo || null
      });
      if (res.success) {
        onExported(`${res.count ?? 0} Job(s) als CSV exportiert.`, 'success');
        onClose();
      } else if (res.error && res.error !== 'Export abgebrochen') {
        setError(res.error);
      }
      // "Export abgebrochen" (Speichern-Dialog geschlossen) → still, Dialog offen lassen
    } catch (e: any) {
      setError(e?.message || 'Export fehlgeschlagen');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onClose={exporting ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <DownloadIcon />
        Jobs als CSV exportieren
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Exportiert alle Jobs, die im gewählten Zeitraum hinzugefügt wurden (Grenzen inklusive).
        </Typography>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            label="Von (hinzugefügt am)"
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Bis (hinzugefügt am)"
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />
        </Box>

        {rangeInvalid && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Das Von-Datum liegt nach dem Bis-Datum.
          </Alert>
        )}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={exporting}>
          Abbrechen
        </Button>
        <Button
          variant="contained"
          startIcon={exporting ? <CircularProgress size={18} color="inherit" /> : <DownloadIcon />}
          onClick={handleExport}
          disabled={exporting || rangeInvalid}
        >
          Exportieren
        </Button>
      </DialogActions>
    </Dialog>
  );
}
