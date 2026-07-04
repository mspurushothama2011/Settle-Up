export function calculateSettlements(expenses, profiles) {
  // 1. Initialize balances to 0 for all active group members
  const balances = {};
  profiles.forEach(p => {
    balances[p.id] = 0;
  });

  // 2. Iterate through expenses and modify balances
  expenses.forEach(exp => {
    const amount = parseFloat(exp.amount);
    const paidBy = exp.paid_by;
    const splitAmongst = exp.split_amongst;
    
    if (!splitAmongst || splitAmongst.length === 0) return;

    if (exp.is_payment) {
      // If it is a payment and it is NOT approved yet, ignore it in active balance math
      if (exp.approved === false) return;

      // For direct payments, the payer gets credited (their net debt is reduced)
      balances[paidBy] += amount;
      
      // The recipient (first element in split_amongst) gets debited
      const recipientId = splitAmongst[0];
      if (balances[recipientId] !== undefined) {
        balances[recipientId] -= amount;
      }
    } else {
      const share = amount / splitAmongst.length;
      
      // Payer is credited the full amount
      balances[paidBy] += amount;
      
      // Each participant is debited their individual share
      splitAmongst.forEach(participantId => {
        if (balances[participantId] !== undefined) {
          balances[participantId] -= share;
        }
      });
    }
  });

  // Round balances to 2 decimal places to prevent floating-point calculation artifacts
  Object.keys(balances).forEach(id => {
    balances[id] = parseFloat(balances[id].toFixed(2));
  });

  // Keep a copy of the final balances for reference
  const finalBalances = { ...balances };

  // 3. Separate into Debtors and Creditors
  const debtors = [];
  const creditors = [];

  Object.entries(balances).forEach(([id, val]) => {
    const profile = profiles.find(p => p.id === id);
    if (!profile) return;

    if (val < -0.01) {
      debtors.push({ id, name: profile.name, phone: profile.phone, balance: val });
    } else if (val > 0.01) {
      creditors.push({ id, name: profile.name, phone: profile.phone, balance: val });
    }
  });

  // Sort: Debtors ascending (largest debt first)
  // Creditors descending (largest credit first)
  debtors.sort((a, b) => a.balance - b.balance);
  creditors.sort((a, b) => b.balance - a.balance);

  const transactions = [];
  let debtIdx = 0;
  let credIdx = 0;

  // 4. Greedy Matching
  while (debtIdx < debtors.length && credIdx < creditors.length) {
    const debtor = debtors[debtIdx];
    const creditor = creditors[credIdx];

    const oweAmount = Math.abs(debtor.balance);
    const creditAmount = creditor.balance;

    const settleAmount = parseFloat(Math.min(oweAmount, creditAmount).toFixed(2));

    if (settleAmount > 0.01) {
      transactions.push({
        from: { id: debtor.id, name: debtor.name, phone: debtor.phone },
        to: { id: creditor.id, name: creditor.name, phone: creditor.phone },
        amount: settleAmount
      });
    }

    debtor.balance += settleAmount;
    creditor.balance -= settleAmount;

    if (Math.abs(debtor.balance) < 0.01) debtIdx++;
    if (Math.abs(creditor.balance) < 0.01) credIdx++;
  }

  return { transactions, balances: finalBalances };
}

// Calculates the exact 1-to-1 bilateral balance between currentUser and each friend
export function calculateBilateralBalances(expenses, currentUserStrId) {
  const bilateralBalances = {}; // friendId -> netBalance (positive means they owe Me, negative means Me owes them)

  expenses.forEach(exp => {
    const amount = parseFloat(exp.amount);
    const paidBy = exp.paid_by;
    const splitAmongst = exp.split_amongst || [];

    if (splitAmongst.length === 0) return;

    if (exp.is_payment) {
      // If it is a payment and it is NOT approved yet, ignore it in active balance math
      if (exp.approved === false) return;

      // Direct settlement payment
      const recipientId = splitAmongst[0];
      if (paidBy === currentUserStrId) {
        // I paid the friend
        bilateralBalances[recipientId] = (bilateralBalances[recipientId] || 0) - amount;
      } else if (recipientId === currentUserStrId) {
        // The friend paid me
        bilateralBalances[paidBy] = (bilateralBalances[paidBy] || 0) + amount;
      }
    } else {
      // Regular group split expense
      const share = amount / splitAmongst.length;

      if (paidBy === currentUserStrId) {
        // I paid for the expense
        // For each participant (excluding me), they owe me their share
        splitAmongst.forEach(participantId => {
          if (participantId !== currentUserStrId) {
            bilateralBalances[participantId] = (bilateralBalances[participantId] || 0) + share;
          }
        });
      } else {
        // Someone else paid
        // If I participated, I owe them my share
        if (splitAmongst.includes(currentUserStrId)) {
          bilateralBalances[paidBy] = (bilateralBalances[paidBy] || 0) - share;
        }
      }
    }
  });

  // Round values to 2 decimal places internally to preserve exact cents/paisa
  Object.keys(bilateralBalances).forEach(id => {
    bilateralBalances[id] = parseFloat(bilateralBalances[id].toFixed(2));
  });

  return bilateralBalances;
}
