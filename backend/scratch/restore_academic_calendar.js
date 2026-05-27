const { DataSource } = require('typeorm');

const ds = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres',
  database: process.env.DB_NAME || 'tk_clocking'
});

async function run() {
  await ds.initialize();
  console.log('Database initialized.');

  // 1. Delete all existing terms (this clears out duplicates and local terms)
  console.log('Clearing existing academic terms and breaks...');
  await ds.query('DELETE FROM term_breaks');
  await ds.query('DELETE FROM academic_terms');

  // 2. Define the global templates for 2025/2026 and 2026/2027
  const globalTerms = [
    // 2025/2026 Academic Year
    {
      name: 'First Term',
      academicYear: '2025/2026',
      startDate: '2025-09-02',
      endDate: '2025-12-18',
      isActive: true,
      breaks: [
        { name: 'First Term Mid-Term Break', startDate: '2025-10-23', endDate: '2025-10-27' }
      ]
    },
    {
      name: 'Second Term',
      academicYear: '2025/2026',
      startDate: '2026-01-06',
      endDate: '2026-04-03',
      isActive: true,
      breaks: [
        { name: 'Second Term Mid-Term Break', startDate: '2026-02-19', endDate: '2026-02-23' }
      ]
    },
    {
      name: 'Third Term',
      academicYear: '2025/2026',
      startDate: '2026-05-05',
      endDate: '2026-07-24',
      isActive: true,
      breaks: [
        { name: 'Third Term Mid-Term Break', startDate: '2026-06-18', endDate: '2026-06-22' }
      ]
    },

    // 2026/2027 Academic Year
    {
      name: 'First Term',
      academicYear: '2026/2027',
      startDate: '2026-09-01',
      endDate: '2026-12-17',
      isActive: false,
      breaks: [
        { name: 'First Term Mid-Term Break', startDate: '2026-10-22', endDate: '2026-10-26' }
      ]
    },
    {
      name: 'Second Term',
      academicYear: '2026/2027',
      startDate: '2027-01-05',
      endDate: '2027-04-02',
      isActive: false,
      breaks: [
        { name: 'Second Term Mid-Term Break', startDate: '2027-02-18', endDate: '2027-02-22' }
      ]
    },
    {
      name: 'Third Term',
      academicYear: '2026/2027',
      startDate: '2027-05-04',
      endDate: '2027-07-23',
      isActive: false,
      breaks: [
        { name: 'Third Term Mid-Term Break', startDate: '2027-06-17', endDate: '2027-06-21' }
      ]
    }
  ];

  // 3. Insert global templates
  console.log('Inserting global templates...');
  for (const t of globalTerms) {
    const termResult = await ds.query(
      `INSERT INTO academic_terms(name, "academicYear", "startDate", "endDate", "isActive", tenant_id) 
       VALUES ($1, $2, $3, $4, $5, NULL) RETURNING id`,
      [t.name, t.academicYear, t.startDate, t.endDate, t.isActive]
    );
    const termId = termResult[0].id;

    for (const b of t.breaks) {
      await ds.query(
        `INSERT INTO term_breaks(name, "startDate", "endDate", "termId", tenant_id) 
         VALUES ($1, $2, $3, $4, NULL)`,
        [b.name, b.startDate, b.endDate, termId]
      );
    }
  }

  console.log('Successfully seeded global templates!');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
