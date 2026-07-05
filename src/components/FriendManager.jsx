import React, { useState, useEffect } from 'react';
import { getSupabaseClient } from '../supabaseClient';
import { buildDirectDebts } from '../utils/settlementAlgorithm';
import { UserPlus, User, Phone, RefreshCw, AlertCircle, Receipt, Wallet, ChevronDown, ChevronUp } from 'lucide-react';

// ---------- Component ----------
export default function FriendManager({ currentUser, refreshTrigger }) {
  const [profiles, setProfiles] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const fetchData = async () => {
    setFetching(true);
    setError('');
    const supabase = getSupabaseClient();
    if (!supabase) return;
    try {
      const { data: profileData, error: profileErr } = await supabase
        .from('profiles').select('*').order('name', { ascending: true });
      if (profileErr) throw profileErr;
      setProfiles(profileData || []);

      const { data: expenseData, error: expenseErr } = await supabase
        .from('expenses').select('*');
      if (expenseErr) throw expenseErr;
      setExpenses(expenseData || []);
    } catch (err) {
      setError('Failed to load data.');
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => { fetchData(); }, [currentUser, refreshTrigger]);

  const handleAddFriend = async (e) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    setLoading(true); setError(''); setSuccess(false);
    const supabase = getSupabaseClient();
    try {
      const { data: existing } = await supabase
        .from('profiles').select('*').eq('phone', phone.trim()).maybeSingle();
      if (existing) {
        setError(`Phone already registered to ${existing.name}.`);
        return;
      }
      await supabase.from('profiles').insert([{ name: name.trim(), phone: phone.trim() }]);
      setSuccess(true); setName(''); setPhone('');
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to add friend.');
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (n) => n.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
  const getName = (id) => profiles.find(p => p.id === id)?.name || 'Unknown';

  // Build the simple direct debt table
  const { remaining, totalPaid } = buildDirectDebts(expenses, profiles);

  // Total group spend (excluding payments)
  const totalGroupSpent = expenses
    .filter(e => !e.is_payment)
    .reduce((s, e) => s + parseFloat(e.amount || 0), 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-slate-900 dark:text-slate-100 max-w-5xl mx-auto">

      {/* ── Add Friend Form ── */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm h-fit">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-slate-400" />
          Add Member
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 rounded-lg text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{error}</span>
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs font-semibold">
            Member added!
          </div>
        )}

        <form onSubmit={handleAddFriend} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Name</label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input type="text" required placeholder="e.g. Rahul Verma" value={name}
                onChange={e => setName(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:border-slate-900 dark:focus:border-white focus:outline-none transition-all" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Phone</label>
            <div className="relative">
              <Phone className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input type="tel" required placeholder="e.g. 9876543210" value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:border-slate-900 dark:focus:border-white focus:outline-none transition-all" />
            </div>
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 font-semibold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Register Member'}
          </button>
        </form>
      </div>

      {/* ── Right Column ── */}
      <div className="md:col-span-2 space-y-5">

        {/* Total Group Spending Banner */}
        {!fetching && (
          <div className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 p-5 rounded-xl shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">Total Group Spending</p>
              <p className="text-2xl font-extrabold mt-1 font-mono">
                ₹{Math.round(totalGroupSpent).toLocaleString('en-IN')}
              </p>
              <p className="text-xs mt-2 opacity-60 border-t border-white/10 dark:border-black/10 pt-2">
                You personally paid: <span className="font-bold font-mono">₹{Math.round(totalPaid[currentUser.id] || 0).toLocaleString('en-IN')}</span>
              </p>
            </div>
            <div className="p-3 bg-white/10 dark:bg-black/10 rounded-lg">
              <Receipt className="w-6 h-6" />
            </div>
          </div>
        )}

        {/* Per-Person Spending Cards */}
        {fetching ? (
          <div className="py-12 text-center text-sm text-slate-400">Loading...</div>
        ) : profiles.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
            No members yet. Add one using the form!
          </div>
        ) : (
          <div className="space-y-3">
            {profiles.map(person => {
              const paid = totalPaid[person.id] || 0;
              const debtors = Object.entries(remaining[person.id] || {});
              const totalOwed = debtors.reduce((s, [, v]) => s + v, 0);
              const isExpanded = expandedId === person.id;
              const isMe = person.id === currentUser.id;

              return (
                <div key={person.id}
                  className={`rounded-xl border shadow-sm overflow-hidden transition-all ${
                    isMe
                      ? 'border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/30 dark:bg-indigo-950/10'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50'
                  }`}>

                  {/* Header row – always visible */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : person.id)}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">

                    <div className="flex items-center gap-3 min-w-0">
                      {/* Avatar */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shadow-sm flex-shrink-0 ${
                        isMe ? 'bg-indigo-800 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                      }`}>
                        {getInitials(person.name)}
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate flex items-center gap-2">
                          {person.name}
                          {isMe && (
                            <span className="px-1.5 py-0.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[9px] font-bold rounded-full uppercase">
                              You
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">{person.phone}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 flex-shrink-0 pl-3">
                      {/* Spent badge */}
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-slate-300">
                          <Wallet className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-mono">₹{Math.round(paid).toLocaleString('en-IN')}</span>
                        </div>
                        <p className="text-[9px] text-slate-400 uppercase tracking-wide mt-0.5">spent</p>
                      </div>

                      {/* Owed to them badge */}
                      {totalOwed > 0.01 && (
                        <div className="text-right">
                          <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                            ₹{Math.round(totalOwed).toLocaleString('en-IN')}
                          </div>
                          <p className="text-[9px] text-emerald-600 dark:text-emerald-500 uppercase tracking-wide mt-0.5">owed to them</p>
                        </div>
                      )}

                      {/* Expand chevron (only if they have debtors) */}
                      {debtors.length > 0
                        ? isExpanded
                          ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        : <div className="w-4" />
                      }
                    </div>
                  </button>

                  {/* Expanded debt breakdown */}
                  {isExpanded && debtors.length > 0 && (
                    <div className="border-t border-slate-100 dark:border-slate-800 px-4 pb-4 pt-3 bg-slate-50/50 dark:bg-slate-900/30">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                        Who still needs to pay {isMe ? 'you' : person.name}:
                      </p>
                      <div className="space-y-2">
                        {debtors
                          .sort((a, b) => b[1] - a[1])
                          .map(([debtorId, amount]) => (
                          <div key={debtorId}
                            className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-700 dark:text-slate-200 flex-shrink-0">
                                {getInitials(getName(debtorId))}
                              </div>
                              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                {getName(debtorId)}
                                {debtorId === currentUser.id && (
                                  <span className="ml-1 text-[9px] bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 px-1 py-0.5 rounded font-bold">You</span>
                                )}
                              </span>
                            </div>
                            <span className="text-xs font-bold font-mono text-rose-600 dark:text-rose-400">
                              ₹{Math.round(amount).toLocaleString('en-IN')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Expanded – nothing owed message */}
                  {isExpanded && debtors.length === 0 && (
                    <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-3 text-xs text-slate-400 bg-slate-50/50 dark:bg-slate-900/30">
                      ✅ Everyone has settled up with {isMe ? 'you' : person.name}.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
