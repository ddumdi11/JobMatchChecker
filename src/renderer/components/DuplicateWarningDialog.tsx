import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Alert,
  Box,
  Typography,
  Link
} from '@mui/material';
import { Warning as WarningIcon } from '@mui/icons-material';
import type { JobDuplicateMatch } from '../../shared/types';
import { formatGermanDate, formatScore } from '../../shared/formatUtils';

interface DuplicateWarningDialogProps {
  open: boolean;
  /** Sicherer Treffer (identische URL) – Auslöser der Blockade. */
  safeMatch: JobDuplicateMatch | null;
  /** Optionale mögliche Treffer (Titel+Firma) – nur informativ. */
  possibleMatches?: JobDuplicateMatch[];
  /** Beschriftung des Bestätigen-Buttons (kontextabhängig). */
  proceedLabel?: string;
  /** Kontextabhängige Rückfrage im Body (add/save vs. extract). */
  question?: string;
  onCancel: () => void;
  onProceed: () => void;
}

/**
 * Blockierender Hinweis-Dialog beim Hinzufügen eines Jobs, wenn ein sicherer
 * Dublettentreffer (identische URL) im Bestand existiert.
 */
export default function DuplicateWarningDialog({
  open,
  safeMatch,
  possibleMatches = [],
  proceedLabel = 'Trotzdem hinzufügen',
  question = 'Dieser Job scheint bereits im Bestand zu sein (identische URL). Möchtest du ihn trotzdem hinzufügen?',
  onCancel,
  onProceed
}: DuplicateWarningDialogProps) {
  const job = safeMatch?.job;

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WarningIcon color="warning" />
        Job bereits vorhanden
      </DialogTitle>
      <DialogContent>
        {job && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2" fontWeight="bold">
              {job.title} – {job.company}
            </Typography>
            <Typography variant="body2">
              hinzugefügt am {formatGermanDate(job.createdAt)}, Score {formatScore(job.matchScore)}
            </Typography>
            {job.url && (
              <Typography variant="caption" component="div" sx={{ mt: 0.5, wordBreak: 'break-all' }}>
                <Link href={job.url} target="_blank" rel="noopener noreferrer">
                  {job.url}
                </Link>
              </Typography>
            )}
          </Alert>
        )}

        <DialogContentText>{question}</DialogContentText>

        {possibleMatches.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Zusätzlich mögliche Dubletten (Titel + Firma):
            </Typography>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {possibleMatches.map(m => (
                <li key={m.job.id}>
                  <Typography variant="body2">
                    {m.job.title} – {m.job.company} (hinzugefügt am {formatGermanDate(m.job.createdAt)})
                  </Typography>
                </li>
              ))}
            </ul>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Abbrechen</Button>
        <Button onClick={onProceed} variant="contained" color="warning">
          {proceedLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
