import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST() {
  try {
    // Get credentials from env
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Missing SUPABASE_SERVICE_ROLE_KEY in environment" },
        { status: 400 }
      );
    }

    // Create admin client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Read schema
    const schemaPath = path.join(process.cwd(), "supabase", "schema.sql");
    const schemaSql = fs.readFileSync(schemaPath, "utf-8");

    // Execute via Postgres function - requires a helper function in Supabase
    // Alternative: use the direct PostgreSQL connection
    const { data, error } = await supabase.rpc("exec_sql", {
      sql: schemaSql
    });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: "Schema created" });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
