import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

async function setupDatabase() {
  const supabaseUrl = "https://zitmibbdftovjgmsvspf.supabase.co";
  const serviceRoleKey =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppdG1pYmJkZnRvdmpnbXN2c3BmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDQ1NjUyMiwiZXhwIjoyMDkwMDMyNTIyfQ.muYpYrIgiPOg577p7acmbvaEL8bvhrK18vx4DUtok2E";

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const schemaPath = path.join(process.cwd(), "supabase", "schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf-8");

  console.log("🔄 Setting up database schema...");

  try {
    // Split statements and filter empty ones
    const statements = schemaSql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    let successCount = 0;

    for (const statement of statements) {
      try {
        // Use the Supabase PostgreSQL one-off function
        const { error } = await supabase.rpc("exec_sql_admin", {
          sql: statement,
        });

        if (error) {
          console.log(
            `⚠️  Statement skipped: ${statement.substring(0, 40)}...`
          );
        } else {
          successCount++;
          console.log(`✅ ${statement.substring(0, 50)}...`);
        }
      } catch (err) {
        console.log(`⚠️  Error on statement: ${statement.substring(0, 40)}...`);
      }
    }

    console.log(`\n✅ Schema setup completed! (${successCount} statements)`);
  } catch (error) {
    console.error("❌ Setup failed:", (error as Error).message);
    process.exit(1);
  }
}

setupDatabase();
