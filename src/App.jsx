import { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { deriveKey, encryptText, decryptText } from './cryptoUtils';
import { 
  KeyRound, 
  ShieldAlert, 
  ShieldCheck, 
  Loader2, 
  FolderLock, 
  PlusCircle, 
  Trash2, 
  Dices, 
  Copy, 
  Check, 
  Search, 
  Landmark, 
  Mail, 
  Share2, 
  Briefcase, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  Lock, 
  UserPlus, 
  ArrowRight, 
  RotateCcw, 
  User, 
  Plus, 
  Menu,
  X, 
  LogOut,
  Shield
} from 'lucide-react';

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Κλειδί κρυπτογράφησης
  const [encryptionKey, setEncryptionKey] = useState(null);

  // Dashboard State
  const [activeView, setActiveView] = useState('vault');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [filterSecurity, setFilterSecurity] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Vault Items
  const [vaultItems, setVaultItems] = useState([]);
  const [decryptedPasswords, setDecryptedPasswords] = useState({});
  const [dataLoading, setDataLoading] = useState(false);

  // Form State
  const [newService, setNewService] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newCategory, setNewCategory] = useState('banking');
  const [visiblePasswords, setVisiblePasswords] = useState({});

  // Generator State
  const [genLength, setGenLength] = useState(16);
  const [genLower, setGenLower] = useState(true);
  const [genUpper, setGenUpper] = useState(true);
  const [genDigits, setGenDigits] = useState(true);
  const [genSymbols, setGenSymbols] = useState(true);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [copied, setCopied] = useState(false);

  // Auditor State
  const [auditorPassword, setAuditorPassword] = useState('');
  const [pwnedCount, setPwnedCount] = useState(null);
  const [isCheckingPwned, setIsCheckingPwned] = useState(false);

  // Παρακολούθηση Auth Session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthLoading(false);
      if (!session) {
        setEncryptionKey(null);
        setDecryptedPasswords({});
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Φόρτωση & Ασφαλής Αποκρυπτογράφηση
  const fetchVault = async (activeKey) => {
    if (!session?.user) return;
    setDataLoading(true);

    const { data, error } = await supabase
      .from('vault_items')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setVaultItems(data);

      const decMap = {};
      for (const item of data) {
        if (!item.encrypted_password) {
          decMap[item.id] = '';
          continue;
        }

        if (activeKey) {
          const res = await decryptText(item.encrypted_password, activeKey);
          decMap[item.id] = res === '[Σφάλμα Αποκρυπτογράφησης]' ? item.encrypted_password : res;
        } else {
          decMap[item.id] = item.encrypted_password;
        }
      }
      setDecryptedPasswords(decMap);
    }
    setDataLoading(false);
  };

  useEffect(() => {
    if (session) {
      fetchVault(encryptionKey);
    }
  }, [session, encryptionKey]);

  // Auth Handlers
  const handleSignUp = async (e) => {
    e.preventDefault();
    setAuthError('');
    const { data, error } = await supabase.auth.signUp({
      email: authEmail,
      password: authPassword,
    });
    if (error) {
      setAuthError(error.message);
    } else if (data?.user) {
      const derived = await deriveKey(authPassword, data.user.id);
      setEncryptionKey(derived);
      setAuthEmail('');
      setAuthPassword('');
    }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setAuthError('');
    const { data, error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: authPassword,
    });
    if (error) {
      setAuthError('Λανθασμένο email ή κωδικός πρόσβασης.');
    } else if (data?.user) {
      const derived = await deriveKey(authPassword, data.user.id);
      setEncryptionKey(derived);
      setAuthEmail('');
      setAuthPassword('');
    }
  };

  const handleSignOut = async () => {
    setEncryptionKey(null);
    setDecryptedPasswords({});
    setIsSidebarOpen(false);
    await supabase.auth.signOut();
  };

  // Προσθήκη Κωδικού
  const addVaultEntry = async (e) => {
    e.preventDefault();
    if (!newService.trim() || !newPassword.trim()) return;

    let cipherText = newPassword.trim();
    if (encryptionKey) {
      cipherText = await encryptText(newPassword.trim(), encryptionKey);
    }

    const { data, error } = await supabase
      .from('vault_items')
      .insert([
        {
          user_id: session.user.id,
          service: newService.trim(),
          username: newUsername.trim() || '-',
          encrypted_password: cipherText,
          category: newCategory,
          is_deleted: false
        }
      ])
      .select();

    if (!error && data) {
      const newItem = data[0];
      setVaultItems([newItem, ...vaultItems]);
      setDecryptedPasswords(prev => ({ ...prev, [newItem.id]: newPassword.trim() }));
      setNewService('');
      setNewUsername('');
      setNewPassword('');
      setIsAddModalOpen(false);
    } else if (error) {
      alert('Σφάλμα κατά την αποθήκευση: ' + error.message);
    }
  };

  const moveToTrash = async (id) => {
    const { error } = await supabase
      .from('vault_items')
      .update({ is_deleted: true })
      .eq('id', id);

    if (!error) {
      setVaultItems(vaultItems.map(item => item.id === id ? { ...item, is_deleted: true } : item));
    }
  };

  const restoreFromTrash = async (id) => {
    const { error } = await supabase
      .from('vault_items')
      .update({ is_deleted: false })
      .eq('id', id);

    if (!error) {
      setVaultItems(vaultItems.map(item => item.id === id ? { ...item, is_deleted: false } : item));
    }
  };

  const permanentDelete = async (id) => {
    const { error } = await supabase
      .from('vault_items')
      .delete()
      .eq('id', id);

    if (!error) {
      setVaultItems(vaultItems.filter(item => item.id !== id));
      setDecryptedPasswords(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    }
  };

  const activeVault = useMemo(() => vaultItems.filter(i => !i.is_deleted), [vaultItems]);
  const trashItems = useMemo(() => vaultItems.filter(i => i.is_deleted), [vaultItems]);

  const passwordOccurrences = useMemo(() => {
    const counts = {};
    activeVault.forEach(item => {
      const clearPwd = decryptedPasswords[item.id] || '';
      if (clearPwd) {
        counts[clearPwd] = (counts[clearPwd] || 0) + 1;
      }
    });
    return counts;
  }, [activeVault, decryptedPasswords]);

  const reusedCount = useMemo(() => {
    return activeVault.filter(item => {
      const clearPwd = decryptedPasswords[item.id];
      return clearPwd && passwordOccurrences[clearPwd] > 1;
    }).length;
  }, [activeVault, decryptedPasswords, passwordOccurrences]);

  const calculateEntropy = (pwd) => {
    if (!pwd) return 0;
    let poolSize = 0;
    if (/[a-z]/.test(pwd)) poolSize += 26;
    if (/[A-Z]/.test(pwd)) poolSize += 26;
    if (/[0-9]/.test(pwd)) poolSize += 10;
    if (/[^a-zA-Z0-9]/.test(pwd)) poolSize += 33;
    return Math.round(pwd.length * Math.log2(poolSize || 1));
  };

  const filteredVault = useMemo(() => {
    return activeVault.filter(item => {
      const clearPwd = decryptedPasswords[item.id] || '';
      const matchesSearch = item.service.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            item.username.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const isReused = clearPwd && passwordOccurrences[clearPwd] > 1;
      const isWeak = clearPwd && calculateEntropy(clearPwd) < 45;

      let matchesSecurity = true;
      if (filterSecurity === 'reused') matchesSecurity = isReused;
      if (filterSecurity === 'weak') matchesSecurity = isWeak;

      return matchesSearch && matchesCategory && matchesSecurity;
    });
  }, [activeVault, searchQuery, selectedCategory, filterSecurity, passwordOccurrences, decryptedPasswords]);

  const generatePassword = () => {
    let charset = '';
    if (genLower) charset += 'abcdefghijklmnopqrstuvwxyz';
    if (genUpper) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (genDigits) charset += '0123456789';
    if (genSymbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';
    if (!charset) { setGeneratedPassword(''); return; }
    const array = new Uint32Array(genLength);
    crypto.getRandomValues(array);
    let result = '';
    for (let i = 0; i < genLength; i++) result += charset[array[i] % charset.length];
    setGeneratedPassword(result);
  };

  useEffect(() => {
    generatePassword();
  }, [genLength, genLower, genUpper, genDigits, genSymbols]);

  const copyToClipboard = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (!auditorPassword || auditorPassword.length < 3) {
      setPwnedCount(null);
      setIsCheckingPwned(false);
      return;
    }
    const checkPwned = async () => {
      setIsCheckingPwned(true);
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(auditorPassword);
        const hashBuffer = await crypto.subtle.digest('SHA-1', data);
        const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
        const res = await fetch(`https://api.pwnedpasswords.com/range/${hashHex.slice(0, 5)}`);
        const text = await res.text();
        const match = text.split('\n').find(line => line.startsWith(hashHex.slice(5)));
        setPwnedCount(match ? parseInt(match.split(':')[1], 10) : 0);
      } catch (err) {
        setPwnedCount(null);
      } finally {
        setIsCheckingPwned(false);
      }
    };
    const timer = setTimeout(checkPwned, 400);
    return () => clearTimeout(timer);
  }, [auditorPassword]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  // ==========================================
  // AUTHENTICATION SCREEN
  // ==========================================
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto w-14 h-14 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              {isRegistering ? <UserPlus className="w-7 h-7" /> : <Lock className="w-7 h-7" />}
            </div>
            <h1 className="text-xl font-bold text-white">
              {isRegistering ? 'Δημιουργία Λογαριασμού' : 'Είσοδος στο Vault'}
            </h1>
            <p className="text-xs text-slate-400">
              {isRegistering 
                ? 'Ξεκινήστε την ασφαλή οργάνωση των κωδικών σας' 
                : 'Συνδεθείτε για να δείτε τους κωδικούς σας'}
            </p>
          </div>

          <form onSubmit={isRegistering ? handleSignUp : handleSignIn} className="space-y-3">
            <div>
              <label className="text-[11px] text-slate-400 mb-1 block">Email</label>
              <input
                type="email"
                placeholder="π.χ. user@example.com"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400 mb-1 block">Κωδικός Πρόσβασης</label>
              <input
                type="password"
                placeholder="Τουλάχιστον 6 χαρακτήρες"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full mt-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-emerald-500/10 cursor-pointer"
            >
              <span>{isRegistering ? 'Εγγραφή' : 'Σύνδεση'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {authError && (
            <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 py-2 px-3 rounded-xl text-center">
              {authError}
            </p>
          )}

          <div className="pt-2 border-t border-slate-800/80 text-center">
            <button
              onClick={() => { setIsRegistering(!isRegistering); setAuthError(''); }}
              className="text-xs text-emerald-400 hover:underline cursor-pointer"
            >
              {isRegistering ? 'Έχετε ήδη λογαριασμό; Σύνδεση' : 'Νέος χρήστης; Δημιουργήστε λογαριασμό'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // DASHBOARD
  // ==========================================
  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      
      {/* 1. OVERLAY ΓΙΑ ΚΙΝΗΤΑ */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)} 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 md:hidden"
        />
      )}

      {/* 2. SIDEBAR (Συρτάρι στα κινητά, σταθερό σε desktop) */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50
        w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0
        transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div>
          {/* User Profile & Κουμπί κλεισίματος για κινητά */}
          <div className="p-3 border-b border-slate-800/80 flex items-center justify-between">
            <div className="p-2 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center gap-2.5 flex-1 min-w-0 mr-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-xs shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="overflow-hidden">
                <h1 className="text-xs font-bold text-white truncate">
                  {session.user.email.split('@')[0]}
                </h1>
                <p className="text-[10px] text-emerald-400 truncate flex items-center gap-1 font-medium">
                  <Shield className="w-3 h-3 inline" /> Ασφαλής Σύνδεση
                </p>
              </div>
            </div>

            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="p-2 text-slate-400 hover:text-white md:hidden cursor-pointer"
              aria-label="Κλείσιμο μενού"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <div className="p-3 space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase px-3 mb-2 block tracking-wider">Εργαλεια</span>
            <button
              onClick={() => { setActiveView('vault'); setSelectedCategory('all'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                activeView === 'vault' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <FolderLock className="w-4 h-4" />
              <span>Οι Κωδικοί μου ({activeVault.length})</span>
            </button>

            <button
              onClick={() => { setActiveView('trash'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                activeView === 'trash' ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-3">
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span>Κάδος ({trashItems.length})</span>
              </span>
            </button>

            <button
              onClick={() => { setActiveView('auditor'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                activeView === 'auditor' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Έλεγχος Διαρροών</span>
            </button>

            <button
              onClick={() => { setActiveView('generator'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                activeView === 'generator' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <Dices className="w-4 h-4" />
              <span>Γεννήτρια Κωδικών</span>
            </button>
          </div>

          {/* Categories */}
          <div className="p-3 border-t border-slate-800/80 space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase px-3 mb-2 block tracking-wider">Κατηγοριες</span>
            
            <button
              onClick={() => { setActiveView('vault'); setSelectedCategory('all'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors ${
                selectedCategory === 'all' && activeView === 'vault' ? 'text-emerald-400 font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5"><FolderLock className="w-3.5 h-3.5" /> Όλα</span>
              <span className="text-[10px] text-slate-500">{activeVault.length}</span>
            </button>

            <button
              onClick={() => { setActiveView('vault'); setSelectedCategory('banking'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors ${
                selectedCategory === 'banking' && activeView === 'vault' ? 'text-emerald-400 font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5"><Landmark className="w-3.5 h-3.5 text-amber-400" /> Τράπεζες</span>
              <span className="text-[10px] text-slate-500">{activeVault.filter(i => i.category === 'banking').length}</span>
            </button>

            <button
              onClick={() => { setActiveView('vault'); setSelectedCategory('email'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors ${
                selectedCategory === 'email' && activeView === 'vault' ? 'text-emerald-400 font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5"><Mail className="w-3.5 h-3.5 text-sky-400" /> E-mails</span>
              <span className="text-[10px] text-slate-500">{activeVault.filter(i => i.category === 'email').length}</span>
            </button>

            <button
              onClick={() => { setActiveView('vault'); setSelectedCategory('social'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors ${
                selectedCategory === 'social' && activeView === 'vault' ? 'text-emerald-400 font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5"><Share2 className="w-3.5 h-3.5 text-pink-400" /> Social Media</span>
              <span className="text-[10px] text-slate-500">{activeVault.filter(i => i.category === 'social').length}</span>
            </button>

            <button
              onClick={() => { setActiveView('vault'); setSelectedCategory('work'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors ${
                selectedCategory === 'work' && activeView === 'vault' ? 'text-emerald-400 font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5"><Briefcase className="w-3.5 h-3.5 text-purple-400" /> Εργασία / Σπουδές</span>
              <span className="text-[10px] text-slate-500">{activeVault.filter(i => i.category === 'work').length}</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Επαναχρησιμοποιούμενα:</span>
            <span className={`font-mono font-bold ${reusedCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {reusedCount}
            </span>
          </div>

          <button
            onClick={handleSignOut}
            className="w-full py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-xl text-xs text-slate-300 font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400" />
            <span>Αποσύνδεση</span>
          </button>
        </div>
      </aside>

      {/* 3. MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col overflow-y-auto relative pb-28 w-full min-w-0">
        
        {/* Mobile Top Header με Hamburger */}
        <header className="md:hidden flex items-center justify-between p-4 bg-slate-900/90 border-b border-slate-800 sticky top-0 z-30 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 hover:text-white cursor-pointer"
              aria-label="Άνοιγμα μενού"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-xs font-bold text-white">Password Vault</span>
          </div>
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </header>

        {/* VIEW 1: VAULT */}
        {activeView === 'vault' && (
          <div className="p-4 md:p-8 max-w-5xl w-full mx-auto space-y-6">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">Οι Κωδικοί μου</h2>
                <p className="text-xs text-slate-400">
                  Αποθηκευμένοι με ασφάλεια στον προσωπικό σας λογαριασμό
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Αναζήτηση υπηρεσίας..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setFilterSecurity('all')}
                className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  filterSecurity === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Όλα
              </button>
              <button
                onClick={() => setFilterSecurity('reused')}
                className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  filterSecurity === 'reused' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'text-slate-400 hover:text-white'
                }`}
              >
                Επαναχρησιμοποιούμενα ({reusedCount})
              </button>
              <button
                onClick={() => setFilterSecurity('weak')}
                className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  filterSecurity === 'weak' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-slate-400 hover:text-white'
                }`}
              >
                Αδύναμα (&lt; 45 bits)
              </button>
            </div>

            {dataLoading ? (
              <div className="text-center py-16 text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                <span>Φόρτωση κωδικών...</span>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredVault.length === 0 ? (
                  <div className="text-center py-16 text-slate-500 text-xs bg-slate-900/40 rounded-2xl border border-slate-800">
                    Δεν υπάρχουν αποθηκευμένοι κωδικοί. Πατήστε παρακάτω για προσθήκη!
                  </div>
                ) : (
                  filteredVault.map((item) => {
                    const clearPwd = decryptedPasswords[item.id] || item.encrypted_password || '';
                    const entropy = calculateEntropy(clearPwd);
                    const isReused = clearPwd && passwordOccurrences[clearPwd] > 1;
                    const isVisible = visiblePasswords[item.id];

                    return (
                      <div 
                        key={item.id} 
                        className="bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors"
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-slate-400 shrink-0">
                            {item.category === 'banking' && <Landmark className="w-4 h-4 text-amber-400" />}
                            {item.category === 'email' && <Mail className="w-4 h-4 text-sky-400" />}
                            {item.category === 'social' && <Share2 className="w-4 h-4 text-pink-400" />}
                            {item.category === 'work' && <Briefcase className="w-4 h-4 text-purple-400" />}
                          </div>
                          <div className="overflow-hidden">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-white truncate">{item.service}</span>
                              {isReused && (
                                <span className="text-[10px] bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded-full border border-rose-500/30">
                                  Reused
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-slate-400 truncate block">{item.username}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/60">
                          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                            <span className="font-mono text-xs text-slate-300">
                              {isVisible ? clearPwd : '••••••••••••'}
                            </span>
                            <button 
                              onClick={() => setVisiblePasswords(p => ({ ...p, [item.id]: !p[item.id] }))}
                              className="text-slate-500 hover:text-slate-300 cursor-pointer"
                            >
                              {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>

                          <div className="text-right min-w-[60px]">
                            <span className={`text-xs font-mono font-bold ${
                              entropy < 40 ? 'text-rose-400' : entropy < 60 ? 'text-amber-400' : 'text-emerald-400'
                            }`}>
                              {entropy} bits
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => copyToClipboard(clearPwd)}
                              className="p-1.5 text-slate-500 hover:text-white transition-colors cursor-pointer"
                              title="Αντιγραφή"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => moveToTrash(item.id)}
                              className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                              title="Μεταφορά στον Κάδο"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

          </div>
        )}

        {/* VIEW 2: TRASH */}
        {activeView === 'trash' && (
          <div className="p-4 md:p-8 max-w-5xl w-full mx-auto space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-400" />
                Κάδος Ανακύκλωσης
              </h2>
              <p className="text-xs text-slate-400">Διεγραμμένοι κωδικοί που μπορείτε να επαναφέρετε</p>
            </div>

            <div className="space-y-3">
              {trashItems.length === 0 ? (
                <div className="text-center py-16 text-slate-500 text-xs bg-slate-900/40 rounded-2xl border border-slate-800">
                  Ο κάδος είναι άδειος.
                </div>
              ) : (
                trashItems.map((item) => (
                  <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-white">{item.service}</div>
                      <div className="text-xs text-slate-400">{item.username}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => restoreFromTrash(item.id)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Επαναφορά
                      </button>
                      <button
                        onClick={() => permanentDelete(item.id)}
                        className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Διαγραφή
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* VIEW 3: AUDITOR */}
        {activeView === 'auditor' && (
          <div className="p-4 md:p-8 max-w-2xl w-full mx-auto space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">Έλεγχος Διαρροών</h2>
              <p className="text-xs text-slate-400">Ελέγξτε αν ένας κωδικός έχει διαρρεύσει στο διαδίκτυο</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
              <input
                type="text"
                value={auditorPassword}
                onChange={(e) => setAuditorPassword(e.target.value)}
                placeholder="Δοκιμάστε οποιονδήποτε κωδικό..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono text-sm"
              />

              <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 block">Ισχύς Κωδικού (Entropy)</span>
                  <span className="text-2xl font-bold text-white font-mono">
                    {calculateEntropy(auditorPassword)} <span className="text-xs font-normal text-slate-500">bits</span>
                  </span>
                </div>
              </div>

              {auditorPassword && (
                <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800 flex items-center gap-3">
                  {isCheckingPwned ? (
                    <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                  ) : pwnedCount > 0 ? (
                    <>
                      <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
                      <span className="text-xs text-rose-400">Βρέθηκε σε διαρροές <b>{pwnedCount.toLocaleString()}</b> φορές!</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                      <span className="text-xs text-emerald-400">Καμία γνωστή διαρροή βάσης δεδομένων.</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW 4: GENERATOR */}
        {activeView === 'generator' && (
          <div className="p-4 md:p-8 max-w-2xl w-full mx-auto space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">Γεννήτρια Κωδικών</h2>
              <p className="text-xs text-slate-400">Δημιουργία ισχυρών, τυχαίων κωδικών</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
                <span className="font-mono text-emerald-400 text-lg tracking-wider break-all mr-4">
                  {generatedPassword || 'Επιλέξτε τουλάχιστον έναν τύπο χαρακτήρων'}
                </span>
                <div className="flex gap-2 shrink-0">
                  <button onClick={generatePassword} className="p-2 bg-slate-900 hover:bg-slate-850 text-slate-300 rounded-xl border border-slate-800 transition-colors cursor-pointer">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button onClick={() => copyToClipboard(generatedPassword)} className="p-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded-xl transition-colors cursor-pointer">
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Μήκος Χαρακτήρων</span>
                  <span className="font-mono text-white font-bold">{genLength}</span>
                </div>
                <input
                  type="range"
                  min="6"
                  max="64"
                  value={genLength}
                  onChange={(e) => setGenLength(Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <label className="flex items-center gap-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800 cursor-pointer">
                  <input type="checkbox" checked={genLower} onChange={(e) => setGenLower(e.target.checked)} className="accent-emerald-500 rounded" />
                  <span className="text-xs font-semibold text-white">Πεζά (a-z)</span>
                </label>
                <label className="flex items-center gap-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800 cursor-pointer">
                  <input type="checkbox" checked={genUpper} onChange={(e) => setGenUpper(e.target.checked)} className="accent-emerald-500 rounded" />
                  <span className="text-xs font-semibold text-white">Κεφαλαία (A-Z)</span>
                </label>
                <label className="flex items-center gap-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800 cursor-pointer">
                  <input type="checkbox" checked={genDigits} onChange={(e) => setGenDigits(e.target.checked)} className="accent-emerald-500 rounded" />
                  <span className="text-xs font-semibold text-white">Αριθμοί (0-9)</span>
                </label>
                <label className="flex items-center gap-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800 cursor-pointer">
                  <input type="checkbox" checked={genSymbols} onChange={(e) => setGenSymbols(e.target.checked)} className="accent-emerald-500 rounded" />
                  <span className="text-xs font-semibold text-white">Σύμβολα (!@#$)</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* BOTTOM FIXED BAR - ΚΕΝΤΡΑΡΙΣΜΕΝΟ ΣΕ ΚΙΝΗΤΑ ΚΑΙ DESKTOP */}
        {activeView === 'vault' && (
          <div className="fixed bottom-6 left-0 right-0 md:left-64 flex justify-center px-4 pointer-events-none z-20">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="pointer-events-auto bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-3 rounded-2xl text-xs flex items-center gap-2 shadow-2xl shadow-emerald-500/20 transition-all hover:scale-105 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Προσθήκη Κωδικού</span>
            </button>
          </div>
        )}

      </main>

      {/* MODAL: ADD NEW PASSWORD */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-sm font-bold text-white flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-emerald-400" />
                Προσθήκη Νέου Κωδικού
              </span>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={addVaultEntry} className="space-y-3">
              <div>
                <label className="text-[11px] text-slate-400 mb-1 block">Υπηρεσία / Ιστότοπος</label>
                <input
                  type="text"
                  placeholder="π.χ. Netflix, Τράπεζα Πειραιώς"
                  value={newService}
                  onChange={(e) => setNewService(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 mb-1 block">Username / Email</label>
                <input
                  type="text"
                  placeholder="π.χ. user@example.com"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 mb-1 block">Κωδικός Πρόσβασης</label>
                <input
                  type="password"
                  placeholder="Εισάγετε τον κωδικό"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 mb-1 block">Κατηγορία</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
                >
                  <option value="banking">Τράπεζα (Banking)</option>
                  <option value="email">Ηλεκτρονικό Ταχυδρομείο (Email)</option>
                  <option value="social">Social Media</option>
                  <option value="work">Εργασία / Σπουδές</option>
                </select>
              </div>

              <div className="pt-2 flex gap-2">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="w-1/2 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors">
                  Ακύρωση
                </button>
                <button type="submit" className="w-1/2 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-bold transition-colors">
                  Αποθήκευση
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}  