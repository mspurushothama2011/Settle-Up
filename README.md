# 💸 Settle-Up (SplitIt) — Real-Time Group Expense & Trip Budget Tracker

A full-stack, real-time group expense management web application built with **React 19**, **Tailwind CSS v4**, and **Supabase**. Settle-Up eliminates messy spreadsheets on group trips by automatically calculating bilateral debts, tracking live trip budgets, and syncing settlements across all members in real time.

---

## ✨ Key Features

### 1. Pairwise Debt & Settlement Engine
- **Bilateral Netting (`buildDirectDebts`)**: Automatically computes exact net balances between every pair of members, offsetting mutual expenses and partial payments.
- **Zero-Conflict Settlement Controls**: Supports both full and partial settlements from either side ("You Owe" or "Owes You") with isolated form state and instant balance recalculation.
- **Cash-Flow Minimization (`simplifyDebts`)**: Includes a greedy graph-reduction algorithm to compute the minimum number of transactions required to settle the entire group.

### 2. Auto-Calculated Trip Budget Summary
- **Live Group Expenditure**: Dynamically sums all non-settlement expenses to display the total trip cost in real time.
- **Fair Share Breakdown**: Calculates the exact per-person fair share (`Total Trip Spending ÷ Member Count`) alongside your personal spend and transaction count.
- **Who Paid What Progress Bars**: Visualizes every member's total contribution with color-coded over/under badges (`+₹` owed back, `-₹` underpaid, or `✓` settled).

### 3. Flexible Expense Splitting & Activity Log
- **Custom Participant Selection**: Split bills equally across the whole group or select a custom subset of participants for specific meals, cabs, or activities.
- **Complete Audit Trail**: Chronological activity feed separating standard expenses from settlement payments, with inline editing and deletion permissions.

### 4. Real-Time Multi-User Sync & Dark Mode
- **Supabase Realtime Subscriptions**: Listens to `postgres_changes` on `profiles` and `expenses` tables so every participant's screen updates live without manual refreshes.
- **Persistent Dark Mode**: Full light/dark theme toggle persisted locally.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 19, Vite 8 |
| **Styling** | Tailwind CSS v4, Lucide React Icons |
| **Backend & Database** | Supabase (PostgreSQL, Realtime Channels) |
| **Tooling** | Oxlint, PostCSS |

---

## 📂 Project Structure

```text
split-money-website/
├── src/
│   ├── components/
│   │   ├── ActivityLogView.jsx    # Chronological expense & settlement feed with edit/delete
│   │   ├── AddExpenseForm.jsx     # Expense creation with custom participant splitting
│   │   ├── AuthScreen.jsx         # Member login, registration, and profile selection
│   │   ├── BalancesView.jsx       # Personal & group-wide pairwise debt dashboard
│   │   ├── DatabaseSetup.jsx      # Interactive Supabase credentials setup & schema guide
│   │   └── FriendManager.jsx      # Auto-calculated Trip Summary & group member directory
│   ├── utils/
│   │   └── settlementAlgorithm.js # Pairwise bilateral debt & cash-flow minimization algorithms
│   ├── App.jsx                    # Root layout, tab navigation, and Supabase Realtime listeners
│   ├── supabaseClient.js          # Dynamic Supabase client initialization
│   └── main.jsx                   # Application entry point
├── index.html
├── package.json
└── vite.config.js
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18 or higher)
- A **Supabase** project (free tier works out of the box)

### 1. Clone the Repository
```bash
git clone https://github.com/mspurushothama2011/Settle-Up.git
cd Settle-Up
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create a `.env` file in the project root with your Supabase credentials (or configure them directly in the app's setup screen):
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Database Schema Setup (Supabase SQL Editor)
Run the following SQL in your Supabase SQL Editor to create the required tables and enable Realtime:
```sql
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  pin text,
  created_at timestamptz default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  amount numeric not null,
  paid_by uuid references public.profiles(id) on delete cascade,
  split_among jsonb not null default '[]'::jsonb,
  is_payment boolean default false,
  status text default 'approved',
  created_at timestamptz default now()
);

alter publication supabase_realtime add table public.profiles, public.expenses;
```

### 5. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📦 Production Build

```bash
npm run build
npm run preview
```
