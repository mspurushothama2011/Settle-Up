import React, { useState, useEffect } from 'react';
import { getSupabaseClient } from '../supabaseClient';
import { User, Phone, RefreshCw, AlertCircle, LogIn } from 'lucide-react';

export default function AuthScreen({ onLoginSuccess }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [existingProfiles, setExistingProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchingProfiles, setFetchingProfiles] = useState(true);
  const [error, setError] = useState('');

  const fetchProfiles = async () => {
    setFetchingProfiles(true);
    setError('');
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setExistingProfiles(data || []);
    } catch (err) {
      console.error('Error fetching profiles:', err);
      setError('Could not connect to database profiles.');
    } finally {
      setFetchingProfiles(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!phone.trim()) return;

    setLoading(true);
    setError('');
    const supabase = getSupabaseClient();

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('phone', phone.trim())
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setError('No user found with this phone number. Try registering!');
      } else {
        onLoginSuccess(data);
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;

    setLoading(true);
    setError('');
    const supabase = getSupabaseClient();

    try {
      const { data: existing, error: checkError } = await supabase
        .from('profiles')
        .select('*')
        .eq('phone', phone.trim())
        .maybeSingle();

      if (checkError) throw checkError;

      if (existing) {
        setError('Phone number already registered. Please log in.');
        setLoading(false);
        return;
      }

      const { data, error: insertError } = await supabase
        .from('profiles')
        .insert([{ name: name.trim(), phone: phone.trim() }])
        .select()
        .single();

      if (insertError) throw insertError;

      onLoginSuccess(data);
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (profile) => {
    onLoginSuccess(profile);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6 text-slate-900 dark:text-slate-100 transition-colors duration-150">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden transition-colors duration-150">
        
        {/* Logo and Header */}
        <div className="p-8 text-center bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800/60 transition-colors duration-150">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-extrabold text-2xl tracking-tighter shadow-md mb-3">
            $I
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">SplitIt Expense Ledger</h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Simple, passwordless ledger for friends</p>
        </div>

        {/* Content Tabs */}
        <div className="px-8 pt-6 bg-white dark:bg-slate-900 transition-colors duration-150">
          <div className="flex border-b border-slate-100 dark:border-slate-800">
            <button
              onClick={() => { setIsRegistering(false); setError(''); }}
              className={`flex-1 pb-3 text-sm font-semibold border-b-2 text-center transition-all ${
                !isRegistering
                  ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white'
                  : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-350'
              }`}
            >
              Log In
            </button>
            <button
              onClick={() => { setIsRegistering(true); setError(''); }}
              className={`flex-1 pb-3 text-sm font-semibold border-b-2 text-center transition-all ${
                isRegistering
                  ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white'
                  : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-350'
              }`}
            >
              Register
            </button>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-8 bg-white dark:bg-slate-900 transition-colors duration-150">
          {error && (
            <div className="mb-5 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-650 dark:text-red-400 rounded-lg text-xs font-semibold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {isRegistering ? (
            /* Register Form */
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Priya Sharma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:border-slate-900 dark:focus:border-white focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:border-slate-900 dark:focus:border-white focus:outline-none transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 mt-2 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 font-semibold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Create Account'}
              </button>
            </form>
          ) : (
            /* Login Form */
            <div className="space-y-6">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Enter Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 dark:text-slate-500" />
                    <input
                      type="tel"
                      required
                      placeholder="e.g. 9876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:border-slate-900 dark:focus:border-white focus:outline-none transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 font-semibold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Log In'}
                </button>
              </form>

              {/* Quick Login Section */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Quick Login (Select Profile)
                  </h3>
                  <button
                    onClick={fetchProfiles}
                    disabled={fetchingProfiles}
                    className="text-slate-450 hover:text-slate-650 dark:text-slate-500 dark:hover:text-slate-350 transition-colors"
                    type="button"
                    title="Refresh users"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${fetchingProfiles ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {fetchingProfiles ? (
                  <div className="text-center py-4 text-xs text-slate-400 dark:text-slate-500">
                    Loading profiles...
                  </div>
                ) : existingProfiles.length === 0 ? (
                  <div className="text-center py-4 text-xs text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-850 rounded-lg">
                    No registered profiles yet. Create one!
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                    {existingProfiles.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handleQuickLogin(p)}
                        className="flex items-center justify-between p-2.5 text-left border border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-250 hover:bg-slate-50 dark:hover:bg-slate-800/50 active:bg-slate-100 dark:active:bg-slate-800 transition-all"
                      >
                        <span className="truncate">{p.name}</span>
                        <LogIn className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
