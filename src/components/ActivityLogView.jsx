import React, { useState, useEffect } from 'react';
import { getSupabaseClient } from '../supabaseClient';
import { RefreshCw, AlertCircle, ShieldCheck, History, Receipt, ChevronDown, ChevronUp, Edit2, Trash2, X, Users, CheckSquare, Square } from 'lucide-react';

export default function ActivityLogView({ currentUser, refreshTrigger }) {
  const [expenses, setExpenses] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Editing state
  const [editingExpense, setEditingExpense] = useState(null); // stores the expense object being edited
  const [editDescription, setEditDescription] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editSplitAmongst, setEditSplitAmongst] = useState([]);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

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

      // 2. Fetch all expenses (both payments and splits)
      const { data: expenseData, error: expenseErr } = await supabase
        .from('expenses')
        .select('*')
        .order('created_at', { ascending: false });

      if (expenseErr) throw expenseErr;
      setExpenses(expenseData || []);
    } catch (err) {
      console.error('Error fetching logs:', err);
      setError('Could not load transaction history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUser, refreshTrigger]);

  const toggleExpand = (id) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation(); // Prevent accordion toggling
    if (!window.confirm('Are you sure you want to permanently delete this transaction? This will revert all corresponding debt balances.')) {
      return;
    }

    setDeletingId(id);
    setError('');
    setSuccessMsg('');
    const supabase = getSupabaseClient();

    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setSuccessMsg('Transaction deleted successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
      
      // Close expanded tab if it was the deleted item
      if (expandedId === id) setExpandedId(null);
      
      fetchData();
    } catch (err) {
      console.error('Error deleting transaction:', err);
      setError('Failed to delete transaction. Ensure you have connection.');
    } finally {
      setDeletingId(null);
    }
  };

  const startEdit = (e, exp) => {
    e.stopPropagation(); // Prevent accordion toggling
    setEditingExpense(exp);
    setEditDescription(exp.description);
    setEditAmount(String(exp.amount));
    setEditSplitAmongst(exp.split_amongst || []);
    setError('');
  };

  const handleToggleParticipant = (profileId) => {
    if (editSplitAmongst.includes(profileId)) {
      setEditSplitAmongst(editSplitAmongst.filter((id) => id !== profileId));
    } else {
      setEditSplitAmongst([...editSplitAmongst, profileId]);
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editDescription.trim() || !editAmount.trim() || editSplitAmongst.length === 0) {
      alert('Please fill out all fields and select at least one participant.');
      return;
    }

    const amt = parseFloat(editAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid amount greater than 0.');
      return;
    }

    setSaving(true);
    const supabase = getSupabaseClient();

    try {
      const { error } = await supabase
        .from('expenses')
        .update({
          description: editDescription.trim(),
          amount: amt,
          split_amongst: editSplitAmongst
        })
        .eq('id', editingExpense.id);

      if (error) throw error;

      setSuccessMsg('Transaction updated successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
      setEditingExpense(null);
      fetchData();
    } catch (err) {
      console.error('Error updating transaction:', err);
      alert('Failed to update transaction: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getProfileName = (id) => {
    return profiles.find(p => p.id === id)?.name || 'Unknown';
  };

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100 max-w-4xl mx-auto">
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 text-red-650 dark:text-red-400 rounded-lg text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs font-semibold">
          {successMsg}
        </div>
      )}

      {/* Transaction History List */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-150">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <History className="w-4 h-4 text-slate-555 dark:text-slate-450" />
            Shared Transaction Log ({expenses.length})
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
          <div className="py-16 text-center text-xs text-slate-400 dark:text-slate-550">Loading activity...</div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-16 text-xs text-slate-400 dark:text-slate-550 border border-dashed border-slate-200 dark:border-slate-850 rounded-xl">
            No transactions recorded. Use the "Add Expense" tab to create one!
          </div>
        ) : (
          <div className="space-y-4">
            {expenses.map((exp) => {
              const isExpanded = expandedId === exp.id;
              const payerName = getProfileName(exp.paid_by);
              const isUserOwner = exp.paid_by === currentUser.id;
              
              const splitCount = exp.split_amongst ? exp.split_amongst.length : 1;
              const shareAmount = splitCount > 0 ? (parseFloat(exp.amount) / splitCount) : 0;

              return (
                <div
                  key={exp.id}
                  onClick={() => toggleExpand(exp.id)}
                  className={`border rounded-xl transition-all duration-155 cursor-pointer overflow-hidden ${
                    isExpanded 
                      ? 'border-slate-400 dark:border-slate-650 bg-slate-50/50 dark:bg-slate-900/30 shadow-sm' 
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700 bg-white dark:bg-slate-900/20'
                  }`}
                >
                  {/* Header Row */}
                  <div className="p-4 flex items-center justify-between">
                    <div className="min-w-0 flex-1 pr-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full flex items-center gap-1 ${
                          exp.is_payment
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-900/30'
                            : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-100/50 dark:border-indigo-900/30'
                        }`}>
                          {exp.is_payment ? (
                            <>
                              <ShieldCheck className="w-3 h-3" />
                              Settlement
                            </>
                          ) : (
                            <>
                              <Receipt className="w-3 h-3" />
                              Expense Split
                            </>
                          )}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold font-mono">
                          {formatDate(exp.created_at)}
                        </span>
                      </div>
                      
                      <p className="text-sm font-bold text-slate-900 dark:text-white mt-2 truncate">
                        {exp.description}
                      </p>
                      <p className="text-xs text-slate-550 dark:text-slate-400 mt-0.5">
                        Paid by <strong className="text-slate-700 dark:text-slate-300 font-semibold">{payerName} {isUserOwner ? '(You)' : ''}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-extrabold text-slate-900 dark:text-white font-mono">
                          ₹{Math.round(parseFloat(exp.amount))}
                        </p>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Expandable Split Details Panel */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-slate-150 dark:border-slate-800 bg-white dark:bg-slate-900/70 transition-all">
                      <div className="flex items-center justify-between mb-3 border-b border-slate-100 dark:border-slate-800/80 pb-2">
                        <p className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider">
                          Payment & Share Breakdown
                        </p>
                        
                        {/* Render edit/delete controls only if logged-in user is the owner (payer) */}
                        {isUserOwner && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => startEdit(e, exp)}
                              className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider"
                              title="Edit transaction details"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              Edit
                            </button>
                            <span className="text-slate-300 dark:text-slate-750 text-xs">|</span>
                            <button
                              onClick={(e) => handleDelete(e, exp.id)}
                              disabled={deletingId === exp.id}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider"
                              title="Delete transaction permanently"
                            >
                              {deletingId === exp.id ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-2 border-l-2 border-slate-200 dark:border-slate-800 pl-3">
                        <div className="text-xs text-slate-700 dark:text-slate-350">
                          💰 <span className="font-semibold text-slate-900 dark:text-white">{payerName}</span> paid a total of <strong>₹{Math.round(parseFloat(exp.amount))}</strong>.
                        </div>

                        {exp.is_payment ? (
                          <div className="text-xs text-slate-650 dark:text-slate-400">
                            ℹ️ This was a direct settlement payment to <span className="font-semibold text-slate-900 dark:text-white">{getProfileName(exp.split_amongst[0])}</span> to clear outstanding optimized debts.
                          </div>
                        ) : (
                          <div className="space-y-1.5 mt-2">
                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                              Shares for each participant (₹{Math.round(shareAmount)} each):
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                              {exp.split_amongst.map((participantId) => {
                                const name = getProfileName(participantId);
                                const isParticipantPayer = participantId === exp.paid_by;
                                
                                return (
                                  <div
                                    key={participantId}
                                    className={`p-2 rounded-lg border text-xs flex justify-between items-center ${
                                      isParticipantPayer
                                        ? 'border-emerald-100 dark:border-emerald-950 bg-emerald-50/20 dark:bg-emerald-950/10'
                                        : 'border-slate-150 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/30'
                                    }`}
                                  >
                                    <span className="truncate font-medium text-slate-700 dark:text-slate-350">
                                      {name} {participantId === currentUser.id ? '(You)' : ''}
                                    </span>
                                    <span className="font-semibold font-mono text-slate-900 dark:text-white">
                                      {isParticipantPayer ? (
                                        <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 px-1.5 py-0.5 rounded mr-1.5 font-sans font-semibold">
                                          Paid own share
                                        </span>
                                      ) : (
                                        <span className="text-[10px] bg-rose-50 dark:bg-rose-950/40 text-rose-650 dark:text-rose-400 px-1.5 py-0.5 rounded mr-1.5 font-sans font-semibold">
                                          owes
                                        </span>
                                      )}
                                      ₹{Math.round(shareAmount)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Transaction Modal */}
      {editingExpense && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setEditingExpense(null)}
              className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-850"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <Edit2 className="w-5 h-5" />
              Edit Transaction details
            </h3>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-2">
                  Description
                </label>
                <input
                  type="text"
                  required
                  placeholder="Pizza party, groceries, etc."
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:border-slate-900 dark:focus:border-white focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-455 uppercase tracking-wider mb-2">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:border-slate-900 dark:focus:border-white focus:outline-none font-mono font-semibold transition-all"
                />
              </div>

              {/* Only show split checklist if it is not a direct payment/settlement */}
              {!editingExpense.is_payment && (
                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-3 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    Adjust Split Participants
                  </label>
                  <div className="grid grid-cols-2 gap-2 border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30 p-4 rounded-xl max-h-40 overflow-y-auto">
                    {profiles.map((profile) => {
                      const isSelected = editSplitAmongst.includes(profile.id);
                      return (
                        <button
                          key={profile.id}
                          type="button"
                          onClick={() => handleToggleParticipant(profile.id)}
                          className={`flex items-center gap-2 p-2 border rounded-lg text-left text-xs font-semibold transition-all ${
                            isSelected
                              ? 'bg-white dark:bg-slate-800 border-slate-900 dark:border-white text-slate-900 dark:text-white shadow-sm'
                              : 'bg-transparent border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700 text-slate-450 dark:text-slate-500'
                          }`}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-3.5 h-3.5 text-slate-900 dark:text-white flex-shrink-0" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-slate-350 dark:text-slate-700 flex-shrink-0" />
                          )}
                          <span className="truncate">
                            {profile.name} {profile.id === currentUser.id ? '(You)' : ''}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingExpense(null)}
                  className="flex-1 py-2.5 border border-slate-200 dark:border-slate-750 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-lg text-xs font-bold uppercase transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-slate-900 dark:bg-white hover:bg-slate-850 dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
