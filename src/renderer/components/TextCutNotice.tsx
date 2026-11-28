import { useState } from 'react';
import { Alert, Box, Button, Checkbox, Collapse, FormControlLabel, Typography } from '@mui/material';
import type { TextCutResolution } from '../../shared/types';

interface TextCutNoticeProps {
  text: string;
  cut: TextCutResolution;
  /** Im Formular: Schnitt an-/abwählen. Ohne Handler reine Anzeige (Detailansicht). */
  onToggle?: (apply: boolean) => void;
  /** Vom Formular: aktuell gefundener Schnitt, auch wenn er abgewählt ist. */
  proposedPosition?: number | null;
}

const fmt = (n: number) => n.toLocaleString('de-DE');

/**
 * Zeigt, wo Matching und Export den Volltext abschneiden (Rauschen am Ende).
 * Formular: Hinweis + Checkbox; Detailansicht: abgeschnittener Teil grau.
 */
export default function TextCutNotice({ text, cut, onToggle, proposedPosition }: TextCutNoticeProps) {
  const [showTail, setShowTail] = useState(false);
  const position = proposedPosition ?? cut.position;
  if (position === null || position === undefined) return null;

  const applied = cut.source !== 'disabled' && cut.position !== null;
  const tail = text.slice(position);
  const markerText = cut.marker ?? tail.split('\n', 1)[0].slice(0, 40);

  return (
    <Alert severity={applied ? 'info' : 'warning'} sx={{ '& .MuiAlert-message': { width: '100%' } }}>
      <Typography variant="body2">
        {applied
          ? <>Matching und Export enden bei „{markerText}“. Die letzten {fmt(tail.length)} Zeichen (fremde Anzeigen, Fußzeile) werden ignoriert.</>
          : <>Kein Schnitt: Matching und Export nutzen den ganzen Text, auch die {fmt(tail.length)} Zeichen ab „{markerText}“.</>}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
        {onToggle && (
          <FormControlLabel
            control={<Checkbox size="small" checked={applied} onChange={e => onToggle(e.target.checked)} />}
            label="Schnitt anwenden"
          />
        )}
        <Button size="small" onClick={() => setShowTail(v => !v)}>
          {showTail ? 'Abgeschnittenen Teil ausblenden' : 'Abgeschnittenen Teil anzeigen'}
        </Button>
      </Box>
      <Collapse in={showTail} unmountOnExit>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ whiteSpace: 'pre-wrap', maxHeight: 300, overflow: 'auto', mt: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}
        >
          {tail}
        </Typography>
      </Collapse>
    </Alert>
  );
}
