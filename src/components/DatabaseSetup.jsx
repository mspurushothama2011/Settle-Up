import React, { useState } from 'react';
import { Database, Copy, Check, ExternalLink } from 'lucide-react';
import { saveSupabaseConfig } from '../supabaseClient';

export default function DatabaseSetup({ onConfigured }) {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const sqlCode = `-- 1. Create Profiles Table (Users)
create table public.profiles (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  phone text not null unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.profiles disable row level security;

-- 2. Create Expenses Table
create table public.expenses (
  id uuid default gen_random_uuid() primary key,
  description text not null,
  amount numeric(10, 2) not null,
  paid_by uuid references public.profiles(id) on delete cascade not null,
  split_amongst uuid[] not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.expenses disable row level security;

-- 3. Create Debts Table (IOUs)
create table public.debts (
  id uuid default gen_random_uuid() primary key,
  expense_id uuid references public.expenses(id) on delete cascade not null,
  debtor_id uuid references public.profiles(id) on delete cascade not null,
  creditor_id uuid references public.profiles(id) on delete cascade not null,
  amount numeric(10, 2) not null,
  is_paid boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.debts disable row level security;`;

  const handleCopy = () => {
    navigator.clipboard.writeText(sqlCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!url.startsWith('http')) {
      setError('Please enter a valid Supabase Project URL (must start with https://)');
      return;
    }

    if (key.length < 20) {
      setError('Please enter a valid Supabase Anon Key');
      return;
    }

    try {
      const client = saveSupabaseConfig(url, key);
      if (client) {
        onConfigured();
      } else {
        setError('Failed to initialize client. Double check your credentials.');
      }
    } catch (err) {
      setError('An error occurred: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6 text-slate-900 dark:text-slate-100 transition-colors duration-150">
      <div className="max-w-2xl w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col md:flex-row transition-colors duration-150">
        
        {/* Left Side: Instructions */}
        <div className="w-full md:w-1/2 p-8 bg-slate-900 text-white flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-6">
              <Database className="w-6 h-6 text-indigo-400" />
              <span className="font-extrabold text-xl tracking-tight">SplitIt</span>
            </div>
            <h2 className="text-2xl font-bold mb-4">Set Up Your Database</h2>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              SplitIt stores and syncs your shared expenses in real-time using a free <strong>Supabase</strong> PostgreSQL database.
            </p>
            
            <div className="space-y-4">
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-850 text-slate-300 flex items-center justify-center text-xs font-bold">1</span>
                <p className="text-xs text-slate-350 leading-relaxed">
                  Sign up for a free account at <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline inline-flex items-center gap-0.5 font-semibold">supabase.com <ExternalLink className="w-3 h-3" /></a> and create a project.
                </p>
              </div>
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-850 text-slate-300 flex items-center justify-center text-xs font-bold">2</span>
                <p className="text-xs text-slate-350 leading-relaxed">
                  Go to the <strong>SQL Editor</strong>, paste our setup script, and click <strong>Run</strong>.
                </p>
              </div>
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-850 text-slate-300 flex items-center justify-center text-xs font-bold">3</span>
                <p className="text-xs text-slate-350 leading-relaxed">
                  Copy your <strong>Project URL</strong> and <strong>API Anon Key</strong> from Project Settings and paste them here.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-800">
            <button
              onClick={handleCopy}
              className="w-full py-2.5 px-4 bg-slate-850 hover:bg-slate-800 active:bg-slate-750 text-slate-200 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  SQL Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy SQL Setup Script
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Side: Setup Form */}
        <form onSubmit={handleSubmit} className="w-full md:w-1/2 p-8 flex flex-col justify-center bg-white dark:bg-slate-900 transition-colors duration-150">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Database Credentials</h3>
          
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-650 dark:text-red-400 rounded-lg text-xs font-medium">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Supabase URL
              </label>
              <input
                type="text"
                required
                placeholder="https://xxxxxx.supabase.co"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:border-slate-900 dark:focus:border-white focus:outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Anon Public Key
              </label>
              <textarea
                required
                rows={3}
                placeholder="eyJhbGciOiJIUzI1NiIsIn..."
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:border-slate-900 dark:focus:border-white focus:outline-none transition-all resize-none font-mono text-xs"
              />
            </div>
          </div>

          <div className="mt-8">
            <button
              type="submit"
              className="w-full py-3 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold rounded-lg shadow-md transition-all duration-150"
            >
              Connect & Start Splitting
            </button>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center mt-3">
              Credentials are saved in your local browser storage.
            </p>
          </div>
        </form>

      </div>
    </div>
  );
}
