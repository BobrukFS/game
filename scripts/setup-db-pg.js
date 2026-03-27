const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

async function setupDatabase() {
  // Try direct connection first (without pgbouncer)
  const connectionConfig = {
    host: "db.zitmibbdftovjgmsvspf.supabase.co",
    port: 5432,
    database: "postgres",
    user: "postgres",
    password: "43264335Exe",
  };

  console.log(
    `🔄 Connecting to ${connectionConfig.host}:${connectionConfig.port}...`
  );

  const client = new Client(connectionConfig);

  try {
    await client.connect();
    console.log("✅ Connected to database");

    // Read schema
    const schemaPath = path.join(__dirname, "..", "supabase", "schema.sql");
    const schemaSql = fs.readFileSync(schemaPath, "utf-8");

    console.log("📝 Executing schema...");

    // Execute the entire schema at once
    await client.query(schemaSql);

    console.log("✅ Schema setup completed successfully!");

    await client.end();
  } catch (error) {
    console.error("❌ Error:", error.message);
    await client.end();
    process.exit(1);
  }
}

setupDatabase();
