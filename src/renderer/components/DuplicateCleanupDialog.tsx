import { useEffect, useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  Checkbox,
  FormControlLabel,
  Divider,
  CircularProgress,
  Alert,
  Link
} from '@mui/material';
import {
  Warning as WarningIcon,
  InfoOutlined as InfoIcon,
  ErrorOutline as ConflictIcon,
  DeleteSweep as DeleteSweepIcon
} from '@mui/icons-material';
import type { DuplicateScanResult, DuplicateGroup } from '../../shared/types';
import { formatGermanDate } from '../../shared/formatUtils';

interface DuplicateCleanupDialogProps {
  open: boolean;
  onClose: () => void;
  /** Wird nach erfolgreicher Löschung aufgerufen (Anzahl gelöschter Jobs). */
  onDeleted: (deleted: number) => void;
}

/**
 * Dialog zum Scannen und Bereinigen von Dubletten.
 * - Sichere Gruppen (identische URL): ältere Einträge vorausgewählt.
 * - Mögliche Gruppen (Titel+Firma): NICHT vorausgewählt.
 * Pro Gruppe bleibt der neueste; Löschung erst nach Bestätigung (inkl.
 * abhängiger Match-Ergebnisse via ON DELETE CASCADE).
 */
export default function DuplicateCleanupDialog({ open, onClose, onDeleted }: DuplicateCleanupDialogProps) {
  const [loading, setLoading] = useState(false);
  const [scan, setScan] = useState<DuplicateScanResult | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Beim Öffnen scannen und Vorauswahl (suggestDelete) übernehmen
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setScan(null);
    setSelected(new Set());
    setConfirming(false);

    (async () => {
      try {
        const result = await window.api.scanJobDuplicates();
        if (cancelled) return;
        setScan(result);
        const preselected = new Set<number>();
        for (const group of result.groups) {
          for (const entry of group.jobs) {
            if (entry.suggestDelete) preselected.add(entry.job.id);
          }
        }
        setSelected(preselected);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Dubletten-Scan fehlgeschlagen');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const toggle = (jobId: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  const deleteCount = selected.size;
  const hasGroups = !!scan && scan.groups.length > 0;

  const summary = useMemo(() => {
    if (!scan) return '';
    return `${scan.safeGroupCount} sichere · ${scan.conflictingGroupCount} widersprüchliche · ${scan.possibleGroupCount} mögliche Gruppen`;
  }, [scan]);

  const handleDeleteConfirmed = async () => {
    setDeleting(true);
    setError(null);
    try {
      const ids = Array.from(selected);
      const result = await window.api.deleteJobs(ids);
      onDeleted(result.deleted);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Löschen fehlgeschlagen');
      setConfirming(false);
    } finally {
      setDeleting(false);
    }
  };

  const renderGroup = (group: DuplicateGroup, index: number) => {
    const isSafe = group.kind === 'safe';
    const isConflicting = group.kind === 'conflicting';
    const chip = isSafe
      ? { icon: <WarningIcon />, color: 'warning' as const, label: 'Sicher' }
      : isConflicting
        ? { icon: <ConflictIcon />, color: 'error' as const, label: 'Widersprüchlich' }
        : { icon: <InfoIcon />, color: 'info' as const, label: 'Möglich' };

    return (
      <Box key={`${group.kind}-${group.key}-${index}`} sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Chip size="small" icon={chip.icon} color={chip.color} label={chip.label} />
          <Typography variant="body2" color="text.secondary">
            {group.reason}
          </Typography>
        </Box>

        {group.jobs.map(entry => {
          const job = entry.job;
          // In widersprüchlichen Gruppen sind es verschiedene Stellen – kein
          // "neuester bleibt": alle Einträge frei wählbar, nichts vorausgewählt.
          const showKeepMarker = entry.isNewest && !isConflicting;
          return (
            <Box
              key={job.id}
              sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, pl: 1, py: 0.5 }}
            >
              <FormControlLabel
                sx={{ m: 0, alignItems: 'flex-start' }}
                control={
                  <Checkbox
                    size="small"
                    checked={selected.has(job.id)}
                    disabled={showKeepMarker}
                    onChange={() => toggle(job.id)}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={showKeepMarker ? 'bold' : 'normal'}>
                      {job.title} – {job.company}
                      {showKeepMarker && (
                        <Chip
                          size="small"
                          label="bleibt (neuester)"
                          color="success"
                          variant="outlined"
                          sx={{ ml: 1, height: 20 }}
                        />
                      )}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      hinzugefügt am {formatGermanDate(job.createdAt)}
                      {job.matchScore !== null && job.matchScore !== undefined
                        ? ` · Score ${job.matchScore}`
                        : ''}
                    </Typography>
                    {job.url && (
                      <Typography variant="caption" component="div" sx={{ wordBreak: 'break-all' }}>
                        <Link href={job.url} target="_blank" rel="noopener noreferrer">
                          {job.url}
                        </Link>
                      </Typography>
                    )}
                  </Box>
                }
              />
            </Box>
          );
        })}
        <Divider sx={{ mt: 1 }} />
      </Box>
    );
  };

  return (
    <Dialog open={open} onClose={deleting ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <DeleteSweepIcon />
        Dubletten bereinigen
      </DialogTitle>
      <DialogContent dividers>
        {loading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 4, justifyContent: 'center' }}>
            <CircularProgress size={24} />
            <Typography>Bestand wird gescannt…</Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!loading && scan && !hasGroups && (
          <Alert severity="success">Keine Dubletten gefunden.</Alert>
        )}

        {!loading && hasGroups && (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {summary}. Bei sicheren/möglichen Gruppen bleibt der neueste Eintrag erhalten; markierte
              Einträge werden gelöscht. Sichere Dubletten sind vorausgewählt, mögliche und
              widersprüchliche nicht.
            </Typography>
            {scan!.conflictingGroupCount > 0 && (
              <Alert severity="warning" icon={<ConflictIcon />} sx={{ mb: 2 }}>
                <Typography variant="body2" fontWeight="bold">
                  Widersprüchliche Gruppen: identische URL bei unterschiedlichen Titeln
                </Typography>
                <Typography variant="body2">
                  Das deutet auf fehlerhafte Importdaten hin (verschiedene Stellen mit derselben
                  URL). Hier ist nichts vorausgewählt – bitte einzeln prüfen, bevor du löschst.
                </Typography>
              </Alert>
            )}
            {scan!.groups.map(renderGroup)}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between', px: 3, py: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {deleteCount > 0 ? `${deleteCount} zum Löschen ausgewählt` : 'Nichts ausgewählt'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={onClose} disabled={deleting}>
            {confirming ? 'Zurück' : 'Schließen'}
          </Button>
          {!confirming ? (
            <Button
              variant="contained"
              color="error"
              startIcon={<DeleteSweepIcon />}
              disabled={deleteCount === 0 || loading}
              onClick={() => setConfirming(true)}
            >
              {deleteCount > 0 ? `${deleteCount} löschen` : 'Löschen'}
            </Button>
          ) : (
            <Button
              variant="contained"
              color="error"
              startIcon={deleting ? <CircularProgress size={18} color="inherit" /> : <DeleteSweepIcon />}
              disabled={deleting}
              onClick={handleDeleteConfirmed}
            >
              {`Endgültig löschen (${deleteCount}) – inkl. Match-Ergebnisse`}
            </Button>
          )}
        </Box>
      </DialogActions>
    </Dialog>
  );
}
