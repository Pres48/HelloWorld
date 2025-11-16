// supabaseClient.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.48.0/+esm";

const supabaseUrl = "https://hctnddkzfckjghfaylac.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjdG5kZGt6ZmNramdoZmF5bGFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyOTM5OTMsImV4cCI6MjA3ODg2OTk5M30.N2jUghtaIml1P4rgeC__f3W_5RtYmFl0ESX5LoOWTBc";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Save score to Supabase "scores" table.
 * Expected schema:
 *  - id (bigint, identity)
 *  - name (text)
 *  - score (int)
 *  - level (int)
 *  - created_at (timestamptz, default now())
 */
export async function saveScoreToSupabase(name, score, level) {
  const safeName = name && name.trim() ? name.trim() : "Guest";

  const { data, error } = await supabase.from("scores").insert({
    name: safeName,
    score,
    level,
  });

  if (error) {
    console.error("Supabase save error:", error);
    throw error;
  }

  return data;
}
