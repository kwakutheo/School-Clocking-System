const { Client } = require('pg');

const renderUri = "postgresql://theo:Tbxtx3at4yicnVKPZksGEdTCLSn92GC5@dpg-d802fgu7r5hc73b85qcg-a.frankfurt-postgres.render.com/tk_clocking";
const supabaseUri = "postgresql://postgres.zvbvyqndgnyevftypfyy:Aythlus%40sup86@aws-1-eu-west-2.pooler.supabase.com:5432/postgres";

async function runMigration() {
  const source = new Client({ connectionString: renderUri, ssl: { rejectUnauthorized: false } });
  const target = new Client({ connectionString: supabaseUri, ssl: { rejectUnauthorized: false } });

  try {
    console.log("Connecting to databases...");
    await source.connect();
    await target.connect();
    console.log("Connected to both databases successfully.");

    // Extract Schema from Render (Custom simplified DDL export since pg_dump is unavailable)
    // Actually, getting all table schemas is complex. Let's just use TypeORM to init the schema!
    // We will assume the schema has been initialized or we can just fetch the data and see.

    // Let's get the list of tables from Render
    const tablesRes = await source.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name != 'spatial_ref_sys';
    `);
    
    const tables = tablesRes.rows.map(r => r.table_name);
    console.log(`Found ${tables.length} tables to migrate:`, tables.join(', '));

    // Disable Foreign Key checks on target
    await target.query(`SET session_replication_role = 'replica';`);

    for (const table of tables) {
      console.log(`Migrating table: ${table}...`);
      const { rows, fields } = await source.query(`SELECT * FROM "${table}"`);
      
      if (rows.length === 0) {
        console.log(`Table ${table} is empty. Skipping.`);
        continue;
      }

      // Prepare Insert Statement
      const cols = fields.map(f => `"${f.name}"`).join(', ');
      
      for (const row of rows) {
        const vals = [];
        const params = [];
        let i = 1;
        for (const field of fields) {
          params.push(row[field.name]);
          vals.push(`$${i++}`);
        }
        
        try {
          await target.query(`INSERT INTO "${table}" (${cols}) VALUES (${vals.join(', ')}) ON CONFLICT DO NOTHING`, params);
        } catch (e) {
          // If table doesn't exist, this will throw an error!
          console.error(`Error inserting into ${table}:`, e.message);
          throw e; // Stop execution to handle it
        }
      }
      console.log(`Copied ${rows.length} rows to ${table}.`);
    }

    // Re-enable Foreign Key checks
    await target.query(`SET session_replication_role = 'origin';`);

    // Reset sequences (important for auto-incrementing IDs after insert)
    console.log("Resetting sequences...");
    const seqRes = await source.query(`
      SELECT sequence_name 
      FROM information_schema.sequences 
      WHERE sequence_schema = 'public';
    `);
    for (const seq of seqRes.rows) {
      const seqName = seq.sequence_name;
      // Find the current max value in Render
      const valRes = await source.query(`SELECT last_value FROM "${seqName}"`);
      const lastVal = valRes.rows[0].last_value;
      await target.query(`SELECT setval('"${seqName}"', ${lastVal}, true);`);
      console.log(`Sequence ${seqName} reset to ${lastVal}.`);
    }

    console.log("🎉 Migration completed successfully!");

  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await source.end();
    await target.end();
  }
}

runMigration();
