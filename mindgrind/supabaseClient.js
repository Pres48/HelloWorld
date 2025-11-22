// supabaseClient.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.48.0/+esm";

const supabaseUrl = "https://hctnddkzfckjghfaylac.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjdG5kZGt6ZmNramdoZmF5bGFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyOTM5OTMsImV4cCI6MjA3ODg2OTk5M30.N2jUghtaIml1P4rgeC__f3W_5RtYmFl0ESX5LoOWTBc";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Expose for console debugging
window.supabase = supabase;

/* -----------------------------------------------------
   Auth helpers
----------------------------------------------------- */

// Get current logged-in user (or null)
export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.warn("getCurrentUser error:", error);
    return null;
  }
  return data?.user ?? null;
}

// Create or update a profile row for the current user.
// Returns the profile (or null if not logged in / error).
export async function ensureProfileForCurrentUser() {
  const user = await getCurrentUser();
  if (!user) return null;

  const email = user.email || "";
  let baseUsername = email.split("@")[0] || "player";

  // strip weird chars + keep it short
  baseUsername = baseUsername.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 16) || "player";

  const displayName = baseUsername;

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        username: baseUsername,
        display_name: displayName,
      },
      { onConflict: "id" }
    )
    .select()
    .single();

  if (error) {
    console.warn("ensureProfileForCurrentUser error:", error);
    return null;
  }

  return data;
}

// Fetch profile for the current user (without creating it)
export async function getProfileForCurrentUser() {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) {
    console.warn("getProfileForCurrentUser error:", error);
    return null;
  }

  return data;
}

/* -----------------------------------------------------
   Scores: save (insert/update) + fetch leaderboard
----------------------------------------------------- */

export async function saveScoreToSupabase(name, score, level, existingId = null) {
  const safeName = name && name.trim() ? name.trim() : "Guest";

  // Attach user_id if logged in
  const user = await getCurrentUser();
  const userId = user ? user.id : null;

  const payload = {
    name: safeName,
    score,
    level,
    user_id: userId,
  };

  let query;

  if (existingId) {
    // Update existing row for this run
    query = supabase
      .from("scores")
      .update(payload)
      .eq("id", existingId)
      .select("id")
      .single();
  } else {
    // Insert first row for this run
    query = supabase
      .from("scores")
      .insert(payload)
      .select("id")
      .single();
  }

  const { data, error } = await query;

  if (error) {
    console.error("Supabase save error:", error);
    throw error;
  }

  return data.id;
}

export async function fetchTopScores(limit = 15) {
  const { data, error } = await supabase
    .from("scores")
    .select("id, name, score, level, created_at")
    .order("score", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Supabase fetch leaderboard error:", error);
    throw error;
  }
  return data;
}

/* -----------------------------------------------------
   Basic auth actions (used by UI)
----------------------------------------------------- */

export async function signup(email, password) {
  return await supabase.auth.signUp({ email, password });
}

export async function login(email, password) {
  return await supabase.auth.signInWithPassword({ email, password });
}

export async function logout() {
  return await supabase.auth.signOut();
}
