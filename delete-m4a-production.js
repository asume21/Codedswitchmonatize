import pkg from 'pg';
const { Client } = pkg;

const DATABASE_URL = 'postgresql://postgres:AAIesREDiJCtdxaeeJFoJDOmTHrKFiED@centerbeam.proxy.rlwy.net:24931/railway';

async function deleteM4ASongs() {
  const client = new Client({
    connectionString: DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    const result = await client.query(
      "SELECT id, name, format FROM songs WHERE format ILIKE '%m4a%' OR name ILIKE '%.m4a'"
    );

    console.log(`\n🔍 Found ${result.rows.length} M4A songs`);
    result.rows.forEach(song => {
      console.log(`  - ${song.name}`);
    });

    if (result.rows.length === 0) {
      console.log('\n✅ No M4A songs found!');
      await client.end();
      return;
    }

    const deleteResult = await client.query(
      "DELETE FROM songs WHERE format ILIKE '%m4a%' OR name ILIKE '%.m4a'"
    );

    console.log(`\n✅ Deleted ${deleteResult.rowCount} M4A songs!`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

deleteM4ASongs();
