import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Typography,
  Alert,
  CircularProgress
} from '@mui/material';
import type { JobStatus } from '../../shared/types';
import { JOB_STATUS_DEFINITIONS, getJobStatusDefinition } from '../../shared/jobStatus';
import { formatBulkStatusResult, formatJobCount } from '../utils/jobListFilter';

interface BulkStatusDialogProps {
  open: boolean;
  /** Beim Öffnen festgehaltene, sichtbare Auswahl. */
  jobIds: number[];
  /** Ausgewählt, aber durch Filter ausgeblendet – werden NICHT geändert. */
  hiddenCount: number;
  onClose: () => void;
  /** Nach erfolgreicher Änderung (Snackbar, Liste neu laden). */
  onUpdated: (message: string) => void;
}

/**
 * Status mehrerer Jobs auf einmal setzen: Ziel-Status wählen, Anzahl bestätigen.
 * Löscht nichts; die Änderung läuft im Main-Prozess in einer Transaktion.
 */
export default function BulkStatusDialog({ open, jobIds, hiddenCount, onClose, onUpdated }: BulkStatusDialogProps) {
  const [status, setStatus] = useState<JobStatus | ''>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bei jedem Öffnen ohne Vorauswahl starten (kein „klebender" Ziel-Status)
  useEffect(() => {
    if (!open) return;
    setStatus('');
    setError(null);
    setSaving(false);
  }, [open]);

  const label = status ? getJobStatusDefinition(status)?.label ?? status : '';

  const handleClose = () => {
    if (!saving) onClose();
  };

  const handleConfirm = async () => {
    if (!status) return;
    setSaving(true);
    setError(null);
    try {
      const result = await window.api.bulkUpdateJobStatus(jobIds, status);
      onUpdated(formatBulkStatusResult(result, label));
    } catch (err) {
      console.error('Bulk status update failed:', err);
      setError('Die Status-Änderung ist fehlgeschlagen. Es wurde kein Job geändert.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} aria-labelledby="bulk-status-title" fullWidth maxWidth="xs">
      <DialogTitle id="bulk-status-title">Status setzen</DialogTitle>
      <DialogContent>
        <FormControl fullWidth sx={{ mt: 1 }} disabled={saving}>
          <InputLabel id="bulk-status-label">Neuer Status</InputLabel>
          <Select
            labelId="bulk-status-label"
            label="Neuer Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as JobStatus)}
          >
            {JOB_STATUS_DEFINITIONS.map(def => (
              <MenuItem key={def.value} value={def.value}>
                <Chip label={def.label} color={def.color} size="small" sx={{ cursor: 'pointer' }} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Typography sx={{ mt: 2 }}>
          {status
            ? `${formatJobCount(jobIds.length)} auf „${label}“ setzen?`
            : `${formatJobCount(jobIds.length)} ausgewählt. Bitte den neuen Status wählen.`}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Es wird nichts gelöscht, alle Daten bleiben erhalten.
        </Typography>

        {hiddenCount > 0 && (
          <Alert severity="info" sx={{ mt: 2 }}>
            {hiddenCount === 1
              ? '1 weiterer ausgewählter Job ist durch die Filter ausgeblendet und bleibt unverändert.'
              : `${hiddenCount} weitere ausgewählte Jobs sind durch die Filter ausgeblendet und bleiben unverändert.`}
          </Alert>
        )}
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>Abbrechen</Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={!status || saving || jobIds.length === 0}
          startIcon={saving ? <CircularProgress size={18} /> : undefined}
        >
          Status setzen
        </Button>
      </DialogActions>
    </Dialog>
  );
}
