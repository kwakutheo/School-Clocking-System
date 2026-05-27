const { Client } = require('pg');

async function createDatabase() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'postgres',
  });

  try {
    console.log('🔌 Connecting to local PostgreSQL at localhost:5432...');
    await client.connect();
    console.log('✓ Connected successfully!');

    console.log('🔍 Checking if "tk_clocking" database already exists...');
    const res = await client.query("SELECT 1 FROM pg_database WHERE datname='tk_clocking'");
    
    if (res.rowCount === 0) {
      console.log('🚀 Creating database "tk_clocking"...');
      await client.query('CREATE DATABASE tk_clocking');
      console.log('✓ Database "tk_clocking" created successfully!');
    } else {
      console.log('✓ Database "tk_clocking" already exists! No action needed.');
    }
  } catch (err) {
    console.error('❌ Error during database creation:', err.message);
    if (err.message.includes('password authentication failed')) {
      console.log('\n💡 Tip: Your local PostgreSQL password might not be "postgres".');
      console.log('Please double check your local PostgreSQL master credentials.');
    } else if (err.message.includes('ECONNREFUSED')) {
      console.log('\n💡 Tip: Your local PostgreSQL service is not running!');
      console.log('Please start PostgreSQL (e.g. via Services.msc on Windows) and run this script again.');
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

createDatabase();
