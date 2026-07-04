import React, { useState, useEffect } from 'react';
import { getSupabaseConfig, clearSupabaseConfig, getSupabaseClient } from './supabaseClient';
import DatabaseSetup from './components/DatabaseSetup';
import AuthScreen from './components/AuthScreen';
import BalancesView from './components/BalancesView';
import ActivityLogView from './components/ActivityLogView';
import AddExpenseForm from './components/AddExpenseForm';
import FriendManager from './components/FriendManager';
import { LogOut, Database, PlusCircle, Users, Sun, Moon, Wallet, History } from 'lucide-react';

export default function App() {
  const [dbConfigured, setDbConfigured] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('balances'); // 'balances', 'activity', 'add-expense', 'friends'
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [darkMode, setDarkMode] = useState(false);

  // Initialize DB configuration status & Current User Session
  useEffect(() => {
    // 1. Check if Supabase URL and key are provided
    const config = getSupabaseConfig();
    setDbConfigured(config.isConfigured);

    // 2. Check if a user session is active
    const savedUser = localStorage.getItem('splitit_current_user');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {
        console.error('Failed to parse active user session:', e);
        localStorage.removeItem('splitit_current_user');
      }
    }

    // 3. Load Dark Mode preference
    const savedDark = localStorage.getItem('splitit_dark_mode') === 'true';
    setDarkMode(savedDark);
    if (savedDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // Set up Realtime listeners to automatically refresh local state on remote database changes
  useEffect(() => {
    if (!dbConfigured) return;

    const supabase = getSupabaseClient();
    if (!supabase) return;

    // Listen to changes on the expenses table (inserts, updates, deletes)
    const expensesChannel = supabase
      .channel('expenses-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expenses' },
        (payload) => {
          console.log('Realtime change on expenses detected:', payload);
          setRefreshTrigger((prev) => prev + 1);
        }
      )
      .subscribe();

    // Listen to changes on the profiles table (group directory changes)
    const profilesChannel = supabase
      .channel('profiles-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        (payload) => {
          console.log('Realtime change on profiles detected:', payload);
          setRefreshTrigger((prev) => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(expensesChannel);
      supabase.removeChannel(profilesChannel);
    };
  }, [dbConfigured]);

  const handleDbConfigured = () => {
    setDbConfigured(true);
  };

  const handleLoginSuccess = (user) => {
    localStorage.setItem('splitit_current_user', JSON.stringify(user));
    setCurrentUser(user);
    setActiveTab('balances');
  };

  const handleLogout = () => {
    localStorage.removeItem('splitit_current_user');
    setCurrentUser(null);
  };

  const toggleDarkMode = () => {
    const newVal = !darkMode;
    setDarkMode(newVal);
    localStorage.setItem('splitit_dark_mode', String(newVal));
    if (newVal) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Callback to force child components to refresh their database queries
  const triggerRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  // If Database is not configured, show Setup Wizard
  if (!dbConfigured) {
    return <DatabaseSetup onConfigured={handleDbConfigured} />;
  }

  // If User is not logged in, show Passwordless login screen
  if (!currentUser) {
    return <AuthScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-150 antialiased flex flex-col font-sans">
      {/* Top Banner Navigation */}
      <header className="sticky top-0 z-10 w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-150">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          
          {/* Logo & Identity */}
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-extrabold text-lg tracking-tighter shadow-md">
              $I
            </div>
            <span className="font-extrabold text-lg tracking-tight">SplitIt</span>
            <span className="hidden sm:inline px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-550 dark:text-slate-400 text-[10px] font-bold rounded-full uppercase tracking-wider border border-slate-200/50 dark:border-slate-700/50">
              Ledger Mode
            </span>
          </div>

          {/* User Session Profile & Controls */}
          <div className="flex items-center gap-4">
            <div className="hidden md:block text-right">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Active User
              </p>
              <p className="text-sm font-bold text-slate-900 dark:text-white font-sans">
                {currentUser.name}
              </p>
            </div>

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Toggle theme"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout Area */}
      <main className="max-w-6xl w-full mx-auto px-6 py-8 flex-1 flex flex-col">
        
        {/* Navigation Tabs */}
        <div className="flex justify-center mb-8">
          <nav className="inline-flex p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
            <button
              onClick={() => setActiveTab('balances')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase rounded-lg transition-all ${
                activeTab === 'balances'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <Wallet className="w-4 h-4" />
              Balances
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase rounded-lg transition-all ${
                activeTab === 'activity'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <History className="w-4 h-4" />
              Activity Log
            </button>
            <button
              onClick={() => setActiveTab('add-expense')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase rounded-lg transition-all ${
                activeTab === 'add-expense'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              Add Expense
            </button>
            <button
              onClick={() => setActiveTab('friends')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase rounded-lg transition-all ${
                activeTab === 'friends'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              Members
            </button>
          </nav>
        </div>

        {/* Tab Contents */}
        <div className="flex-1">
          {activeTab === 'balances' && (
            <BalancesView
              currentUser={currentUser}
              refreshTrigger={refreshTrigger}
              onSettlementRecorded={triggerRefresh}
            />
          )}

          {activeTab === 'activity' && (
            <ActivityLogView
              currentUser={currentUser}
              refreshTrigger={refreshTrigger}
            />
          )}

          {activeTab === 'add-expense' && (
            <AddExpenseForm
              currentUser={currentUser}
              onExpenseCreated={triggerRefresh}
            />
          )}

          {activeTab === 'friends' && (
            <FriendManager
              currentUser={currentUser}
              onFriendAdded={triggerRefresh}
            />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-6 text-center border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors duration-150 mt-auto">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
          SplitIt Expense Ledger &copy; {new Date().getFullYear()} — Premium High-Contrast Ledger System
        </p>
      </footer>
    </div>
  );
}
