const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

async function setupDatabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ Missing Supabase credentials");
    console.log("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const schemaPath = path.join(__dirname, "..", "supabase", "schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf-8");

  console.log("🔄 Executing schema...");

  try {
    const { data, error } = await supabase.rpc("exec_sql", { sql: schemaSql });

    if (error) {
      console.error("❌ Error:", error.message);
      process.exit(1);
    }

    console.log("✅ Schema setup completed!");
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

setupDatabase();
