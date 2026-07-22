/**
 * Deutsche Anzeige-Labels für Job-Match-Kategorien und -Status.
 *
 * Bewusst electron-frei und ohne Laufzeit-Abhängigkeiten, damit sowohl der
 * Export-Service (Markdown/PDF/CSV) als auch electron-fremde Konsumenten
 * (z. B. das nanobot-CLI) dieselbe Quelle nutzen (Single Source of Truth).
 */

/** Match-Kategorie → deutsches Label (Fallback: Rohwert). */
export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    perfect: 'Perfekter Match',
    good: 'Guter Fit',
    needs_work: 'Lücken schließbar',
    poor: 'Schwacher Match'
  };
  return labels[category] || category;
}

/** Job-Status → deutsches Label (Fallback: Rohwert). */
export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    new: 'Neu',
    interesting: 'Interessant',
    applied: 'Beworben',
    rejected: 'Abgelehnt',
    archived: 'Archiviert'
  };
  return labels[status] || status;
}
