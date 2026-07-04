import React, { useState, useEffect, useRef } from 'react';
import { getSupabaseClient } from '../supabaseClient';
import { calculateSettlements } from '../utils/settlementAlgorithm';
import { RefreshCw, AlertCircle, ArrowUpRight, ArrowDownLeft, Landmark, ShieldCheck, History, X, Check } from 'lucide-react';

export default function BalancesView({ currentUser, refreshTrigger, onSettlementRecorded }) {
  const [expenses, setExpenses] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Lock to prevent double-clicks and multiple concurrent submissions
  const submittingKeysRef = useRef(new Set());

  // Settle form inputs
  const [activeSettleKey, setActiveSettleKey] = useState(null); // stores 'debtorId-creditorId' of active custom settle form
  const [customAmount, setCustomAmount] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      // 1. Fetch profiles
      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('*');

      if (profileErr) throw profileErr;
      setProfiles(profileData || []);

      // 2. Fetch all expenses
      const { data: expenseData, error: expenseErr } = await supabase
        .from('expenses')
        .select('*')
        .order('created_at', { ascending: false });

      if (expenseErr) throw expenseErr;
      setExpenses(expenseData || []);
    } catch (err) {
      console.error('Error fetching balances:', err);
      setError('Could not load ledger data from database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUser, refreshTrigger]);

  const handleSettleDebt = async (debtorId, creditorId, amount, totalOutstanding) => {
    setError('');
    setSuccessMsg('');

    const actionKey = `${debtorId}-${creditorId}`;
    
    // Prevent double clicks (only allow running once per action key)
    if (submittingKeysRef.current.has(actionKey)) {
      console.warn('Submission already in progress for this settlement. Blocking duplicate click.');
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('Please enter a valid amount greater than 0.');
      return;
    }

    if (numericAmount > totalOutstanding + 0.01) {
      setError(`Settle amount cannot exceed the outstanding debt of ₹${totalOutstanding.toFixed(2)}.`);
      return;
    }
    
    submittingKeysRef.current.add(actionKey);
    setActionLoadingId(actionKey);
    const supabase = getSupabaseClient();

    const debtorName = profiles.find(p => p.id === debtorId)?.name || 'Debtor';
    const creditorName = profiles.find(p => p.id === creditorId)?.name || 'Creditor';

    // If the recipient of the money (creditorId) is recording this, it's pre-approved.
    // Otherwise, if the sender is recording, it requires receiver approval.
    const isPreApproved = creditorId === currentUser.id;

    try {
      const { error } = await supabase
        .from('expenses')
        .insert([
          {
            description: `Payment: ${debtorName} paid ${creditorName}`,
            amount: numericAmount,
            paid_by: debtorId,
            split_amongst: [creditorId],
            is_payment: true,
            approved: isPreApproved
          }
        ]);

      if (error) throw error;

      if (isPreApproved) {
        setSuccessMsg(`Settlement of ₹${numericAmount.toFixed(2)} recorded successfully!`);
      } else {
        setSuccessMsg(`Settlement of ₹${numericAmount.toFixed(2)} submitted! Awaiting ${creditorName}'s approval.`);
      }
      setTimeout(() => setSuccessMsg(''), 3000);
      
      // Close settle form and refresh
      setActiveSettleKey(null);
      if (onSettlementRecorded) onSettlementRecorded();
      fetchData();
    } catch (err) {
      console.error('Error recording settlement:', err);
      let errMsg = err.message || 'Failed to record settlement.';
      if (errMsg.includes('column') && (errMsg.includes('approved') || errMsg.includes('is_payment'))) {
        errMsg = "Database Error: Please run the SQL command in Supabase to add the missing 'approved' or 'is_payment' columns, then run: NOTIFY pgrst, 'reload schema';";
      }
      setError(errMsg);
    } finally {
      setActionLoadingId(null);
      submittingKeysRef.current.delete(actionKey);
    }
  };

  const handleConfirmPayment = async (id) => {
    setError('');
    setSuccessMsg('');
    const supabase = getSupabaseClient();

    try {
      const { error } = await supabase
        .from('expenses')
        .update({ approved: true })
        .eq('id', id);

      if (error) throw error;

      setSuccessMsg('Payment confirmed successfully! Balances updated.');
      setTimeout(() => setSuccessMsg(''), 3000);
      
      if (onSettlementRecorded) onSettlementRecorded();
      fetchData();
    } catch (err) {
      console.error('Error confirming payment:', err);
      let errMsg = err.message || 'Failed to confirm payment.';
      if (errMsg.includes('column') && errMsg.includes('approved')) {
        errMsg = "Database Error: Please run the SQL command in Supabase to add the 'approved' column, then run: NOTIFY pgrst, 'reload schema';";
      }
      setError(errMsg);
    }
  };

  const handleDeclinePayment = async (id) => {
    if (!window.confirm('Are you sure you want to decline and remove this payment claim?')) return;
    
    setError('');
    setSuccessMsg('');
    const supabase = getSupabaseClient();

    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setSuccessMsg('Payment claim declined and removed.');
      setTimeout(() => setSuccessMsg(''), 3000);
      
      if (onSettlementRecorded) onSettlementRecorded();
      fetchData();
    } catch (err) {
      console.error('Error declining payment:', err);
      setError(err.message || 'Failed to decline payment.');
    }
  };

  const startCustomSettle = (actionKey, defaultAmount) => {
    setActiveSettleKey(actionKey);
    setCustomAmount(defaultAmount.toFixed(2));
    setError('');
  };

  // Run optimization algorithm
  const { transactions: allSettlements } = calculateSettlements(expenses, profiles);

  // Filter settlements to show only those involving the current user
  const myActiveSettlements = allSettlements.filter(
    (t) => t.from.id === currentUser.id || t.to.id === currentUser.id
  );

  // Filter unapproved payments involving the active user
  const pendingIncoming = expenses.filter(
    (exp) => exp.is_payment && exp.approved === false && exp.split_amongst && exp.split_amongst[0] === currentUser.id
  );

  const pendingOutgoing = expenses.filter(
    (exp) => exp.is_payment && exp.approved === false && exp.paid_by === currentUser.id
  );

  // Filter expenses to find completed settlement payments involving the current user
  const settledHistory = expenses.filter(
    (exp) => exp.is_payment && exp.approved === true && (exp.paid_by === currentUser.id || (exp.split_amongst && exp.split_amongst.includes(currentUser.id)))
  );

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getProfileName = (id) => {
    return profiles.find(p => p.id === id)?.name || 'Unknown';
  };

  return (
    <div className="space-y-8 text-slate-900 dark:text-slate-100 max-w-5xl mx-auto">
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 text-red-650 dark:text-red-400 rounded-lg text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-450 rounded-lg text-xs font-semibold">
          {successMsg}
        </div>
      )}

      {/* 1. Net Balances Overview Grid */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-150">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Landmark className="w-4 h-4 text-slate-555 dark:text-slate-400" />
            Net Balances Grid
          </h2>
          <button
            onClick={fetchData}
            disabled={loading}
            className="text-slate-455 hover:text-slate-655 dark:text-slate-500 dark:hover:text-slate-350 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400 dark:text-slate-555">Recalculating balances...</div>
        ) : myActiveSettlements.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-455 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-850 rounded-xl font-semibold">
            🎉 You are fully settled up! No outstanding balances.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {myActiveSettlements.map((settlement, idx) => {
              const iOwe = settlement.from.id === currentUser.id;
              const otherParty = iOwe ? settlement.to : settlement.from;
              const absAmount = Math.round(settlement.amount);

              return (
                <div
                  key={idx}
                  className={`p-5 border rounded-xl flex items-center justify-between shadow-sm transition-all hover:-translate-y-0.5 ${
                    !iOwe
                      ? 'bg-emerald-50/20 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-900/40'
                      : 'bg-rose-50/10 dark:bg-rose-950/10 border-rose-100 dark:border-rose-900/40'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-slate-800 dark:text-white truncate">
                      {otherParty.name}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-555 mt-1 font-mono truncate">{otherParty.phone}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-base font-extrabold flex items-center justify-end gap-1 ${
                      !iOwe ? 'text-emerald-700 dark:text-emerald-450' : 'text-rose-650 dark:text-rose-455'
                    }`}>
                      {!iOwe ? <ArrowUpRight className="w-4.5 h-4.5" /> : <ArrowDownLeft className="w-4.5 h-4.5" />}
                      ₹{absAmount}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-555 uppercase mt-1">
                      {!iOwe ? 'owes you' : 'you owe'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Settlement Approvals Section */}
      {(pendingIncoming.length > 0 || pendingOutgoing.length > 0) && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-155">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-slate-555 dark:text-slate-455" />
            Pending Approvals ({pendingIncoming.length + pendingOutgoing.length})
          </h2>

          <div className="space-y-3">
            {/* Incoming approvals: Waiting for active user to approve receipt */}
            {pendingIncoming.map((payment) => {
              const senderName = getProfileName(payment.paid_by);
              return (
                <div
                  key={payment.id}
                  className="p-4 bg-amber-50/10 dark:bg-amber-950/10 border border-amber-200/50 dark:border-amber-900/30 rounded-xl flex items-center justify-between animate-fadeIn"
                >
                  <div className="min-w-0 pr-3">
                    <p className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wide">
                      Awaiting Your Confirmation
                    </p>
                    <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">
                      <span className="font-semibold text-slate-900 dark:text-white">{senderName}</span> claims they paid you <span className="font-bold text-slate-900 dark:text-white font-mono">₹{Math.round(parseFloat(payment.amount))}</span>.
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleConfirmPayment(payment.id)}
                      className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold uppercase transition-colors"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => handleDeclinePayment(payment.id)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-205 dark:bg-slate-850 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold uppercase transition-colors"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Outgoing approvals: Waiting for receiver to approve receipt */}
            {pendingOutgoing.map((payment) => {
              const recipientName = getProfileName(payment.split_amongst ? payment.split_amongst[0] : '');
              return (
                <div
                  key={payment.id}
                  className="p-4 bg-slate-50/40 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-850 rounded-xl flex items-center justify-between opacity-80 animate-fadeIn"
                >
                  <p className="text-xs text-slate-650 dark:text-slate-400">
                    You recorded a payment of <span className="font-bold font-mono text-slate-900 dark:text-white">₹{Math.round(parseFloat(payment.amount))}</span> to <span className="font-semibold">{recipientName}</span> (Awaiting recipient confirmation).
                  </p>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex-shrink-0 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                    Awaiting Approval
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. active settlements & history grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Active Optimized Settlement Actions */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-150">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-6 flex items-center gap-2">
            <Landmark className="w-4 h-4 text-slate-550 dark:text-slate-400" />
            Optimized Settlement Routes ({myActiveSettlements.length})
          </h2>

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400 dark:text-slate-555">Loading routes...</div>
          ) : myActiveSettlements.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-400 dark:text-slate-555 border border-dashed border-slate-200 dark:border-slate-850 rounded-lg">
              No routes available. All settled up!
            </div>
          ) : (
            <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
              {myActiveSettlements.map((settlement, idx) => {
                const iOwe = settlement.from.id === currentUser.id;
                const otherParty = iOwe ? settlement.to : settlement.from;
                const actionKey = `${settlement.from.id}-${settlement.to.id}`;
                const isFormActive = activeSettleKey === actionKey;

                // Check lock state
                const isSubmitting = submittingKeysRef.current.has(actionKey) || actionLoadingId === actionKey;

                // Validate custom amount entered (decimals allowed in float, bounds checked)
                const enteredVal = parseFloat(customAmount) || 0;
                const isAmountInvalid = enteredVal <= 0 || enteredVal > settlement.amount + 0.01;
                const roundedLimit = Math.round(settlement.amount);

                return (
                  <div
                    key={idx}
                    className={`p-4 border rounded-xl bg-white dark:bg-slate-900/50 transition-colors duration-155 ${
                      isFormActive ? 'border-slate-400 dark:border-slate-655 bg-slate-50/20 dark:bg-slate-900/30' : 'border-slate-200 dark:border-slate-850'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1 pr-3">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {iOwe ? (
                            <>
                              You pay <span className="text-rose-650 dark:text-rose-455">{otherParty.name}</span>
                            </>
                          ) : (
                            <>
                              <span className="text-emerald-700 dark:text-emerald-455">{otherParty.name}</span> pays you
                            </>
                          )}
                        </p>
                        <p className="text-xs text-slate-455 dark:text-slate-500 mt-1 font-mono">
                          {otherParty.phone}
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="text-sm font-extrabold font-mono text-slate-900 dark:text-white">
                          ₹{roundedLimit}
                        </span>
                        
                        {!isFormActive ? (
                          <button
                            onClick={() => startCustomSettle(actionKey, settlement.amount)}
                            disabled={isSubmitting}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase shadow-sm transition-colors ${
                              iOwe
                                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            Settle Up
                          </button>
                        ) : (
                          <button
                            onClick={() => setActiveSettleKey(null)}
                            className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-850 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Inline Custom Amount Input Form */}
                    {isFormActive && (
                      <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
                        <div className="flex-1">
                          <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-455 uppercase mb-1">
                            Settle Amount (₹)
                          </label>
                          <div className="relative max-w-[150px]">
                            <span className="absolute left-2.5 top-1.5 text-xs text-slate-400">₹</span>
                            <input
                              type="number"
                              required
                              step="0.01"
                              min="0.01"
                              max={settlement.amount}
                              value={customAmount}
                              onChange={(e) => setCustomAmount(e.target.value)}
                              disabled={isSubmitting}
                              className={`w-full pl-6 pr-2 py-1 border rounded-lg text-xs font-mono font-semibold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none transition-colors ${
                                isAmountInvalid 
                                  ? 'border-rose-450 focus:border-rose-500' 
                                  : 'border-slate-205 dark:border-slate-750 focus:border-slate-900 dark:focus:border-white'
                              }`}
                            />
                          </div>
                          {isAmountInvalid && (
                            <p className="text-[9px] text-rose-650 dark:text-rose-455 font-semibold mt-1">
                              * Amount cannot exceed ₹{settlement.amount.toFixed(2)}.
                            </p>
                          )}
                        </div>

                        <button
                          onClick={() => handleSettleDebt(settlement.from.id, settlement.to.id, customAmount, settlement.amount)}
                          disabled={isSubmitting || isAmountInvalid}
                          className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white disabled:text-slate-400 rounded-lg text-xs font-bold uppercase transition-colors shadow-sm flex items-center justify-center gap-1 self-end sm:self-center"
                        >
                          {isSubmitting ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              Record
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Settled History (Completed Payments) */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-850 shadow-sm transition-colors duration-150">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-6 flex items-center gap-2">
            <History className="w-4 h-4 text-slate-555 dark:text-slate-400" />
            Settled History ({settledHistory.length})
          </h2>

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400 dark:text-slate-555">Loading history...</div>
          ) : settledHistory.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-400 dark:text-slate-555 border border-dashed border-slate-200 dark:border-slate-850 rounded-lg">
              No settled transactions yet.
            </div>
          ) : (
            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {settledHistory.map((payment) => {
                const isPayer = payment.paid_by === currentUser.id;
                const recipientId = payment.split_amongst ? payment.split_amongst[0] : '';
                const otherPartyName = isPayer 
                  ? (profiles.find(p => p.id === recipientId)?.name || 'Someone')
                  : (profiles.find(p => p.id === payment.paid_by)?.name || 'Someone');

                return (
                  <div
                    key={payment.id}
                    className="p-3 bg-slate-50/30 dark:bg-slate-900/20 border border-slate-150 dark:border-slate-855 rounded-xl flex items-center justify-between opacity-80"
                  >
                    <div className="min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold uppercase bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-450 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Settled Payment
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-555 font-semibold font-mono">
                          {formatDate(payment.created_at)}
                        </span>
                      </div>
                      
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-2 truncate">
                        {isPayer ? `You paid ${otherPartyName}` : `${otherPartyName} paid you`}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-550 truncate">
                        {payment.description}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 font-mono">
                        ₹{Math.round(parseFloat(payment.amount))}
                      </p>
                    </div>
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
