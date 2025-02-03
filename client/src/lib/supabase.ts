import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    autoRefreshTime: 60000,
    detectSessionInUrl: false // Disable email verification check
  }
});

// Profile type with all fields
export type Profile = {
  id: string;
  email: string;
  username: string;
  theme: string;
  avatar_url?: string;
  status?: string;
  is_admin?: boolean;
};

// Helper function to get current user's profile
export async function getCurrentProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return profile;
}

// Helper function to update profile
export async function updateProfile(profile: Partial<Profile>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  return supabase
    .from('profiles')
    .update(profile)
    .eq('id', user.id);
}
