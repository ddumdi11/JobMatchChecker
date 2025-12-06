/**
 * Seed initial data for Job Match Checker
 */

exports.up = async function(knex) {
  // Insert app settings
  await knex('app_settings').insert([
    { key: 'db_version', value: '1.0.0' },
    { key: 'app_initialized', value: 'true' }
  ]);

  // Insert default skill categories
  await knex('skill_categories').insert([
    { id: 1, name: 'Programmiersprachen', parent_id: null, sort_order: 1 },
    { id: 2, name: 'Frameworks & Libraries', parent_id: null, sort_order: 2 },
    { id: 3, name: 'Datenbanken', parent_id: null, sort_order: 3 },
    { id: 4, name: 'DevOps & Cloud', parent_id: null, sort_order: 4 },
    { id: 5, name: 'Tools & IDEs', parent_id: null, sort_order: 5 },
    { id: 6, name: 'Soft Skills', parent_id: null, sort_order: 6 },
    { id: 7, name: 'Domain Knowledge', parent_id: null, sort_order: 7 }
  ]);

  // Insert default job sources
  await knex('job_sources').insert([
    { name: 'LinkedIn', url: 'https://www.linkedin.com/', api_available: false },
    { name: 'XING', url: 'https://www.xing.com/', api_available: false },
    { name: 'Stepstone', url: 'https://www.stepstone.de/', api_available: false },
    { name: 'Indeed', url: 'https://de.indeed.com/', api_available: false },
    { name: 'Arbeitsagentur', url: 'https://web.arbeitsagentur.de/', api_available: false },
    { name: 'Nachhaltige Jobs', url: 'https://www.nachhaltigejobs.de/', api_available: false },
    { name: 'MeineStadt', url: 'https://konto.meinestadt.de/', api_available: false }
  ]);

  // Insert default matching prompt
  await knex('matching_prompts').insert({
    name: 'Default Matching Prompt',
    version: '1.0.0',
    is_active: true,
    prompt_text: `You are an expert career advisor and job matching assistant.

Analyze the following job offer and user profile to determine compatibility.

USER PROFILE:
{profile}

JOB OFFER:
{job}

Provide a detailed analysis in JSON format with the following structure:
{
  "matchScore": <number between 0-100>,
  "matchCategory": "<perfect|good|fair|poor>",
  "gapAnalysis": {
    "missingSkills": [
      {
        "skill": "<skill name>",
        "category": "<skill category>",
        "requiredLevel": <number 0-10>,
        "currentLevel": <number 0-10>,
        "gap": <number>,
        "priority": "<high|medium|low>"
      }
    ],
    "experienceGaps": [
      {
        "area": "<domain>",
        "requiredYears": <number>,
        "actualYears": <number>,
        "gapYears": <number>
      }
    ],
    "recommendations": [
      "<actionable recommendation>"
    ]
  },
  "strengths": [
    "<what matches well>"
  ],
  "reasoning": "<detailed explanation of the score and analysis>"
}

Be objective and consider:
1. Technical skill alignment (40%)
2. Experience level match (30%)
3. Location/remote preferences (15%)
4. Salary expectations (15%)`
  });

  // Note: user_preferences will be created by First-Run-Dialog along with user profile
};

exports.down = async function(knex) {
  await knex('matching_prompts').del();
  await knex('job_sources').del();
  await knex('skill_categories').del();
  await knex('app_settings').del();
};
