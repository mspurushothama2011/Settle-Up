import { createClient } from '@supabase/supabase-js';

export const getSupabaseConfig = () => {
  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  const localUrl = localStorage.getItem('splitit_supabase_url');
  const localKey = localStorage.getItem('splitit_supabase_anon_key');
  
  // Use environment variables if they are set and are not the placeholders
  const url = (envUrl && envUrl !== 'your_supabase_project_url' && envUrl.trim() !== '') ? envUrl : localUrl;
  const key = (envKey && envKey !== 'your_supabase_anon_key' && envKey.trim() !== '') ? envKey : localKey;
  
  return {
    url: url || '',
    key: key || '',
    isConfigured: !!(url && key && url.startsWith('http'))
  };
};

let supabaseInstance = null;

export const getSupabaseClient = () => {
  if (supabaseInstance) return supabaseInstance;
  
  const { url, key, isConfigured } = getSupabaseConfig();
  if (isConfigured) {
    try {
      supabaseInstance = createClient(url, key);
    } catch (e) {
      console.error('Error creating Supabase client:', e);
    }
  }
  return supabaseInstance;
};

export const saveSupabaseConfig = (url, key) => {
  if (url) localStorage.setItem('splitit_supabase_url', url.trim());
  if (key) localStorage.setItem('splitit_supabase_anon_key', key.trim());
  
  // Force recreation of client on next get
  supabaseInstance = null;
  return getSupabaseClient();
};

export const clearSupabaseConfig = () => {
  localStorage.removeItem('splitit_supabase_url');
  localStorage.removeItem('splitit_supabase_anon_key');
  supabaseInstance = null;
};
