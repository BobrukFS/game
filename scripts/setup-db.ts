import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

async function setupDatabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in environment variables");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Read schema SQL
  const schemaPath = path.join(process.cwd(), "supabase", "schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf-8");

  console.log("Executing schema...");

  try {
    // Split by semicolon and execute each statement
    const statements = schemaSql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      console.log(`Executing: ${statement.substring(0, 50)}...`);
      const { error } = await supabase.rpc("exec_sql", { sql: statement });

      if (error) {
        console.error("Error executing statement:", error);
      }
    }

    console.log("✅ Schema setup completed!");
  } catch (error) {
    console.error("❌ Error setting up database:", error);
    process.exit(1);
  }
}

setupDatabase();
