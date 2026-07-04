import React, { useState, useEffect } from 'react';
import { getSupabaseClient } from '../supabaseClient';
import { Tag, User, Users, CheckSquare, Square, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';

export default function AddExpenseForm({ currentUser, onExpenseCreated }) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState(currentUser.id);
  const [splitAmongst, setSplitAmongst] = useState([]);
  const [profiles, setProfiles] = useState([]);
  
  const [fetching, setFetching] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const fetchProfiles = async () => {
    setFetching(true);
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;

      setProfiles(data || []);
      setSplitAmongst((data || []).map((p) => p.id));
    } catch (err) {
      console.error('Error loading profiles:', err);
      setError('Failed to load group members.');
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, [currentUser]);

  const handlePayerChange = (e) => {
    setPaidBy(e.target.value);
  };

  const handleToggleParticipant = (profileId) => {
    if (splitAmongst.includes(profileId)) {
      setSplitAmongst(splitAmongst.filter((id) => id !== profileId));
    } else {
      setSplitAgainst([...splitAmongst, profileId]);
    }
  };

  const setSplitAgainst = (newSplit) => {
    setSplitAmongst(newSplit);
  };

  const handleSelectAll = () => {
    setSplitAmongst(profiles.map((p) => p.id));
  };

  const handleSelectNone = () => {
    setSplitAmongst([]);
  };

  const numericAmount = parseFloat(amount) || 0;
  const participantCount = splitAmongst.length;
  const shareAmount = participantCount > 0 ? (numericAmount / participantCount) : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!description.trim()) {
      setError('Please enter a description (e.g. Pizza dinner).');
      return;
    }

    if (numericAmount <= 0) {
      setError('Please enter a valid amount greater than 0.');
      return;
    }

    if (splitAmongst.length === 0) {
      setError('Please select at least one person to split the expense with.');
      return;
    }

    setSubmitting(true);
    const supabase = getSupabaseClient();

    try {
      const { error: expenseError } = await supabase
        .from('expenses')
        .insert([
          {
            description: description.trim(),
            amount: numericAmount,
            paid_by: paidBy,
            split_amongst: splitAmongst,
            is_payment: false
          }
        ]);

      if (expenseError) throw expenseError;

      setSuccess(true);
      setDescription('');
      setAmount('');
      setSplitAmongst(profiles.map((p) => p.id));
      
      if (onExpenseCreated) onExpenseCreated();
    } catch (err) {
      console.error('Error creating expense:', err);
      setError(err.message || 'Failed to submit expense. Please check connection.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-slate-900 dark:text-slate-100 transition-colors duration-150">
      <div className="flex items-center gap-2 mb-6">
        <Sparkles className="w-5 h-5 text-slate-800 dark:text-slate-200" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Record a New Expense</h2>
      </div>

      {error && (
        <div className="mb-5 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 text-red-650 dark:text-red-450 rounded-lg text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-5 p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs font-semibold">
          Expense logged successfully! Optimized settlements have been updated.
        </div>
      )}

      {fetching ? (
        <div className="text-center py-8 text-sm text-slate-400 dark:text-slate-550">
          Loading group members...
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Description Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-2">
              Expense Description
            </label>
            <div className="relative">
              <Tag className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                required
                placeholder="e.g. Pizza party, Uber cab, Grocery"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:border-slate-900 dark:focus:border-white focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Amount and Payer Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Amount */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-2">
                Total Amount (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-sm font-semibold text-slate-500 dark:text-slate-400">₹</span>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:border-slate-900 dark:focus:border-white focus:outline-none font-semibold transition-colors"
                />
              </div>
            </div>

            {/* Paid By */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-2">
                Paid By
              </label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 dark:text-slate-500" />
                <select
                  value={paidBy}
                  onChange={handlePayerChange}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:border-slate-900 dark:focus:border-white focus:outline-none font-medium transition-colors appearance-none cursor-pointer"
                >
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.id === currentUser.id ? '(You)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Split Amongst Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-455 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                Split Amongst
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-[10px] font-bold text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white uppercase transition-colors"
                >
                  All
                </button>
                <span className="text-slate-300 dark:text-slate-700 text-xs">|</span>
                <button
                  type="button"
                  onClick={handleSelectNone}
                  className="text-[10px] font-bold text-slate-500 hover:text-slate-955 dark:text-slate-400 dark:hover:text-white uppercase transition-colors"
                >
                  None
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30 p-4 rounded-xl max-h-48 overflow-y-auto">
              {profiles.map((profile) => {
                const isSelected = splitAmongst.includes(profile.id);
                return (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => handleToggleParticipant(profile.id)}
                    className={`flex items-center gap-3 p-2.5 border rounded-lg text-left text-xs font-semibold transition-all ${
                      isSelected
                        ? 'bg-white dark:bg-slate-800 border-slate-900 dark:border-white text-slate-900 dark:text-white shadow-sm'
                        : 'bg-transparent border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-400 dark:text-slate-500 hover:text-slate-650 dark:hover:text-slate-350'
                    }`}
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-slate-900 dark:text-white flex-shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-300 dark:text-slate-700 flex-shrink-0" />
                    )}
                    <span className="truncate">
                      {profile.name} {profile.id === currentUser.id ? '(You)' : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mathematical share preview */}
          {numericAmount > 0 && participantCount > 0 && (
            <div className="p-4 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-semibold">
              <span className="text-slate-900 dark:text-slate-200">Calculation Preview:</span>
              <ul className="mt-2 space-y-1 font-mono text-[11px] font-normal">
                <li>Total Split: ₹{numericAmount.toFixed(2)} split among {participantCount} people.</li>
                <li>Individual Share: <strong className="text-slate-950 dark:text-slate-200">₹{shareAmount.toFixed(2)}</strong> each.</li>
                <li className="text-slate-500 dark:text-slate-500 mt-2 italic font-sans font-medium">
                  {splitAmongst.filter(id => id !== paidBy).length === 0 ? (
                    "No debt adjustments will occur since only the payer is selected in the split."
                  ) : (
                    <>
                      This expense will be added to the shared ledger and dynamically optimized.
                    </>
                  )}
                </li>
              </ul>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 font-semibold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Log Expense & Generate IOUs'}
          </button>
        </form>
      )}
    </div>
  );
}
