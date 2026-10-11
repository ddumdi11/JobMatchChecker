/**
 * Add domain_patterns to job_sources (Quelle-Autoerkennung im Erfassungsformular).
 *
 * Feature: feat/source-dropdown-date-default
 *
 * `domain_patterns` = kommagetrennte Domains, über die eine Quelle anhand der
 * ERSTEN URL im eingefügten Rohtext erkannt wird (Suffix-Match auf den
 * Hostnamen, siehe detectSourceIdFromUrl in src/shared/urlUtils.ts). Neue
 * Jobbörsen werden so ohne Codeänderung erkennbar – nur der DB-Wert zählt.
 *
 * Befüllung defensiv: Die echte DB kann vom Seed abweichen (Freitext-Quellen).
 * Aus einer vorhandenen `url` wird die registrierbare Domain (letzte zwei
 * Labels) abgeleitet, z. B. `https://web.arbeitsagentur.de/` → `arbeitsagentur.de`.
 * Quellen ohne parsebare `url` bekommen NULL und werden nie auto-erkannt.
 *
 * Zusätzlich neue Quelle "stellenangebote.de" (falls nicht schon vorhanden).
 * Die genaue Mail-Domain der Börse ist noch offen – ggf. nur den Wert in
 * domain_patterns anpassen.
 */

const NEW_SOURCE = {
  name: 'stellenangebote.de',
  url: 'https://www.stellenangebote.de/',
  domain_patterns: 'stellenangebote.de'
};

/** Registrierbare Domain (letzte zwei Labels) aus einer URL, sonst null. */
function deriveDomain(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const host = new URL(url.trim()).hostname.toLowerCase().replace(/\.$/, '');
    const labels = host.split('.').filter(Boolean);
    if (labels.length < 2) return null;
    return labels.slice(-2).join('.');
  } catch {
    return null;
  }
}

exports.up = async function (knex) {
  await knex.schema.table('job_sources', (table) => {
    table.text('domain_patterns'); // kommagetrennt, z. B. "linkedin.com"
  });

  const sources = await knex('job_sources').select('id', 'url');
  for (const source of sources) {
    const domain = deriveDomain(source.url);
    if (domain) {
      await knex('job_sources').where({ id: source.id }).update({ domain_patterns: domain });
    }
  }

  const existing = await knex('job_sources')
    .whereRaw('lower(name) = lower(?)', [NEW_SOURCE.name])
    .first();
  if (existing) {
    if (!existing.domain_patterns) {
      await knex('job_sources')
        .where({ id: existing.id })
        .update({ domain_patterns: NEW_SOURCE.domain_patterns });
    }
  } else {
    await knex('job_sources').insert({ ...NEW_SOURCE, api_available: false });
  }
};

exports.down = async function (knex) {
  // Die eingefügte Quelle nur entfernen, wenn sie noch erkennbar "unsere" ist:
  // (a) Name UND die von uns gesetzten domain_patterns stimmen überein
  //     (von Hand angepasste Patterns → Nutzerdaten, bleibt stehen), und
  // (b) kein Job daran hängt (job_offers.source_id ist ON DELETE RESTRICT).
  // Bewusst ohne eigenes Tracking-Metadatum – das deckt das reale Risiko ab.
  const source = await knex('job_sources')
    .where({ name: NEW_SOURCE.name, domain_patterns: NEW_SOURCE.domain_patterns })
    .first();
  if (source) {
    const used = await knex('job_offers').where({ source_id: source.id }).first();
    if (!used) {
      await knex('job_sources').where({ id: source.id }).del();
    }
  }
  // Natives DROP COLUMN (SQLite ≥ 3.35) statt knex-Tabellen-Neuaufbau, der
  // bei referenzierter Tabelle (job_offers → job_sources) riskant wäre.
  await knex.raw('ALTER TABLE job_sources DROP COLUMN domain_patterns');
};
