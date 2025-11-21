// supabaseClient.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.48.0/+esm";

const supabaseUrl = "https://hctnddkzfckjghfaylac.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjdG5kZGt6ZmNramdoZmF5bGFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyOTM5OTMsImV4cCI6MjA3ODg2OTk5M30.N2jUghtaIml1P4rgeC__f3W_5RtYmFl0ESX5LoOWTBc";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Insert OR update a score row in the "scores" table.
 *
 * If existingId is null → INSERT a new row.
 * If existingId is set  → UPDATE that row.
 *
 * Returns the row's id.
 *
 * Expected schema:
 *  - id (bigint, identity)
 *  - name (text)
 *  - score (int)
 *  - level (int)
 *  - created_at (timestamptz, default now())
 */
export async function saveScoreToSupabase(name, score, level, existingId = null) {
  const safeName = name && name.trim() ? name.trim() : "Guest";

  let data, error;

  if (existingId) {
    // Update existing row for this run
    ({ data, error } = await supabase
      .from("scores")
      .update({
        name: safeName,
        score,
        level,
      })
      .eq("id", existingId)
      .select("id")
      .single());
  } else {
    // Insert first row for this run
    ({ data, error } = await supabase
      .from("scores")
      .insert({
        name: safeName,
        score,
        level,
      })
      .select("id")
      .single());
  }

  if (error) {
    console.error("Supabase save error:", error);
    throw error;
  }

  return data.id;
}

export async function fetchTopScores(limit = 15) {
  const { data, error } = await supabase
    .from("scores")
    .select("id, name, score, level, created_at")  // 👈 added id here
    .order("score", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Supabase fetch leaderboard error:", error);
    throw error;
  }
  return data;
}

async function signup(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  return { data, error };
}

async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
}

async function logout() {
  await supabase.auth.signOut();
}

