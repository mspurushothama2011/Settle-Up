import React, { useState, useEffect, useRef } from 'react';
import { getSupabaseClient } from '../supabaseClient';
import { buildDirectDebts } from '../utils/settlementAlgorithm';
import {
  RefreshCw, AlertCircle, ArrowUpRight, ArrowDownLeft,
  Wallet, ChevronDown, ChevronUp, Send, CheckCircle2, Clock, History
} from 'lucide-react';

export default function BalancesView({ currentUser, refreshTrigger, onSettlementRecorded }) {
  const [expenses, setExpenses]         = useState([]);
  const [profiles, setProfiles]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [successMsg, setSuccessMsg]     = useState('');
  const [actionLoading, setActionLoading] = useState(null); // creditorId being settled
  const [activeSettle, setActiveSettle] = useState(null);   // creditorId with open form
  const [customAmount, setCustomAmount] = useState('');
  const [showHistory, setShowHistory]   = useState(false);
  const submittingRef = useRef(new Set());

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchData = async () => {
    setLoading(true);
    setError('');
    const supabase = getSupabaseClient();
    if (!supabase) return;
    try {
      const { data: pd, error: pe } = await supabase.from('profiles').select('*');
      if (pe) throw pe;
      setProfiles(pd || []);

      const { data: ed, error: ee } = await supabase
        .from('expenses').select('*').order('created_at', { ascending: false });
      if (ee) throw ee;
      setExpenses(ed || []);
    } catch (err) {
      setError('Could not load data: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [currentUser, refreshTrigger]);

  // ── Record settlement payment ──────────────────────────────────────────────
  const handleSettle = async (creditorId, maxAmount) => {
    const amt = parseFloat(customAmount);
    if (!amt || amt <= 0 || amt > maxAmount + 0.01) return;
    const key = `${currentUser.id}-${creditorId}`;
    if (submittingRef.current.has(key)) return;
    submittingRef.current.add(key);
    setActionLoading(creditorId);
    setError('');

    try {
      const supabase = getSupabaseClient();
      const creditor = profiles.find(p => p.id === creditorId);
      const { error: insertErr } = await supabase.from('expenses').insert([{
        description: `Settlement: ${currentUser.name} → ${creditor?.name}`,
        amount: parseFloat(amt.toFixed(2)),
        paid_by: currentUser.id,
        split_amongst: [creditorId],
        is_payment: true,
        approved: true,
      }]);
      if (insertErr) throw insertErr;

      setSuccessMsg(`✅ ₹${Math.round(amt)} paid to ${creditor?.name}`);
      setTimeout(() => setSuccessMsg(''), 4000);
      setActiveSettle(null);
      setCustomAmount('');
      fetchData();
      onSettlementRecorded?.();
    } catch (err) {
      setError('Failed to record payment: ' + (err.message || err));
    } finally {
      submittingRef.current.delete(key);
      setActionLoading(null);
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getName  = (id) => profiles.find(p => p.id === id)?.name || 'Unknown';
  const getInit  = (name) => name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);

  // ── Compute debts ──────────────────────────────────────────────────────────
  const { remaining, totalPaid } = buildDirectDebts(expenses, profiles);

  // Who owes ME (I am the creditor)
  const owedToMe = Object.entries(remaining[currentUser.id] || {})
    .filter(([, v]) => v > 0.01)
    .sort((a, b) => b[1] - a[1]);

  // Who I owe (they are the creditor)
  const iOwe = profiles
    .map(p => ({ id: p.id, amount: (remaining[p.id] || {})[currentUser.id] || 0 }))
    .filter(x => x.amount > 0.01)
    .sort((a, b) => b.amount - a.amount);

  // Settlement history (approved payments involving me)
  const history = expenses.filter(e =>
    e.is_payment && e.approved !== false &&
    (e.paid_by === currentUser.id || (e.split_amongst || []).includes(currentUser.id))
  );

  const myPaid   = totalPaid[currentUser.id] || 0;
  const totalOwedToMe = owedToMe.reduce((s, [, v]) => s + v, 0);
  const totalIOwe     = iOwe.reduce((s, x) => s + x.amount, 0);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400 text-sm gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" /> Loading balances…
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5 text-slate-900 dark:text-slate-100">

      {/* ── Error / Success banners ── */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 rounded-xl text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-semibold">
          {successMsg}
        </div>
      )}

      {/* ── My Spending Summary ── */}
      <div className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 p-5 rounded-xl shadow-sm flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">You Paid Out</p>
          <p className="text-2xl font-extrabold mt-1 font-mono">
            ₹{Math.round(myPaid).toLocaleString('en-IN')}
          </p>
          <div className="flex gap-4 mt-2 border-t border-white/10 dark:border-black/10 pt-2">
            <p className="text-xs opacity-60">
              Others owe you: <span className="font-bold font-mono text-emerald-400 dark:text-emerald-600">
                ₹{Math.round(totalOwedToMe).toLocaleString('en-IN')}
              </span>
            </p>
            <p className="text-xs opacity-60">
              You owe: <span className="font-bold font-mono text-rose-400 dark:text-rose-600">
                ₹{Math.round(totalIOwe).toLocaleString('en-IN')}
              </span>
            </p>
          </div>
        </div>
        <div className="p-3 bg-white/10 dark:bg-black/10 rounded-lg">
          <Wallet className="w-6 h-6" />
        </div>
      </div>

      {/* ── People who owe ME ── */}
      <section>
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-2">
          <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
          Others owe you ({owedToMe.length})
        </h3>

        {owedToMe.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
            No one owes you right now 🎉
          </div>
        ) : (
          <div className="space-y-3">
            {owedToMe.map(([debtorId, amount]) => {
              const name = getName(debtorId);
              const isOpen = activeSettle === debtorId;
              const parsedCustom = parseFloat(customAmount);
              const isValid = isOpen && parsedCustom > 0 && parsedCustom <= amount + 0.01;

              return (
                <div key={debtorId}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-sm overflow-hidden">

                  {/* Row */}
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center text-xs font-bold text-emerald-800 dark:text-emerald-300">
                        {getInit(name)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{name}</p>
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                          owes you ₹{Math.round(amount).toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (isOpen) { setActiveSettle(null); setCustomAmount(''); }
                        else { setActiveSettle(debtorId); setCustomAmount(String(Math.round(amount))); }
                      }}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                      {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Note: they need to pay you — no action needed here */}
                  {isOpen && (
                    <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-3 bg-slate-50/50 dark:bg-slate-900/30">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        💡 <strong>{name}</strong> should send you ₹{Math.round(amount).toLocaleString('en-IN')}. When they pay, record it below.
                      </p>
                      <div className="flex gap-2 mt-3">
                        <input
                          type="number"
                          min="1"
                          max={amount}
                          value={customAmount}
                          onChange={e => setCustomAmount(e.target.value)}
                          placeholder={`Max ₹${Math.round(amount)}`}
                          className={`flex-1 px-3 py-2 text-sm border rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none transition-colors ${
                            customAmount && !isValid
                              ? 'border-rose-400 focus:border-rose-500'
                              : 'border-slate-200 dark:border-slate-700 focus:border-slate-900 dark:focus:border-white'
                          }`}
                        />
                        <button
                          disabled={!isValid || actionLoading === debtorId}
                          onClick={() => handleSettle(currentUser.id, amount)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5">
                          {actionLoading === debtorId
                            ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            : <CheckCircle2 className="w-3.5 h-3.5" />}
                          Mark Received
                        </button>
                      </div>
                      {customAmount && !isValid && (
                        <p className="text-[11px] text-rose-500 mt-1">Max ₹{Math.round(amount)}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── People I owe ── */}
      <section>
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-2">
          <ArrowDownLeft className="w-3.5 h-3.5 text-rose-500" />
          You owe ({iOwe.length})
        </h3>

        {iOwe.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
            You don't owe anyone right now 🙌
          </div>
        ) : (
          <div className="space-y-3">
            {iOwe.map(({ id: creditorId, amount }) => {
              const name = getName(creditorId);
              const isOpen = activeSettle === creditorId;
              const parsedCustom = parseFloat(customAmount);
              const isValid = isOpen && parsedCustom > 0 && parsedCustom <= amount + 0.01;

              return (
                <div key={creditorId}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-sm overflow-hidden">

                  {/* Row */}
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center text-xs font-bold text-rose-800 dark:text-rose-300">
                        {getInit(name)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{name}</p>
                        <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold mt-0.5">
                          you owe ₹{Math.round(amount).toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (isOpen) { setActiveSettle(null); setCustomAmount(''); }
                        else { setActiveSettle(creditorId); setCustomAmount(String(Math.round(amount))); }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 text-xs font-semibold rounded-lg transition-colors">
                      <Send className="w-3.5 h-3.5" />
                      Settle Up
                      {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>

                  {/* Settle Up inline form */}
                  {isOpen && (
                    <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-3 bg-slate-50/50 dark:bg-slate-900/30">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                        Enter how much you are paying <strong>{name}</strong>:
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min="1"
                          max={amount}
                          value={customAmount}
                          onChange={e => setCustomAmount(e.target.value)}
                          placeholder={`Max ₹${Math.round(amount)}`}
                          className={`flex-1 px-3 py-2 text-sm border rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none transition-colors ${
                            customAmount && !isValid
                              ? 'border-rose-400 focus:border-rose-500'
                              : 'border-slate-200 dark:border-slate-700 focus:border-slate-900 dark:focus:border-white'
                          }`}
                        />
                        <button
                          disabled={!isValid || actionLoading === creditorId}
                          onClick={() => handleSettle(creditorId, amount)}
                          className="px-4 py-2 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-white dark:text-slate-900 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5">
                          {actionLoading === creditorId
                            ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            : <Send className="w-3.5 h-3.5" />}
                          Record
                        </button>
                      </div>
                      {customAmount && !isValid && (
                        <p className="text-[11px] text-rose-500 mt-1">Max ₹{Math.round(amount)}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Settlement History ── */}
      {history.length > 0 && (
        <section>
          <button
            onClick={() => setShowHistory(h => !h)}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
            <span className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Settlement History ({history.length})
            </span>
            {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showHistory && (
            <div className="mt-2 space-y-2">
              {history.map(e => {
                const fromMe = e.paid_by === currentUser.id;
                const otherId = fromMe ? (e.split_amongst || [])[0] : e.paid_by;
                const otherName = getName(otherId);
                const date = new Date(e.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                return (
                  <div key={e.id}
                    className="flex items-center justify-between p-3 bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-xl text-xs">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-slate-600 dark:text-slate-300">
                        {fromMe ? `You → ${otherName}` : `${otherName} → You`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold font-mono ${fromMe ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {fromMe ? '-' : '+'}₹{Math.round(parseFloat(e.amount)).toLocaleString('en-IN')}
                      </span>
                      <span className="text-slate-400">{date}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
