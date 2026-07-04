import React, { useState, useEffect } from 'react';
import { getSupabaseClient } from '../supabaseClient';
import { calculateBilateralBalances } from '../utils/settlementAlgorithm';
import { UserPlus, User, Phone, RefreshCw, AlertCircle, Sparkles, ArrowUpRight, ArrowDownLeft, Check, Receipt } from 'lucide-react';

export default function FriendManager({ currentUser, refreshTrigger }) {
  const [friends, setFriends] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const fetchData = async () => {
    setFetching(true);
    setError('');
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      // 1. Fetch all profiles
      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .order('name', { ascending: true });

      if (profileErr) throw profileErr;
      setFriends(profileData || []);

      // 2. Fetch all expenses
      const { data: expenseData, error: expenseErr } = await supabase
        .from('expenses')
        .select('*');

      if (expenseErr) throw expenseErr;
      setExpenses(expenseData || []);
    } catch (err) {
      console.error('Error fetching members directory:', err);
      setError('Failed to fetch directory data.');
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUser, refreshTrigger]);

  const handleAddFriend = async (e) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;

    setLoading(true);
    setError('');
    setSuccess(false);
    const supabase = getSupabaseClient();

    try {
      const { data: existing, error: checkError } = await supabase
        .from('profiles')
        .select('*')
        .eq('phone', phone.trim())
        .maybeSingle();

      if (checkError) throw checkError;

      if (existing) {
        setError(`A user with phone number "${phone}" already exists (${existing.name}).`);
        setLoading(false);
        return;
      }

      const { data, error: insertError } = await supabase
        .from('profiles')
        .insert([{ name: name.trim(), phone: phone.trim() }])
        .select()
        .single();

      if (insertError) throw insertError;

      setSuccess(true);
      setName('');
      setPhone('');
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to add friend.');
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (fullName) => {
    return fullName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // Calculate bilateral standing balances for the active user
  const bilateralBalances = calculateBilateralBalances(expenses, currentUser.id);

  // Calculate total money spent by the entire group (excluding settlement payments)
  const totalGroupSpent = expenses
    .filter((exp) => !exp.is_payment)
    .reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);

  // Calculate total money personally paid for by the active logged-in profile
  const personalSpent = expenses
    .filter((exp) => !exp.is_payment && exp.paid_by === currentUser.id)
    .reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-slate-900 dark:text-slate-100 max-w-5xl mx-auto">
      {/* Add Friend Form */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm h-fit transition-colors duration-155">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-slate-550 dark:text-slate-400" />
          Add Friend to Ledger
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 text-red-655 dark:text-red-400 rounded-lg text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs font-semibold">
            Friend added successfully!
          </div>
        )}

        <form onSubmit={handleAddFriend} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-550 dark:text-slate-400 uppercase tracking-wider mb-2">
              Friend Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 dark:text-slate-550" />
              <input
                type="text"
                required
                placeholder="e.g. Rahul Verma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:border-slate-900 dark:focus:border-white focus:outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-550 dark:text-slate-400 uppercase tracking-wider mb-2">
              Phone Number
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 dark:text-slate-555" />
              <input
                type="tel"
                required
                placeholder="e.g. 9876543211"
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
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Register Friend'}
          </button>
        </form>
      </div>

      {/* Friends List & Standings Dashboard */}
      <div className="md:col-span-2 space-y-6">
        
        {/* Total Group Spending & Personal Spending Card */}
        {!fetching && (
          <div className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 p-6 rounded-xl border border-slate-800 dark:border-slate-200 shadow-sm flex items-center justify-between transition-colors duration-150 animate-fadeIn">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-85 dark:opacity-75">
                Total Group Spending
              </p>
              <p className="text-2xl font-extrabold mt-1 font-mono tracking-tight">
                ₹{totalGroupSpent.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              
              {/* Personal spending subtext */}
              <p className="text-xs font-semibold mt-3.5 opacity-80 dark:opacity-90 flex items-center gap-1.5 border-t border-white/10 dark:border-slate-200/50 pt-2.5">
                <span>👤</span>
                <span>You personally paid:</span>
                <span className="font-mono font-bold text-white dark:text-slate-950">
                  ₹{personalSpent.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </p>
            </div>
            <div className="p-3 bg-white/10 dark:bg-slate-200/50 rounded-lg">
              <Receipt className="w-6 h-6 text-white dark:text-slate-900" />
            </div>
          </div>
        )}

        {/* Directory List Box */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-150">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-slate-550 dark:text-slate-455" />
              Group Directory & Standings ({friends.length})
            </h2>
            <button
              onClick={fetchData}
              disabled={fetching}
              className="text-slate-455 hover:text-slate-655 dark:text-slate-500 dark:hover:text-slate-350 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${fetching ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {fetching ? (
            <div className="text-center py-12 text-sm text-slate-400 dark:text-slate-550">
              Loading group directory...
            </div>
          ) : friends.length === 0 ? (
            <div className="text-center py-12 text-sm text-slate-400 dark:text-slate-550 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              No group members added yet. Add a friend using the form!
            </div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {friends.map((friend) => {
                const balance = bilateralBalances[friend.id] || 0;

                return (
                  <div
                    key={friend.id}
                    className={`p-4 border rounded-xl flex items-center justify-between transition-all ${
                      friend.id === currentUser.id
                        ? 'border-indigo-200 bg-indigo-50/20 dark:border-indigo-950/60 dark:bg-indigo-950/10'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700 bg-white dark:bg-slate-900/50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shadow-sm flex-shrink-0 ${
                        friend.id === currentUser.id
                          ? 'bg-indigo-900 dark:bg-indigo-700 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                      }`}>
                        {getInitials(friend.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                          {friend.name}
                          {friend.id === currentUser.id && (
                            <span className="ml-1.5 px-1.5 py-0.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[9px] font-bold rounded-full uppercase tracking-wider">
                              You
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-550 font-mono truncate mt-0.5">{friend.phone}</p>
                      </div>
                    </div>

                    {/* Standing status balance for other users */}
                    {friend.id !== currentUser.id && (
                      <div className="text-right flex-shrink-0 pl-3">
                        {balance > 0.01 ? (
                          <div className="flex flex-col items-end">
                            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-450 font-mono flex items-center gap-0.5">
                              <ArrowUpRight className="w-3.5 h-3.5" />
                              ₹{balance.toFixed(2)}
                            </p>
                            <p className="text-[9px] font-extrabold text-emerald-700/80 dark:text-emerald-500 uppercase tracking-wider mt-0.5">
                              Owes You
                            </p>
                          </div>
                        ) : balance < -0.01 ? (
                          <div className="flex flex-col items-end">
                            <p className="text-xs font-bold text-rose-650 dark:text-rose-455 font-mono flex items-center gap-0.5">
                              <ArrowDownLeft className="w-3.5 h-3.5" />
                              ₹{Math.abs(balance).toFixed(2)}
                            </p>
                            <p className="text-[9px] font-extrabold text-rose-650/80 dark:text-rose-500 uppercase tracking-wider mt-0.5">
                              You Owe
                            </p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-end opacity-70">
                            <p className="text-xs font-semibold text-slate-400 dark:text-slate-555 font-mono flex items-center gap-0.5">
                              <Check className="w-3.5 h-3.5 text-slate-400" />
                              ₹0.00
                            </p>
                            <p className="text-[9px] font-extrabold text-slate-400 dark:text-slate-550 uppercase tracking-wider mt-0.5">
                              Settled
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
