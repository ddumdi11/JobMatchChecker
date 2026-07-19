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
  /** Titel des Dialogs (kontextabhängig). */
  title?: string;
  /** Haupt-Treffer, die im Warnhinweis hervorgehoben werden. */
  matches: JobDuplicateMatch[];
  /** Optionale mögliche Treffer (Titel+Firma) – nur informativ. */
  possibleMatches?: JobDuplicateMatch[];
  /** Beschriftung des Bestätigen-Buttons (kontextabhängig). */
  proceedLabel?: string;
  /** Kontextabhängige Rückfrage im Body. */
  question?: string;
  onCancel: () => void;
  onProceed: () => void;
}

/**
 * Hinweis-Dialog beim Hinzufügen/Analysieren eines Jobs, wenn ein oder mehrere
 * Treffer im Bestand existieren (identischer URL-Key). Bietet Abbrechen bzw.
 * Trotzdem-fortfahren an.
 */
export default function DuplicateWarningDialog({
  open,
  title = 'Job bereits vorhanden',
  matches,
  possibleMatches = [],
  proceedLabel = 'Trotzdem hinzufügen',
  question = 'Dieser Job scheint bereits im Bestand zu sein (identische URL und gleicher Titel). Möchtest du ihn trotzdem hinzufügen?',
  onCancel,
  onProceed
}: DuplicateWarningDialogProps) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WarningIcon color="warning" />
        {title}
      </DialogTitle>
      <DialogContent>
        {matches.map(m => (
          <Alert key={m.job.id} severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2" fontWeight="bold">
              {m.job.title} – {m.job.company}
            </Typography>
            <Typography variant="body2">
              hinzugefügt am {formatGermanDate(m.job.createdAt)}, Score {formatScore(m.job.matchScore)}
            </Typography>
            {m.job.url && (
              <Typography variant="caption" component="div" sx={{ mt: 0.5, wordBreak: 'break-all' }}>
                <Link href={m.job.url} target="_blank" rel="noopener noreferrer">
                  {m.job.url}
                </Link>
              </Typography>
            )}
          </Alert>
        ))}

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
