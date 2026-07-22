/**
 * Deutsche Anzeige-Labels für Job-Match-Kategorien und -Status.
 *
 * Bewusst electron-frei und ohne Laufzeit-Abhängigkeiten, damit sowohl der
 * Export-Service (Markdown/PDF/CSV) als auch electron-fremde Konsumenten
 * (z. B. das nanobot-CLI) dieselbe Quelle nutzen (Single Source of Truth).
 */

// Domain-Werte (DB-Enums wie 'needs_work', 'new') bleiben als String-Keys in
// der Map – das sind Daten, keine TS-Bezeichner.
const CATEGORY_LABELS = new Map<string, string>([
  ['perfect', 'Perfekter Match'],
  ['good', 'Guter Fit'],
  ['needs_work', 'Lücken schließbar'],
  ['poor', 'Schwacher Match']
]);

const STATUS_LABELS = new Map<string, string>([
  ['new', 'Neu'],
  ['interesting', 'Interessant'],
  ['applied', 'Beworben'],
  ['rejected', 'Abgelehnt'],
  ['archived', 'Archiviert']
]);

/** Match-Kategorie → deutsches Label (Fallback: Rohwert). */
export function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS.get(category) ?? category;
}

/** Job-Status → deutsches Label (Fallback: Rohwert). */
export function getStatusLabel(status: string): string {
  return STATUS_LABELS.get(status) ?? status;
}
