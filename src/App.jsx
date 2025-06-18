import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom/client'; // Import ReactDOM client
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { getFirestore, doc, addDoc, setDoc, onSnapshot, collection, query, deleteDoc, writeBatch, serverTimestamp, updateDoc, setLogLevel } from 'firebase/firestore';
import { PlusCircle, TrendingUp, TrendingDown, Users, X, Trash2, Edit3, LogOut, UserPlus, LogIn, AlertTriangle, BarChart2, Eye, EyeOff, FileText, Search } from 'lucide-react';

// --- Firebase Configuration ---
// Make sure this configuration is correct for your Firebase project.
// In a real PWA, consider using environment variables for sensitive keys.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const appId = 'money-tracker-data'; // This acts as a unique identifier for your app's data within Firestore.

// --- Helper Functions ---
// Formats a number into Indian Rupee currency string.
const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);

// Formats a date object or Firestore Timestamp to YYYY-MM-DD for input[type=date].
const formatDate = (date) => {
  if (!date) return 'N/A';
  const d = date instanceof Date ? date : date.toDate ? date.toDate() : new Date(date);
  return d.toLocaleDateString('en-CA'); // Format: YYYY-MM-DD
};

// Formats a date for general display based on local locale.
const formatDateForDisplay = (date) => {
  if (!date) return 'N/A';
  const d = date instanceof Date ? date : date.toDate ? date.toDate() : new Date(date);
  return d.toLocaleDateString(); // Default locale for display
};

// Date range helper functions
const getStartOfDay = (date = new Date()) => { const d = new Date(date); d.setHours(0, 0, 0, 0); return d; };
const getEndOfDay = (date = new Date()) => { const d = new Date(date); d.setHours(23, 59, 59, 999); return d; };
const getStartOfWeek = (date = new Date()) => { const d = new Date(date); const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1); /* Assuming week starts Mon */ return getStartOfDay(new Date(d.setDate(diff))); };
const getEndOfWeek = (date = new Date()) => { const startOfWeek = getStartOfWeek(date); const d = new Date(startOfWeek); d.setDate(startOfWeek.getDate() + 6); return getEndOfDay(d); };
const getStartOfMonth = (date = new Date()) => { const d = new Date(date); return getStartOfDay(new Date(d.getFullYear(), d.getMonth(), 1)); };
const getEndOfMonth = (date = new Date()) => { const d = new Date(date); return getEndOfDay(new Date(d.getFullYear(), d.getMonth() + 1, 0)); };
const getStartOfYear = (date = new Date()) => { const d = new Date(date); return getStartOfDay(new Date(d.getFullYear(), 0, 1)); };
const getEndOfYear = (date = new Date()) => { const d = new Date(date); return getEndOfDay(new Date(d.getFullYear(), 11, 31)); };


// --- FullScreenLoader Component ---
// Displays a full-screen loading spinner with a message.
function FullScreenLoader({ message }) {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-4">
      <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-sky-500 mb-4"></div>
      <p className="text-xl">{message || "Loading..."}</p>
    </div>
  );
}

// --- AuthScreen Component ---
// Handles user authentication (sign up/sign in) with email and password.
function AuthScreen({ auth, setAppError }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Handles either sign-up or sign-in based on `isSignUp` state.
  const handleAuthAction = async (e) => {
    e.preventDefault();
    setAuthError('');
    setIsLoading(true);
    setAppError(''); // Clear any previous app-wide errors

    if (!email || !password) {
      setAuthError("Email and password are required.");
      setIsLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error) {
      // Display specific Firebase auth errors to the user
      setAuthError(error.message || "Authentication failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-slate-100">
      <div className="w-full max-w-md bg-slate-800 p-8 rounded-xl shadow-2xl ring-1 ring-slate-700">
        <h1 className="text-3xl font-bold text-sky-400 mb-2 text-center">{isSignUp ? 'Create Account' : 'Welcome Back'}</h1>
        <p className="text-slate-400 mb-8 text-center">{isSignUp ? 'Sign up to manage your client accounts.' : 'Sign in to access your dashboard.'}</p>

        {authError && (
          <div className="mb-4 p-3 bg-red-700/30 text-red-300 border border-red-600 rounded-md text-sm flex items-center">
            <AlertTriangle size={18} className="mr-2 flex-shrink-0" />
            <span>{authError}</span>
          </div>
        )}

        <form onSubmit={handleAuthAction} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1">Email Address</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg p-3 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition"
              required
            />
          </div>
          <div className="relative">
            <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1">Password</label>
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg p-3 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 top-6 pr-3 flex items-center text-slate-400 hover:text-sky-400"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-sky-600 hover:bg-sky-500 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:shadow-lg transition duration-150 flex items-center justify-center disabled:opacity-50"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
            ) : (
              isSignUp ? <UserPlus size={20} className="mr-2" /> : <LogIn size={20} className="mr-2" />
            )}
            {isLoading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}
          </button>
        </form>
        <p className="mt-8 text-center text-sm text-slate-400">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => { setIsSignUp(!isSignUp); setAuthError(''); }}
            className="font-medium text-sky-400 hover:text-sky-300"
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </p>
      </div>
      <footer className="text-center text-xs text-slate-600 mt-10 py-4">Money Tracker App &copy; {new Date().getFullYear()}</footer>
    </div>
  );
}

// --- Main App Component (Formerly MoneyTrackerModule) ---
// This is the core application logic and UI.
function App() {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [appError, setAppError] = useState(null);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);

  const [showTransactionFormModal, setShowTransactionFormModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null); // null for Add, object for Edit
  const [selectedAccountIdForNewTx, setSelectedAccountIdForNewTx] = useState(null); // For associating new TX

  const [editingAccount, setEditingAccount] = useState(null);
  const [expenseReportPeriod, setExpenseReportPeriod] = useState('month');
  const [customExpenseStartDate, setCustomExpenseStartDate] = useState('');
  const [customExpenseEndDate, setCustomExpenseEndDate] = useState('');

  const [showAccountExpenseReportModal, setShowAccountExpenseReportModal] = useState(false);
  const [selectedAccountForReportDetails, setSelectedAccountForReportDetails] = useState(null); // {id, name}
  const [searchTerm, setSearchTerm] = useState(''); // New state for global search

  // Effect for Firebase Initialization and Authentication State Listener
  useEffect(() => {
    try {
      const appInstance = initializeApp(firebaseConfig);
      const firestoreDb = getFirestore(appInstance);
      const firebaseAuth = getAuth(appInstance);

      // setLogLevel('debug'); // Uncomment for detailed Firebase debug logs

      setDb(firestoreDb);
      setAuth(firebaseAuth);

      const unsubscribe = onAuthStateChanged(firebaseAuth, async (currentUser) => {
        setAppError(null); // Clear any app errors on auth state change
        if (currentUser) {
          setUserId(currentUser.uid);
        } else {
          setUserId(null); // Clear user ID on sign out
        }
        setIsAuthReady(true); // Mark auth as ready regardless of login status
      });

      return () => unsubscribe(); // Cleanup auth listener on component unmount
    } catch (e) {
      console.error("Firebase initialization error:", e);
      setAppError("Could not initialize application. Critical error.");
      setIsLoadingData(false);
      setIsAuthReady(true); // Mark auth as ready even if error, to stop loader
    }
  }, []); // Run only once on mount

  // Effect for Fetching Accounts (depends on auth readiness and user ID)
  useEffect(() => {
    if (!isAuthReady || !db || !userId) {
      if (isAuthReady && !userId) {
        setIsLoadingData(false); // Stop loading if auth is ready but no user (e.g., signed out)
      }
      setAccounts([]); // Clear accounts if not ready or signed out
      return;
    }

    setIsLoadingData(true); // Start loading when conditions are met
    const accountsCollectionPath = `artifacts/${appId}/users/${userId}/accounts`;
    const q = query(collection(db, accountsCollectionPath));

    const unsubscribe = onSnapshot(q, (qs) => {
      // Map Firestore documents to a cleaner array of objects
      setAccounts(qs.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name)));
      setIsLoadingData(false); // Data loaded, stop loading indicator
      setAppError(null); // Clear any previous errors
    }, (err) => {
      console.error("Error fetching accounts:", err);
      setAppError("Could not fetch accounts.");
      setIsLoadingData(false); // Stop loading even on error
      setAccounts([]); // Clear accounts on error
    });

    return () => unsubscribe(); // Cleanup snapshot listener
  }, [isAuthReady, db, userId]); // Re-run when these dependencies change

  // Effect for Fetching Transactions (depends on auth readiness and user ID)
  useEffect(() => {
    if (!isAuthReady || !db || !userId) {
      setTransactions([]); // Clear transactions if not ready or signed out
      return;
    }

    const txCollectionPath = `artifacts/${appId}/users/${userId}/transactions`;
    const q = query(collection(db, txCollectionPath));

    const unsub = onSnapshot(q, (qs) => {
      // Map Firestore documents to a cleaner array of objects
      setTransactions(qs.docs.map(d => ({ id: d.id, ...d.data() })));
      setAppError(null); // Clear any previous errors
    }, (err) => {
      console.error("Error fetching transactions:", err);
      setAppError("Could not fetch transactions.");
      setTransactions([]); // Clear transactions on error
    });

    return () => unsub; // Cleanup snapshot listener
  }, [isAuthReady, db, userId]); // Re-run when these dependencies change

  // Memoized calculation for account balances
  const accountBalances = useMemo(() => {
    return accounts.map(acc => {
      const allAccountTransactions = transactions.filter(tx => tx.accountId === acc.id);
      return {
        ...acc,
        // Calculate balance: initialBalance + sum of all transaction amounts
        balance: (parseFloat(acc.initialBalance) || 0) + allAccountTransactions.reduce((sum, tx) => sum + tx.amount, 0),
        totalTransactionCount: allAccountTransactions.length
      };
    });
  }, [accounts, transactions]);

  // Memoized calculations for total portfolio value
  const totalPositiveBalance = useMemo(() => accountBalances.reduce((sum, acc) => acc.balance >= 0 ? sum + acc.balance : sum, 0), [accountBalances]);
  const totalNegativeBalance = useMemo(() => accountBalances.reduce((sum, acc) => acc.balance < 0 ? sum + acc.balance : sum, 0), [accountBalances]);
  const netTotalBalance = useMemo(() => totalPositiveBalance + totalNegativeBalance, [totalPositiveBalance, totalNegativeBalance]);

  // Memoized calculation for global filtered expenses data
  const globalFilteredExpensesData = useMemo(() => {
    let startDate, endDate, periodLabel = "";
    const now = new Date();

    // Determine date range based on selected period
    switch (expenseReportPeriod) {
      case 'day': startDate = getStartOfDay(now); endDate = getEndOfDay(now); periodLabel = `Today (${formatDateForDisplay(now)})`; break;
      case 'week': startDate = getStartOfWeek(now); endDate = getEndOfWeek(now); periodLabel = `This Week (${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)})`; break;
      case 'month': startDate = getStartOfMonth(now); endDate = getEndOfMonth(now); periodLabel = `This Month (${now.toLocaleString('default', { month: 'long', year: 'numeric' })})`; break;
      case 'year': startDate = getStartOfYear(now); endDate = getEndOfYear(now); periodLabel = `This Year (${now.getFullYear()})`; break;
      case 'custom':
        if (customExpenseStartDate && customExpenseEndDate) {
          startDate = getStartOfDay(new Date(customExpenseStartDate));
          endDate = getEndOfDay(new Date(customExpenseEndDate));
          // Ensure start date is before end date if user swaps them
          if (startDate > endDate) [startDate, endDate] = [endDate, startDate];
          periodLabel = `Custom Range (${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)})`;
        } else if (customExpenseStartDate) {
          // If only start date is provided for custom, treat as a single day
          startDate = getStartOfDay(new Date(customExpenseStartDate));
          endDate = getEndOfDay(new Date(customExpenseStartDate));
          periodLabel = `Custom Date (${formatDateForDisplay(startDate)})`;
        }
        break;
      default:
        startDate = getStartOfMonth(now);
        endDate = getEndOfMonth(now);
        periodLabel = `This Month (${now.toLocaleString('default', { month: 'long', year: 'numeric' })})`;
    }

    if (!startDate || !endDate) return { expenses: [], total: 0, periodLabel: "Select a period" };

    const lowerSearchTerm = searchTerm.toLowerCase();

    // Filter transactions by type 'expense', date range, and search term
    const filtered = transactions
      .filter(tx => {
        const txDate = tx.date?.toDate ? tx.date.toDate() : new Date(tx.date);
        return tx.type === 'expense' && txDate >= startDate && txDate <= endDate;
      })
      .filter(tx => {
        if (!lowerSearchTerm) return true; // If no search term, don't filter by it
        return tx.description.toLowerCase().includes(lowerSearchTerm);
      })
      .map(tx => ({
        ...tx,
        // Add account name for display
        accountName: accounts.find(acc => acc.id === tx.accountId)?.name || 'Unknown',
        // Convert Firestore Timestamp to Date object if necessary
        date: tx.date?.toDate ? tx.date.toDate() : new Date(tx.date)
      }))
      .sort((a, b) => b.date - a.date); // Sort by date, newest first

    return {
      expenses: filtered,
      total: filtered.reduce((sum, tx) => sum + Math.abs(tx.amount), 0), // Sum absolute expense amounts
      periodLabel
    };
  }, [transactions, accounts, expenseReportPeriod, customExpenseStartDate, customExpenseEndDate, searchTerm]);

  // Handles adding a new account to Firestore
  const handleAddAccount = async (name, initialBalance) => {
    if (!db || !userId) { setAppError("Database/User not ready. Please try again or sign in."); return; }
    try {
      await addDoc(collection(db, `artifacts/${appId}/users/${userId}/accounts`), {
        name,
        initialBalance: parseFloat(initialBalance) || 0,
        createdAt: serverTimestamp(), // Record creation time
        userId // Store user ID with the account for security rules
      });
      setShowAddAccountModal(false);
      setEditingAccount(null); // Clear editing state after add
    } catch (e) {
      console.error("Error adding account:", e);
      setAppError("Failed to add account. Please check your network and try again.");
    }
  };

  // Handles editing an existing account in Firestore
  const handleEditAccount = async (accountId, name, initialBalance) => {
    if (!db || !userId) { setAppError("Database/User not ready. Please try again or sign in."); return; }
    try {
      await setDoc(doc(db, `artifacts/${appId}/users/${userId}/accounts/${accountId}`), {
        name,
        initialBalance: parseFloat(initialBalance) || 0
      }, { merge: true }); // Use merge to only update provided fields
      setShowAddAccountModal(false);
      setEditingAccount(null); // Clear editing state after edit
    } catch (e) {
      console.error("Error updating account:", e);
      setAppError("Failed to update account. Please check your network and try again.");
    }
  };

  // Handles adding a new transaction to Firestore
  const handleAddTransaction = async (accountId, description, amount, type, date) => {
    if (!db || !userId) { setAppError("Database/User not ready. Please try again or sign in."); return; }
    try {
      await addDoc(collection(db, `artifacts/${appId}/users/${userId}/transactions`), {
        accountId,
        description,
        // Store expense as negative amount, income as positive
        amount: type === 'expense' ? -Math.abs(parseFloat(amount)) : Math.abs(parseFloat(amount)),
        type,
        date: date ? new Date(date) : new Date(), // Convert date string to Date object
        createdAt: serverTimestamp(),
        userId
      });
      setShowTransactionFormModal(false); // Close the unified modal
    } catch (e) {
      console.error("Error adding transaction:", e);
      setAppError("Failed to add transaction. Please check your network and try again.");
    }
  };

  // Handles editing an existing transaction in Firestore
  const handleEditTransaction = async (transactionId, accountId, description, amount, type, date) => {
    if (!db || !userId) { setAppError("Database/User not ready. Please try again or sign in."); return; }
    try {
      const transactionDocPath = `artifacts/${appId}/users/${userId}/transactions/${transactionId}`;
      await updateDoc(doc(db, transactionDocPath), {
        description,
        amount: type === 'expense' ? -Math.abs(parseFloat(amount)) : Math.abs(parseFloat(amount)),
        type,
        date: date ? new Date(date) : new Date(),
      });
      setShowTransactionFormModal(false); // Close unified modal
      setEditingTransaction(null); // Clear editing state
    } catch (e) {
      console.error("Error updating transaction:", e);
      setAppError("Failed to update transaction. Please check your network and try again.");
    }
  };

  // Handles deleting an account and all its associated transactions
  const handleDeleteAccount = async (accountId) => {
    if (!db || !userId) { setAppError("Database/User not ready. Please try again or sign in."); return; }

    // Use a custom confirmation modal instead of window.confirm
    // For this example, we'll use a placeholder console log.
    // In a real app, implement a visible modal for confirmation.
    if (!window.confirm("Are you sure you want to delete this account and ALL its transactions? This action cannot be undone.")) {
      return;
    }

    try {
      const batch = writeBatch(db);
      // Delete the account document
      batch.delete(doc(db, `artifacts/${appId}/users/${userId}/accounts/${accountId}`));

      // Find and delete all transactions associated with this account
      transactions
        .filter(tx => tx.accountId === accountId)
        .forEach(tx => batch.delete(doc(db, `artifacts/${appId}/users/${userId}/transactions/${tx.id}`)));

      await batch.commit(); // Commit all deletions as a single atomic operation
    } catch (e) {
      console.error("Error deleting account:", e);
      setAppError("Failed to delete account and its transactions. Please try again.");
    }
  };

  // Handles deleting a single transaction
  const handleDeleteTransaction = async (transactionId) => {
    if (!db || !userId) { setAppError("Database/User not ready. Please try again or sign in."); return; }

    // Use a custom confirmation modal instead of window.confirm
    if (!window.confirm("Are you sure you want to delete this transaction?")) {
      return;
    }

    try {
      await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/transactions/${transactionId}`));
    } catch (e) {
      console.error("Error deleting transaction:", e);
      setAppError("Failed to delete transaction. Please try again.");
    }
  };

  // Handles user sign out
  const handleSignOut = async () => {
    if (!auth) return; // Auth not initialized

    try {
      await signOut(auth);
      // Clear all local states upon sign out
      setUserId(null);
      setAccounts([]);
      setTransactions([]);
    } catch (error) {
      console.error("Error signing out:", error);
      setAppError("Failed to sign out. Please try again.");
    }
  };

  // Open transaction form for adding a new transaction to a specific account
  const openAddTransactionForm = (accountId) => {
    setSelectedAccountIdForNewTx(accountId);
    setEditingTransaction(null); // Ensure not in edit mode
    setShowTransactionFormModal(true);
  };

  // Open transaction form for editing an existing transaction
  const openEditTransactionForm = (transaction) => {
    setEditingTransaction(transaction);
    setSelectedAccountIdForNewTx(null); // Not adding a new one
    setShowTransactionFormModal(true);
  };

  // Open account-specific expense report modal
  const openAccountExpenseReport = (account) => {
    setSelectedAccountForReportDetails({ id: account.id, name: account.name });
    setShowAccountExpenseReportModal(true);
  };

  // Open account modal for editing an existing account
  const openEditAccountModal = (account) => {
    setEditingAccount(account);
    setShowAddAccountModal(true);
  };

  // --- Conditional Renders for App State ---
  if (!isAuthReady) {
    return <FullScreenLoader message="Initializing Authentication..." />;
  }

  // If not authenticated, show the authentication screen
  if (!userId) {
    return <AuthScreen auth={auth} setAppError={setAppError} />;
  }

  // If authenticated but data is loading, show data loading screen
  if (isLoadingData) {
    return <FullScreenLoader message="Loading your data..." />;
  }

  // If there's an application-wide error and user is logged in, display it
  if (appError && userId) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-6">
        <div className="bg-red-800/50 border border-red-700 p-6 rounded-lg shadow-xl max-w-md text-center">
          <AlertTriangle size={48} className="mx-auto mb-4 text-red-300" />
          <h2 className="text-2xl font-semibold mb-2 text-red-200">Application Error</h2>
          <p className="text-red-300 mb-4">{appError}</p>
          <button
            onClick={() => { setAppError(null); setIsLoadingData(true); }}
            className="bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 px-4 rounded-lg mr-2"
          >
            Try Again
          </button>
          <button
            onClick={handleSignOut}
            className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-4 rounded-lg"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Buttons for filtering global expenses report
  const expenseFilterButtons = [
    { label: 'Today', period: 'day' },
    { label: 'This Week', period: 'week' },
    { label: 'This Month', period: 'month' },
    { label: 'This Year', period: 'year' },
    { label: 'Custom', period: 'custom' }
  ];

  // Main Application UI for logged-in user
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-4 md:p-8">
      <header className="mb-8">
        {/* Header with App Title, User ID, and Sign Out Button */}
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-center pb-4 border-b border-slate-700">
          <h1 className="text-4xl font-bold text-sky-400 mb-2 sm:mb-0">Money Tracker <p className="text-xs text-slate-500 mt-3 text-left">Developed by Mohd Shahrukh</p></h1>
          <div className="flex items-center space-x-4">
            <div className="text-xs text-slate-500 text-right">App ID: {appId}<br />User ID: {userId} </div>
            <button onClick={handleSignOut} title="Sign Out" className="bg-red-600 hover:bg-red-500 text-white p-2.5 rounded-lg shadow-md transition-colors">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto">
        {/* Total Balances & Net Portfolio Value */}
        <section className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 bg-slate-800 rounded-xl shadow-2xl ring-1 ring-slate-700 hover:ring-green-500/50 transition-all">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg sm:text-xl text-slate-400">Total Positive Balances</h2>
                <p className="text-3xl sm:text-4xl lg:text-5xl font-bold text-green-400">{formatCurrency(totalPositiveBalance)}</p>
              </div>
              <TrendingUp size={40} className="text-green-500 opacity-70" />
            </div>
          </div>
          <div className="p-6 bg-slate-800 rounded-xl shadow-2xl ring-1 ring-slate-700 hover:ring-red-500/50 transition-all">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg sm:text-xl text-slate-400">Total Negative Balances</h2>
                <p className="text-3xl sm:text-4xl lg:text-5xl font-bold text-red-400">{formatCurrency(Math.abs(totalNegativeBalance))}</p>
              </div>
              <TrendingDown size={40} className="text-red-500 opacity-70" />
            </div>
          </div>
        </section>

        <section className="mb-8 p-4 bg-slate-800/70 rounded-lg shadow-lg ring-1 ring-slate-700">
          <div className="flex flex-col sm:flex-row justify-between items-center sm:items-end">
            <h2 className="text-md text-slate-300 mb-1 sm:mb-0">Net Portfolio Value</h2>
            <p className={`text-2xl font-semibold ${netTotalBalance >= 0 ? 'text-sky-300' : 'text-orange-400'}`}>
              {formatCurrency(netTotalBalance)}
            </p>
          </div>
        </section>

        {/* Add New Account Button */}
        <div className="mb-8 flex justify-end">
          <button
            onClick={() => { setEditingAccount(null); setShowAddAccountModal(true); }}
            className="flex items-center bg-sky-600 hover:bg-sky-500 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:shadow-lg transition duration-150 transform hover:scale-105"
          >
            <PlusCircle size={20} className="mr-2" /> Add New Account
          </button>
        </div>

        {/* Message if no accounts exist */}
        {accounts.length === 0 && !isLoadingData && (
          <div className="text-center p-10 bg-slate-800 rounded-lg shadow-lg ring-1 ring-slate-700">
            <Users size={48} className="mx-auto text-slate-500 mb-4" />
            <h3 className="text-2xl font-semibold text-slate-300 mb-2">No Accounts Yet</h3>
            <p className="text-slate-400">Click "Add New Account" to get started.</p>
          </div>
        )}

        {/* Display Account Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 mb-8 gap-6">
          {accountBalances.map(account => (
            <AccountCard
              key={account.id}
              account={account}
              transactions={transactions.filter(tx => tx.accountId === account.id)} // Pass only relevant transactions for this account
              onAddTransaction={() => openAddTransactionForm(account.id)}
              onEditTransaction={openEditTransactionForm}
              onDeleteTransaction={handleDeleteTransaction}
              onEditAccount={() => openEditAccountModal(account)}
              onDeleteAccount={() => handleDeleteAccount(account.id)}
              onViewAccountExpenses={() => openAccountExpenseReport(account)}
              searchTerm={searchTerm} // Pass the global search term to account cards
            />
          ))}
        </div>

        {/* Global Expense Report Section */}
        <section className="mb-8 p-6 bg-slate-800 rounded-xl shadow-2xl ring-1 ring-slate-700">
          <div className="flex items-center mb-4">
            <BarChart2 size={28} className="mr-3 text-sky-400" />
            <h2 className="text-2xl font-semibold text-sky-400">Global Expense Report</h2>
          </div>

          {/* Global Search Bar for Transactions */}
          <section className="mb-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search transactions (description)..."
                className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg p-3 pl-10 pr-10 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400">
                <Search size={20} />
              </div>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  title="Clear search"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-sky-400 p-1"
                >
                  <X size={20} />
                </button>
              )}
            </div>
          </section>

          {/* Filter Buttons for Global Expense Report */}
          <div className="flex flex-wrap gap-2 mb-4">
            {expenseFilterButtons.map(btn => (
              <button
                key={btn.period}
                onClick={() => setExpenseReportPeriod(btn.period)}
                className={`py-2 px-4 rounded-lg text-sm font-medium transition-colors ${expenseReportPeriod === btn.period ? 'bg-sky-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* Custom Date Range Pickers */}
          {expenseReportPeriod === 'custom' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 p-4 bg-slate-700/50 rounded-lg">
              <div>
                <label htmlFor="customStartDate" className="block text-sm font-medium text-slate-300 mb-1">Start Date</label>
                <input
                  type="date"
                  id="customStartDate"
                  value={customExpenseStartDate}
                  onChange={e => setCustomExpenseStartDate(e.target.value)}
                  className="w-full bg-slate-600 border-slate-500 text-slate-100 rounded-md p-2 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>
              <div>
                <label htmlFor="customEndDate" className="block text-sm font-medium text-slate-300 mb-1">End Date</label>
                <input
                  type="date"
                  id="customEndDate"
                  value={customExpenseEndDate}
                  onChange={e => setCustomExpenseEndDate(e.target.value)}
                  className="w-full bg-slate-600 border-slate-500 text-slate-100 rounded-md p-2 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>
            </div>
          )}

          {/* Display Global Expenses List */}
          <div className="mt-4 p-4 bg-slate-850 rounded-lg ring-1 ring-slate-700">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-medium text-slate-300">{globalFilteredExpensesData.periodLabel}</h3>
              <p className="text-xl font-semibold text-red-400">Total: {formatCurrency(globalFilteredExpensesData.total)}</p>
            </div>
            {globalFilteredExpensesData.expenses.length === 0 ? (
              <p className="text-slate-500 text-center py-4">No expenses found.</p>
            ) : (
              <ul className="space-y-2 max-h-96 overflow-y-auto pr-2">
                {globalFilteredExpensesData.expenses.map(tx => (
                  <li key={tx.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 bg-slate-700/70 rounded-md shadow-sm">
                    <div className="flex-1 mb-2 sm:mb-0">
                      <p className="font-medium text-slate-100 break-all">{tx.description}</p>
                      <p className="text-xs text-sky-400">{tx.accountName}</p>
                    </div>
                    <div className="flex items-center sm:ml-2">
                      <div className="text-right sm:text-left mr-3">
                        <p className="font-semibold text-red-400">{formatCurrency(Math.abs(tx.amount))}</p>
                        <p className="text-xs text-slate-400">{formatDateForDisplay(tx.date)}</p>
                      </div>
                      <button onClick={() => openEditTransactionForm(tx)} title="Edit Transaction" className="text-slate-400 hover:text-sky-400 p-1.5 rounded hover:bg-slate-600/50 transition-colors">
                        <Edit3 size={14} />
                      </button>
                      <button onClick={() => handleDeleteTransaction(tx.id)} title="Delete Transaction" className="ml-1.5 text-slate-400 hover:text-red-400 p-1.5 rounded hover:bg-slate-600/50 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

      </main>

      {/* Modals */}
      {showAddAccountModal && (
        <Modal onClose={() => { setShowAddAccountModal(false); setEditingAccount(null); }}>
          <AddAccountForm
            onAddAccount={handleAddAccount}
            onEditAccount={handleEditAccount}
            existingAccount={editingAccount}
            onClose={() => { setShowAddAccountModal(false); setEditingAccount(null); }}
          />
        </Modal>
      )}

      {showTransactionFormModal && (
        <Modal onClose={() => { setShowTransactionFormModal(false); setEditingTransaction(null); setSelectedAccountIdForNewTx(null); }}>
          <TransactionForm
            accountId={editingTransaction ? editingTransaction.accountId : selectedAccountIdForNewTx}
            accountName={
              editingTransaction
                ? accounts.find(acc => acc.id === editingTransaction.accountId)?.name
                : accounts.find(acc => acc.id === selectedAccountIdForNewTx)?.name || ''
            }
            onSaveTransaction={editingTransaction ? handleEditTransaction : handleAddTransaction}
            existingTransaction={editingTransaction}
            onClose={() => { setShowTransactionFormModal(false); setEditingTransaction(null); setSelectedAccountIdForNewTx(null); }}
          />
        </Modal>
      )}

      {showAccountExpenseReportModal && selectedAccountForReportDetails && (
        <Modal onClose={() => { setShowAccountExpenseReportModal(false); setSelectedAccountForReportDetails(null); }}>
          <AccountExpenseReportModal
            accountId={selectedAccountForReportDetails.id}
            accountName={selectedAccountForReportDetails.name}
            allTransactions={transactions}
            onEditTransaction={openEditTransactionForm}
            onDeleteTransaction={handleDeleteTransaction}
            onClose={() => { setShowAccountExpenseReportModal(false); setSelectedAccountForReportDetails(null); }}
          />
        </Modal>
      )}

      <footer className="text-center text-sm text-slate-600 mt-12 py-6 border-t border-slate-700">
        Money Tracker App &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}


// --- AccountCard Component ---
// Displays an individual account's details, balance, and recent transactions.
function AccountCard({ account, transactions, onAddTransaction, onEditTransaction, onDeleteTransaction, onEditAccount, onDeleteAccount, onViewAccountExpenses, searchTerm }) {
  const [showTransactions, setShowTransactions] = useState(false);

  // Memoized list of visible transactions, filtered by search term and sorted by date.
  const visibleTransactions = useMemo(() => {
    const lowerSearchTerm = searchTerm ? searchTerm.toLowerCase() : "";
    let processedTransactions = [...transactions]; // Create a shallow copy

    if (lowerSearchTerm) {
      processedTransactions = processedTransactions.filter(tx =>
        tx.description.toLowerCase().includes(lowerSearchTerm)
      );
    }

    return processedTransactions.sort((a, b) =>
      (b.date?.toDate ? b.date.toDate() : new Date(b.date)) -
      (a.date?.toDate ? a.date.toDate() : new Date(a.date))
    );
  }, [transactions, searchTerm]); // Re-calculate when transactions or search term changes

  return (
    <div className="bg-slate-800 rounded-xl shadow-xl overflow-hidden ring-1 ring-slate-700 hover:ring-sky-500/50">
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-2xl font-semibold text-sky-400 truncate" title={account.name}>{account.name}</h3>
            <p className={`text-3xl font-bold ${account.balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatCurrency(account.balance)}
            </p>
            <p className="text-xs text-slate-500">Initial: {formatCurrency(account.initialBalance)}</p>
          </div>
          <div className="flex space-x-1 sm:space-x-2">
            <button onClick={onEditAccount} title="Edit Account" className="text-slate-400 hover:text-sky-400 p-1.5 rounded-md bg-slate-700/50 hover:bg-slate-700">
              <Edit3 size={16} />
            </button>
            <button onClick={onDeleteAccount} title="Delete Account" className="text-slate-400 hover:text-red-500 p-1.5 rounded-md bg-slate-700/50 hover:bg-slate-700">
              <Trash2 size={16} />
            </button>
          </div>
        </div>
        <div className="flex space-x-2 mb-4">
          <button onClick={onAddTransaction} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold py-2.5 px-3 rounded-md flex items-center justify-center">
            <PlusCircle size={16} className="mr-1.5" /> Add Entry
          </button>
          <button onClick={onViewAccountExpenses} className="flex-1 bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold py-2.5 px-3 rounded-md flex items-center justify-center">
            <FileText size={16} className="mr-1.5" /> Report
          </button>
        </div>
        <button
          onClick={() => setShowTransactions(!showTransactions)}
          className="text-sm text-sky-400 hover:text-sky-300 w-full text-left py-1.5 px-0.5 rounded hover:bg-slate-700/30"
        >
          {showTransactions ? 'Hide Transactions' :
            `View ${visibleTransactions.length} Transaction${visibleTransactions.length === 1 ? '' : 's'}` +
            `${searchTerm && visibleTransactions.length !== account.totalTransactionCount ? ` (matching search, out of ${account.totalTransactionCount} total)` : ` (of ${account.totalTransactionCount} total)`}`
          }
        </button>
      </div>
      {showTransactions && (
        <div className="bg-slate-850 p-4 max-h-60 overflow-y-auto border-t border-slate-700">
          {visibleTransactions.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-2">{searchTerm ? 'No transactions match your search.' : 'No transactions.'}</p>
          ) : (
            <ul className="space-y-2">
              {visibleTransactions.map(tx => (
                <li key={tx.id} className="flex justify-between items-center text-sm p-2.5 bg-slate-700/60 rounded-md">
                  <div className="overflow-hidden mr-2">
                    <p className="font-medium text-slate-200 truncate" title={tx.description}>{tx.description}</p>
                    <p className="text-xs text-slate-400">{formatDateForDisplay(tx.date)}</p>
                  </div>
                  <div className="flex items-center flex-shrink-0">
                    <span className={`font-semibold whitespace-nowrap ${tx.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatCurrency(tx.amount)}
                    </span>
                    <button onClick={() => onEditTransaction(tx)} title="Edit Transaction" className="ml-2.5 text-slate-400 hover:text-sky-400 p-1 rounded hover:bg-slate-600/50">
                      <Edit3 size={14} />
                    </button>
                    <button onClick={() => onDeleteTransaction(tx.id)} title="Delete Transaction" className="ml-1.5 text-slate-400 hover:text-red-400 p-1 rounded hover:bg-slate-600/50">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// --- AddAccountForm Component ---
// Form for adding or editing an account.
function AddAccountForm({ onAddAccount, onEditAccount, existingAccount, onClose }) {
  const [name, setName] = useState(existingAccount?.name || '');
  const [initialBalance, setInitialBalance] = useState(existingAccount?.initialBalance || '');
  const [formError, setFormError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError(''); // Clear previous errors

    if (!name.trim()) {
      setFormError('Account Name is required.');
      return;
    }

    const bal = initialBalance === '' ? 0 : parseFloat(initialBalance);
    if (isNaN(bal)) {
      setFormError('Initial Balance must be a valid number.');
      return;
    }

    // Call the appropriate handler based on whether we are editing or adding
    if (existingAccount) {
      onEditAccount(existingAccount.id, name, bal);
    } else {
      onAddAccount(name, bal);
    }
    onClose(); // Close modal on successful submission
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-1">
      <h2 className="text-2xl font-semibold text-sky-400 mb-6">{existingAccount ? 'Edit Account' : 'Add New Account'}</h2>
      {formError && (
        <p className="text-red-400 text-sm bg-red-900/30 p-2 rounded-md flex items-center">
          <AlertTriangle size={16} className="mr-2" />{formError}
        </p>
      )}
      <div>
        <label htmlFor="accName" className="block text-sm font-medium text-slate-300 mb-1">Account Name</label>
        <input
          type="text"
          id="accName"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g., Savings Account, Project Budget"
          className="w-full bg-slate-700 border-slate-600 rounded-lg p-3 focus:ring-sky-500"
          required
        />
      </div>
      <div>
        <label htmlFor="initBal" className="block text-sm font-medium text-slate-300 mb-1">Initial Balance (INR)</label>
        <input
          type="number"
          id="initBal"
          value={initialBalance}
          onChange={e => setInitialBalance(e.target.value)}
          placeholder="0.00 (can be negative)"
          step="any"
          className="w-full bg-slate-700 border-slate-600 rounded-lg p-3 focus:ring-sky-500"
        />
      </div>
      <div className="flex justify-end space-x-3 pt-2">
        <button type="button" onClick={onClose} className="py-2.5 px-5 rounded-lg text-slate-300 hover:bg-slate-700">Cancel</button>
        <button type="submit" className="bg-sky-600 hover:bg-sky-500 text-white font-semibold py-2.5 px-6 rounded-lg">
          {existingAccount ? 'Save Changes' : 'Add Account'}
        </button>
      </div>
    </form>
  );
}

// --- TransactionForm Component ---
// Form for adding or editing a transaction.
function TransactionForm({ accountId, accountName, onSaveTransaction, existingTransaction, onClose }) {
  const isEditMode = !!existingTransaction;
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('income');
  const [date, setDate] = useState(formatDate(new Date())); // Default to current date, formatted for input
  const [formError, setFormError] = useState('');

  // Populate form fields if editing an existing transaction
  useEffect(() => {
    if (isEditMode && existingTransaction) {
      setDescription(existingTransaction.description || '');
      // Display absolute amount, sign handled by type
      setAmount(Math.abs(existingTransaction.amount || 0).toString());
      setType(existingTransaction.type || 'income');
      setDate(formatDate(existingTransaction.date)); // Format existing date for input
    } else {
      // Reset fields for adding new transaction
      setDescription('');
      setAmount('');
      setType('income');
      setDate(formatDate(new Date())); // Reset date to current for new entries
    }
  }, [isEditMode, existingTransaction]); // Re-run when edit mode or existingTransaction changes

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError(''); // Clear previous errors

    if (!description.trim()) {
      setFormError('Description is required.');
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError('Please enter a valid positive amount.');
      return;
    }

    // Call the appropriate save handler (add or edit)
    if (isEditMode) {
      onSaveTransaction(existingTransaction.id, existingTransaction.accountId, description, parsedAmount, type, date);
    } else {
      onSaveTransaction(accountId, description, parsedAmount, type, date);
    }
    onClose(); // Close modal after successful submission
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-1">
      <h2 className="text-2xl font-semibold text-sky-400 mb-1">{isEditMode ? 'Edit Transaction' : 'Add New Transaction'}</h2>
      <p className="text-sm text-slate-400 -mt-5 mb-6">For Account: <span className="font-medium text-sky-300">{accountName}</span></p>
      {formError && (
        <p className="text-red-400 text-sm bg-red-900/30 p-2 rounded-md flex items-center">
          <AlertTriangle size={16} className="mr-2" />{formError}
        </p>
      )}
      <div>
        <label htmlFor="txDesc" className="block text-sm text-slate-300 mb-1">Description</label>
        <input
          type="text"
          id="txDesc"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="e.g., Project Milestone, Software Subscription"
          className="w-full bg-slate-700 border-slate-600 rounded-lg p-3 focus:ring-sky-500"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="txAmount" className="block text-sm text-slate-300 mb-1">Amount (INR)</label>
          <input
            type="number"
            id="txAmount"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            step="0.01"
            min="0.01"
            className="w-full bg-slate-700 border-slate-600 rounded-lg p-3 focus:ring-sky-500"
            required
          />
        </div>
        <div>
          <label htmlFor="txType" className="block text-sm text-slate-300 mb-1">Type</label>
          <select
            id="txType"
            value={type}
            onChange={e => setType(e.target.value)}
            className="w-full bg-slate-700 border-slate-600 rounded-lg p-3 h-[46px] focus:ring-sky-500"
          >
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="txDate" className="block text-sm text-slate-300 mb-1">Date</label>
        <input
          type="date"
          id="txDate"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-full bg-slate-700 border-slate-600 rounded-lg p-3 focus:ring-sky-500"
          required
        />
      </div>
      <div className="flex justify-end space-x-3 pt-2">
        <button type="button" onClick={onClose} className="py-2.5 px-5 rounded-lg text-slate-300 hover:bg-slate-700">Cancel</button>
        <button
          type="submit"
          className={`font-semibold py-2.5 px-6 rounded-lg text-white flex items-center ${type === 'income' && !isEditMode ? 'bg-green-600 hover:bg-green-500' : type === 'expense' && !isEditMode ? 'bg-red-600 hover:bg-red-500' : 'bg-sky-600 hover:bg-sky-500'}`}
        >
          {isEditMode ? <Edit3 size={18} className="mr-2" /> : (type === 'income' ? <TrendingUp size={18} className="mr-2" /> : <TrendingDown size={18} className="mr-2" />)}
          {isEditMode ? 'Save Changes' : `Add ${type.charAt(0).toUpperCase() + type.slice(1)}`}
        </button>
      </div>
    </form>
  );
}

// --- AccountExpenseReportModal Component ---
// Displays expenses for a specific account within a chosen period.
function AccountExpenseReportModal({ accountId, accountName, allTransactions, onEditTransaction, onDeleteTransaction, onClose }) {
  const [reportPeriod, setReportPeriod] = useState('month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Define filter buttons for the report
  const expenseFilterButtons = useMemo(() => [
    { label: 'Today', period: 'day' },
    { label: 'This Week', period: 'week' },
    { label: 'This Month', period: 'month' },
    { label: 'This Year', period: 'year' },
    { label: 'Custom', period: 'custom' }
  ], []);

  // Memoized filtered report data for the selected account and period
  const filteredReportData = useMemo(() => {
    let startDate, endDate, periodLabel = "";
    const now = new Date();

    // Date range calculation logic (similar to global report)
    switch (reportPeriod) {
      case 'day': startDate = getStartOfDay(now); endDate = getEndOfDay(now); periodLabel = `Today (${formatDateForDisplay(now)})`; break;
      case 'week': startDate = getStartOfWeek(now); endDate = getEndOfWeek(now); periodLabel = `This Week (${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)})`; break;
      case 'month': startDate = getStartOfMonth(now); endDate = getEndOfMonth(now); periodLabel = `This Month (${now.toLocaleString('default', { month: 'long', year: 'numeric' })})`; break;
      case 'year': startDate = getStartOfYear(now); endDate = getEndOfYear(now); periodLabel = `This Year (${now.getFullYear()})`; break;
      case 'custom':
        if (customStartDate && customEndDate) {
          startDate = getStartOfDay(new Date(customStartDate));
          endDate = getEndOfDay(new Date(customEndDate));
          if (startDate > endDate) [startDate, endDate] = [endDate, startDate]; // Swap if dates are inverted
          periodLabel = `Custom Range (${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)})`;
        } else if (customStartDate) {
          startDate = getStartOfDay(new Date(customStartDate));
          endDate = getEndOfDay(new Date(customStartDate));
          periodLabel = `Custom Date (${formatDateForDisplay(startDate)})`;
        }
        break;
      default:
        startDate = getStartOfMonth(now);
        endDate = getEndOfMonth(now);
        periodLabel = `This Month (${now.toLocaleString('default', { month: 'long', year: 'numeric' })})`;
    }

    if (!startDate || !endDate) return { expenses: [], total: 0, periodLabel: "Select a period" };

    // Filter transactions by account ID, type 'expense', and date range
    const accountExpenses = allTransactions
      .filter(tx => tx.accountId === accountId && tx.type === 'expense')
      .filter(tx => {
        const txDate = tx.date?.toDate ? tx.date.toDate() : new Date(tx.date);
        return txDate >= startDate && txDate <= endDate;
      })
      .map(tx => ({ ...tx, date: tx.date?.toDate ? tx.date.toDate() : new Date(tx.date) })) // Ensure date is a Date object
      .sort((a, b) => b.date - a.date); // Sort by date, newest first

    const total = accountExpenses.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    return { expenses: accountExpenses, total, periodLabel };
  }, [allTransactions, accountId, reportPeriod, customStartDate, customEndDate]);

  return (
    <div className="p-1">
      <h2 className="text-2xl font-semibold text-sky-400 mb-1">Expense Report</h2>
      <p className="text-sm text-slate-400 -mt-1 mb-6">For Account: <span className="font-medium text-sky-300">{accountName}</span></p>

      {/* Filter buttons for account-specific report */}
      <div className="flex flex-wrap gap-2 mb-4">
        {expenseFilterButtons.map(btn => (
          <button
            key={btn.period}
            onClick={() => setReportPeriod(btn.period)}
            className={`py-2 px-3 rounded-lg text-xs sm:text-sm font-medium transition-colors ${reportPeriod === btn.period ? 'bg-sky-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Custom date range pickers for account-specific report */}
      {reportPeriod === 'custom' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 p-3 bg-slate-700/50 rounded-lg">
          <div>
            <label htmlFor="accCustomStart" className="block text-xs font-medium text-slate-300 mb-1">Start Date</label>
            <input
              type="date"
              id="accCustomStart"
              value={customStartDate}
              onChange={e => setCustomStartDate(e.target.value)}
              className="w-full bg-slate-600 text-sm border-slate-500 text-slate-100 rounded-md p-2 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>
          <div>
            <label htmlFor="accCustomEnd" className="block text-xs font-medium text-slate-300 mb-1">End Date</label>
            <input
              type="date"
              id="accCustomEnd"
              value={customEndDate}
              onChange={e => setCustomEndDate(e.target.value)}
              className="w-full bg-slate-600 text-sm border-slate-500 text-slate-100 rounded-md p-2 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>
        </div>
      )}

      {/* Display account-specific expenses list */}
      <div className="mt-4 p-3 bg-slate-850 rounded-lg ring-1 ring-slate-700">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-md sm:text-lg font-medium text-slate-300">{filteredReportData.periodLabel}</h3>
          <p className="text-lg sm:text-xl font-semibold text-red-400">Total: {formatCurrency(filteredReportData.total)}</p>
        </div>
        {filteredReportData.expenses.length === 0 ? (
          <p className="text-slate-500 text-center py-4 text-sm">No expenses found for this account in this period.</p>
        ) : (
          <ul className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {filteredReportData.expenses.map(tx => (
              <li key={tx.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-2.5 bg-slate-700/70 rounded-md shadow-sm">
                <div className="flex-1 mb-1 sm:mb-0">
                  <p className="font-medium text-slate-100 text-sm break-all">{tx.description}</p>
                </div>
                <div className="flex items-center sm:ml-2 w-full sm:w-auto justify-between sm:justify-end">
                  <div className="text-left sm:text-right mr-2">
                    <p className="font-semibold text-red-400 text-sm">{formatCurrency(Math.abs(tx.amount))}</p>
                    <p className="text-xs text-slate-400">{formatDateForDisplay(tx.date)}</p>
                  </div>
                  <div className="flex items-center">
                    <button onClick={() => onEditTransaction(tx)} title="Edit Transaction" className="text-slate-400 hover:text-sky-400 p-1.5 rounded hover:bg-slate-600/50 transition-colors">
                      <Edit3 size={14} />
                    </button>
                    <button onClick={() => onDeleteTransaction(tx.id)} title="Delete Transaction" className="ml-1 text-slate-400 hover:text-red-400 p-1.5 rounded hover:bg-slate-600/50 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex justify-end pt-6">
        <button type="button" onClick={onClose} className="py-2 px-4 rounded-lg text-slate-300 hover:bg-slate-600 transition">Close</button>
      </div>
    </div>
  );
}

// --- Modal Component ---
// Generic modal wrapper component.
function Modal({ children, onClose }) {
  // Close modal on Escape key press
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]); // Re-run effect if onClose function changes

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onClose} // Close modal when clicking outside content area
    >
      <div
        className="bg-slate-800 p-6 md:p-8 rounded-xl shadow-2xl w-full max-w-lg ring-1 ring-slate-700 relative"
        onClick={e => e.stopPropagation()} // Prevent modal from closing when clicking inside content
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-slate-500 hover:text-slate-200 p-1.5 hover:bg-slate-700 rounded-full"
          aria-label="Close modal"
        >
          <X size={22} />
        </button>
        {children}
      </div>
    </div>
  );
}

// The following code is for rendering the React app into the DOM.
// In a standard React project, this would typically be in src/index.js or src/main.jsx.
const rootElement = document.getElementById('root');
if (!rootElement) {
  // If no root element exists (e.g., in some isolated environments), create one.
  // In a typical browser environment, ensure your public/index.html has <div id="root"></div>.
  const newRoot = document.createElement('div');
  newRoot.id = 'root';
  document.body.appendChild(newRoot);
}

// Render the main App component into the root DOM element.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Export the App component as default, which is required for the canvas environment.
export default App;
