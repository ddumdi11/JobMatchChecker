/**
 * Rauschen am Textende kappen (Feature: feat/text-cut-noise).
 *
 * job_offers.full_text_cut – Schnittposition im unveränderten full_text:
 *   NULL = noch nie bewertet → die aktuelle Markerliste gilt zur Laufzeit
 *   0    = bewusst kein Schnitt (ein echter Schnitt liegt immer in der hinteren
 *          Texthälfte, 0 ist also nie eine Schnittposition)
 *   > 0  = gespeicherter Schnitt (JS-String-Index, angewendet nur im TS-Code)
 *
 * text_cut_markers – Markerliste als Daten. Geschnitten wird nur, was nicht zu
 * der Stelle gehört (fremde Anzeigen, Navigation, Fußzeile). Firmenangaben
 * ("Unternehmens-Details") bleiben bewusst im Text.
 */

const MARKERS = [
  'Interesse geweckt?',
  'Ähnliche Jobs',
  'Ähnliche Stellenanzeigen',
  'Gehalts-Prognose',
  'JOBSUCHENDE',
  'Impressum'
];

exports.up = async function (knex) {
  await knex.schema.table('job_offers', (table) => {
    table.integer('full_text_cut').nullable();
  });

  await knex.schema.createTable('text_cut_markers', (table) => {
    table.increments('id').primary();
    table.text('marker').notNullable().unique();
    table.integer('sort_order').notNullable().defaultTo(0);
  });

  await knex('text_cut_markers').insert(
    MARKERS.map((marker, i) => ({ marker, sort_order: i + 1 }))
  );
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('text_cut_markers');
  await knex.schema.table('job_offers', (table) => {
    table.dropColumn('full_text_cut');
  });
};
