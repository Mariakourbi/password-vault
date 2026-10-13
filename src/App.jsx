import { useState, useEffect, useMemo } from 'react';
import * as OTPAuth from 'otpauth';
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
  Shield, 
  Settings, 
  Key, 
  AlertTriangle,
  Pencil,
  Globe,
  ExternalLink,
  Smartphone,
  Sun,
  Moon,
  FileText,
  ChevronDown,
  ChevronUp,
  Clock,
  Sparkles,
  CheckCircle2
} from 'lucide-react';

function formatWebsiteUrl(url, service) {
  const target = (url && url.trim()) || service;
  if (!target) return '#';
  let cleaned = target.trim();
  if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = cleaned.includes('.') ? `https://${cleaned}` : `https://${cleaned}.com`;
  }
  return cleaned;
}

function getServiceFaviconUrl(serviceName, websiteUrl) {
  const target = (websiteUrl && websiteUrl.trim()) || serviceName;
  if (!target) return null;
  const cleaned = target.trim().toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '');
  const domain = cleaned.includes('.') ? cleaned.split('/')[0] : `${cleaned}.com`;
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

function getTOTPCode(secret) {
  if (!secret) return null;
  try {
    const cleanSecret = secret.trim().replace(/\s+/g, '').toUpperCase();
    const totp = new OTPAuth.TOTP({
      issuer: 'Vault',
      label: 'User',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(cleanSecret)
    });
    return totp.generate();
  } catch (err) {
    return null;
  }
}

function getPasswordAgeInfo(dateString) {
  if (!dateString) return { days: 0, text: 'Πρόσφατος', status: 'fresh' };
  const updatedDate = new Date(dateString);
  const diffMs = Date.now() - updatedDate.getTime();
  const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  let text = '';
  if (days === 0) text = 'Σήμερα';
  else if (days === 1) text = 'Χθες';
  else if (days < 30) text = `${days}ημ.`;
  else if (days < 365) {
    const months = Math.floor(days / 30);
    text = `${months}μ.`;
  } else {
    const years = (days / 365).toFixed(1);
    text = `${years}έτη`;
  }

  let status = 'fresh';
  if (days >= 180) status = 'expired';
  else if (days >= 90) status = 'warning';

  return { days, text, status };
}

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Theme State
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('vault_theme') || 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('vault_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // TOTP Remaining Timer
  const [totpRemaining, setTotpRemaining] = useState(30 - (Math.floor(Date.now() / 1000) % 30));

  useEffect(() => {
    const interval = setInterval(() => {
      setTotpRemaining(30 - (Math.floor(Date.now() / 1000) % 30));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Toast
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Copy Feedback State
  const [copiedId, setCopiedId] = useState(null);

  // Encryption Key
  const [encryptionKey, setEncryptionKey] = useState(null);

  // Dashboard
  const [activeView, setActiveView] = useState('vault');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [filterSecurity, setFilterSecurity] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Vault Items & Decrypted Maps
  const [vaultItems, setVaultItems] = useState([]);
  const [decryptedPasswords, setDecryptedPasswords] = useState({});
  const [decryptedTotpSecrets, setDecryptedTotpSecrets] = useState({});
  const [decryptedNotes, setDecryptedNotes] = useState({});
  const [expandedNotes, setExpandedNotes] = useState({});
  const [dataLoading, setDataLoading] = useState(false);

  // Form State
  const [formService, setFormService] = useState('');
  const [formWebsiteUrl, setFormWebsiteUrl] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formTotpSecret, setFormTotpSecret] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formCategory, setFormCategory] = useState('banking');
  const [visiblePasswords, setVisiblePasswords] = useState({});

  // Settings
  const [oldPasswordInput, setOldPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [settingsMsg, setSettingsMsg] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Generator
  const [genLength, setGenLength] = useState(16);
  const [genLower, setGenLower] = useState(true);
  const [genUpper, setGenUpper] = useState(true);
  const [genDigits, setGenDigits] = useState(true);
  const [genSymbols, setGenSymbols] = useState(true);
  const [generatedPassword, setGeneratedPassword] = useState('');

  // Auditor
  const [auditorPassword, setAuditorPassword] = useState('');
  const [pwnedCount, setPwnedCount] = useState(null);
  const [isCheckingPwned, setIsCheckingPwned] = useState(false);

  // Auth Session Watcher
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
        setDecryptedTotpSecrets({});
        setDecryptedNotes({});
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch & Decrypt
  const fetchVault = async (activeKey) => {
    if (!session?.user) return;
    setDataLoading(true);

    const { data, error } = await supabase
      .from('vault_items')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setVaultItems(data);

      const decPassMap = {};
      const decTotpMap = {};
      const decNotesMap = {};

      for (const item of data) {
        if (item.encrypted_password) {
          if (activeKey) {
            const res = await decryptText(item.encrypted_password, activeKey);
            decPassMap[item.id] = res === '[Σφάλμα Αποκρυπτογράφησης]' ? item.encrypted_password : res;
          } else {
            decPassMap[item.id] = item.encrypted_password;
          }
        } else {
          decPassMap[item.id] = '';
        }

        if (item.totp_secret) {
          if (activeKey) {
            const res = await decryptText(item.totp_secret, activeKey);
            decTotpMap[item.id] = res === '[Σφάλμα Αποκρυπτογράφησης]' ? '' : res;
          } else {
            decTotpMap[item.id] = item.totp_secret;
          }
        } else {
          decTotpMap[item.id] = '';
        }

        if (item.notes) {
          if (activeKey) {
            const res = await decryptText(item.notes, activeKey);
            decNotesMap[item.id] = res === '[Σφάλμα Αποκρυπτογράφησης]' ? '' : res;
          } else {
            decNotesMap[item.id] = item.notes;
          }
        } else {
          decNotesMap[item.id] = '';
        }
      }

      setDecryptedPasswords(decPassMap);
      setDecryptedTotpSecrets(decTotpMap);
      setDecryptedNotes(decNotesMap);
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
      showToast('Επιτυχής δημιουργία λογαριασμού!');
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
      showToast('Καλωσήρθατε στο Vault!');
    }
  };

  const handleSignOut = async () => {
    setEncryptionKey(null);
    setDecryptedPasswords({});
    setDecryptedTotpSecrets({});
    setDecryptedNotes({});
    setIsSidebarOpen(false);
    await supabase.auth.signOut();
    showToast('Αποσυνδεθήκατε με ασφάλεια.');
  };

  // Add / Edit Entry
  const handleSaveEntry = async (e) => {
    e.preventDefault();
    if (!formService.trim() || !formPassword.trim()) return;

    let cipherPassword = formPassword.trim();
    let cipherTotp = formTotpSecret.trim() ? formTotpSecret.trim() : null;
    let cipherNotes = formNotes.trim() ? formNotes.trim() : null;

    if (encryptionKey) {
      cipherPassword = await encryptText(formPassword.trim(), encryptionKey);
      if (cipherTotp) cipherTotp = await encryptText(cipherTotp, encryptionKey);
      if (cipherNotes) cipherNotes = await encryptText(cipherNotes, encryptionKey);
    }

    const nowTimestamp = new Date().toISOString();

    if (editingItem) {
      const passwordChanged = formPassword.trim() !== decryptedPasswords[editingItem.id];
      const updatedTimestamp = passwordChanged ? nowTimestamp : (editingItem.password_updated_at || editingItem.created_at || nowTimestamp);

      const { error } = await supabase
        .from('vault_items')
        .update({
          service: formService.trim(),
          username: formUsername.trim() || '-',
          encrypted_password: cipherPassword,
          category: formCategory,
          website_url: formWebsiteUrl.trim() || null,
          totp_secret: cipherTotp,
          notes: cipherNotes,
          password_updated_at: updatedTimestamp
        })
        .eq('id', editingItem.id);

      if (!error) {
        setVaultItems(vaultItems.map(i => i.id === editingItem.id ? {
          ...i,
          service: formService.trim(),
          username: formUsername.trim() || '-',
          encrypted_password: cipherPassword,
          category: formCategory,
          website_url: formWebsiteUrl.trim() || null,
          totp_secret: cipherTotp,
          notes: cipherNotes,
          password_updated_at: updatedTimestamp
        } : i));
        setDecryptedPasswords(prev => ({ ...prev, [editingItem.id]: formPassword.trim() }));
        setDecryptedTotpSecrets(prev => ({ ...prev, [editingItem.id]: formTotpSecret.trim() }));
        setDecryptedNotes(prev => ({ ...prev, [editingItem.id]: formNotes.trim() }));
        setEditingItem(null);
        setIsAddModalOpen(false);
        showToast('Ο κωδικός ενημερώθηκε επιτυχώς!');
      } else {
        showToast('Σφάλμα: ' + error.message, 'error');
      }
    } else {
      const { data, error } = await supabase
        .from('vault_items')
        .insert([
          {
            user_id: session.user.id,
            service: formService.trim(),
            username: formUsername.trim() || '-',
            encrypted_password: cipherPassword,
            category: formCategory,
            website_url: formWebsiteUrl.trim() || null,
            totp_secret: cipherTotp,
            notes: cipherNotes,
            password_updated_at: nowTimestamp,
            is_deleted: false
          }
        ])
        .select();

      if (!error && data) {
        const newItem = data[0];
        setVaultItems([newItem, ...vaultItems]);
        setDecryptedPasswords(prev => ({ ...prev, [newItem.id]: formPassword.trim() }));
        setDecryptedTotpSecrets(prev => ({ ...prev, [newItem.id]: formTotpSecret.trim() }));
        setDecryptedNotes(prev => ({ ...prev, [newItem.id]: formNotes.trim() }));
        setIsAddModalOpen(false);
        showToast('Ο κωδικός προστέθηκε στο Vault!');
      } else if (error) {
        showToast('Σφάλμα κατά την αποθήκευση: ' + error.message, 'error');
      }
    }
  };

  const openAddModal = () => {
    setEditingItem(null);
    setFormService('');
    setFormWebsiteUrl('');
    setFormUsername('');
    setFormPassword('');
    setFormTotpSecret('');
    setFormNotes('');
    setFormCategory('banking');
    setIsAddModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormService(item.service);
    setFormWebsiteUrl(item.website_url || '');
    setFormUsername(item.username === '-' ? '' : item.username);
    setFormPassword(decryptedPasswords[item.id] || '');
    setFormTotpSecret(decryptedTotpSecrets[item.id] || '');
    setFormNotes(decryptedNotes[item.id] || '');
    setFormCategory(item.category);
    setIsAddModalOpen(true);
  };

  const moveToTrash = async (id) => {
    const { error } = await supabase
      .from('vault_items')
      .update({ is_deleted: true })
      .eq('id', id);

    if (!error) {
      setVaultItems(vaultItems.map(item => item.id === id ? { ...item, is_deleted: true } : item));
      showToast('Μεταφέρθηκε στον κάδο.');
    }
  };

  const restoreFromTrash = async (id) => {
    const { error } = await supabase
      .from('vault_items')
      .update({ is_deleted: false })
      .eq('id', id);

    if (!error) {
      setVaultItems(vaultItems.map(item => item.id === id ? { ...item, is_deleted: false } : item));
      showToast('Ο κωδικός επαναφέρθηκε!');
    }
  };

  const permanentDelete = async (id) => {
    const { error } = await supabase
      .from('vault_items')
      .delete()
      .eq('id', id);

    if (!error) {
      setVaultItems(vaultItems.filter(item => item.id !== id));
      setDecryptedPasswords(prev => { const c = { ...prev }; delete c[id]; return c; });
      setDecryptedTotpSecrets(prev => { const c = { ...prev }; delete c[id]; return c; });
      setDecryptedNotes(prev => { const c = { ...prev }; delete c[id]; return c; });
      showToast('Διαγράφηκε οριστικά.');
    }
  };

  // Change Master Password
  const handleChangeMasterPassword = async (e) => {
    e.preventDefault();
    setSettingsError('');
    setSettingsMsg('');

    if (newPasswordInput.length < 6) {
      setSettingsError('Ο νέος κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.');
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setSettingsError('Οι νέοι κωδικοί δεν ταιριάζουν μεταξύ τους.');
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: session.user.email,
        password: oldPasswordInput,
      });

      if (signInError) {
        setSettingsError('Ο τρέχων κωδικός πρόσβασης είναι λανθασμένος.');
        setIsChangingPassword(false);
        return;
      }

      const newDerivedKey = await deriveKey(newPasswordInput, session.user.id);

      for (const item of vaultItems) {
        const clearPass = decryptedPasswords[item.id] || '';
        const clearTotp = decryptedTotpSecrets[item.id] || '';
        const clearNote = decryptedNotes[item.id] || '';
        
        let newPassCipher = item.encrypted_password;
        let newTotpCipher = item.totp_secret;
        let newNoteCipher = item.notes;

        if (clearPass) newPassCipher = await encryptText(clearPass, newDerivedKey);
        if (clearTotp) newTotpCipher = await encryptText(clearTotp, newDerivedKey);
        if (clearNote) newNoteCipher = await encryptText(clearNote, newDerivedKey);

        await supabase
          .from('vault_items')
          .update({ 
            encrypted_password: newPassCipher,
            totp_secret: newTotpCipher,
            notes: newNoteCipher
          })
          .eq('id', item.id);
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPasswordInput
      });

      if (updateError) throw updateError;

      setEncryptionKey(newDerivedKey);
      setSettingsMsg('Ο κωδικός πρόσβασης άλλαξε με επιτυχία!');
      setOldPasswordInput('');
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      showToast('Το Master Password ενημερώθηκε!');
    } catch (err) {
      setSettingsError('Σφάλμα: ' + err.message);
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Delete Account
  const handleDeleteAccount = async () => {
    if (!window.confirm('ΠΡΟΣΟΧΗ: Αυτή η ενέργεια θα διαγράψει οριστικά όλους τους κωδικούς σας. Συνέχεια;')) return;
    setIsDeletingAccount(true);
    try {
      const { error } = await supabase.from('vault_items').delete().eq('user_id', session.user.id);
      if (error) throw error;
      showToast('Όλα τα δεδομένα διαγράφηκαν.');
      await handleSignOut();
    } catch (err) {
      showToast('Σφάλμα διαγραφής: ' + err.message, 'error');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const activeVault = useMemo(() => vaultItems.filter(i => !i.is_deleted), [vaultItems]);
  const trashItems = useMemo(() => vaultItems.filter(i => i.is_deleted), [vaultItems]);

  const passwordOccurrences = useMemo(() => {
    const counts = {};
    activeVault.forEach(item => {
      const clearPwd = decryptedPasswords[item.id] || '';
      if (clearPwd) counts[clearPwd] = (counts[clearPwd] || 0) + 1;
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

  const weakCount = useMemo(() => {
    return activeVault.filter(item => {
      const clearPwd = decryptedPasswords[item.id] || '';
      return clearPwd && calculateEntropy(clearPwd) < 45;
    }).length;
  }, [activeVault, decryptedPasswords]);

  const expiredCount = useMemo(() => {
    return activeVault.filter(item => {
      const age = getPasswordAgeInfo(item.password_updated_at || item.created_at);
      return age.status === 'expired';
    }).length;
  }, [activeVault]);

  // Υπολογισμός Security Health Score (0 - 100%)
  const healthScore = useMemo(() => {
    if (activeVault.length === 0) return 100;
    let deductions = 0;
    deductions += (weakCount / activeVault.length) * 45;
    deductions += (reusedCount / activeVault.length) * 35;
    deductions += (expiredCount / activeVault.length) * 20;
    return Math.max(10, Math.round(100 - deductions));
  }, [activeVault, weakCount, reusedCount, expiredCount]);

  const filteredVault = useMemo(() => {
    return activeVault.filter(item => {
      const clearPwd = decryptedPasswords[item.id] || '';
      const matchesSearch = item.service.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            item.username.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const isReused = clearPwd && passwordOccurrences[clearPwd] > 1;
      const isWeak = clearPwd && calculateEntropy(clearPwd) < 45;
      const age = getPasswordAgeInfo(item.password_updated_at || item.created_at);

      let matchesSecurity = true;
      if (filterSecurity === 'reused') matchesSecurity = isReused;
      if (filterSecurity === 'weak') matchesSecurity = isWeak;
      if (filterSecurity === 'expired') matchesSecurity = age.status === 'expired';

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

  const copyToClipboard = (text, label = 'Ο κωδικός', id = null) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (id) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
    showToast(`${label} αντιγράφηκε!`);
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
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  // ==========================================
  // AUTHENTICATION SCREEN
  // ==========================================
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col items-center justify-center p-4 transition-colors">
        {toast && (
          <div className={`fixed top-5 z-50 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-2xl flex items-center gap-2 border ${
            toast.type === 'error' ? 'bg-rose-500/20 text-rose-600 dark:text-rose-300 border-rose-500/30' : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
          }`}>
            <span>{toast.message}</span>
          </div>
        )}
        <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl dark:shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto w-14 h-14 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 flex items-center justify-center text-emerald-500">
              {isRegistering ? <UserPlus className="w-7 h-7" /> : <Lock className="w-7 h-7" />}
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              {isRegistering ? 'Δημιουργία Λογαριασμού' : 'Είσοδος στο Vault'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isRegistering 
                ? 'Ξεκινήστε την ασφαλή οργάνωση των κωδικών σας' 
                : 'Συνδεθείτε για να δείτε τους κωδικούς σας'}
            </p>
          </div>

          <form onSubmit={isRegistering ? handleSignUp : handleSignIn} className="space-y-3" autoComplete="off">
            <div>
              <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1 block">Email</label>
              <input
                type="email"
                name="auth_email"
                autoComplete="new-password"
                placeholder="π.χ. user@example.com"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1 block">Κωδικός Πρόσβασης</label>
              <input
                type="password"
                name="auth_password"
                autoComplete="new-password"
                placeholder="Τουλάχιστον 6 χαρακτήρες"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full mt-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              <span>{isRegistering ? 'Εγγραφή' : 'Σύνδεση'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {authError && (
            <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 py-2 px-3 rounded-xl text-center">
              {authError}
            </p>
          )}

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-center">
            <button
              onClick={() => { setIsRegistering(!isRegistering); setAuthError(''); }}
              className="text-xs text-emerald-600 dark:text-emerald-400 font-medium hover:underline cursor-pointer"
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
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans transition-colors">
      
      {/* FLOATING TOAST NOTIFICATION */}
      {toast && (
        <div className={`fixed top-4 right-4 left-4 sm:left-auto sm:w-80 z-50 px-4 py-3 rounded-2xl text-xs font-semibold shadow-2xl flex items-center gap-2 border transition-all animate-in slide-in-from-top duration-200 ${
          toast.type === 'error' ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-300 border-rose-200 dark:border-rose-500/30' : 'bg-white dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
        }`}>
          {toast.type === 'error' ? <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" /> : <Check className="w-4 h-4 text-emerald-500 shrink-0" />}
          <span className="truncate">{toast.message}</span>
        </div>
      )}

      {/* OVERLAY ΓΙΑ ΚΙΝΗΤΑ */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)} 
          className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm z-40 md:hidden"
        />
      )}

      {/* SIDEBAR */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50
        w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between shrink-0
        transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div>
          {/* User Profile & Theme Toggle */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="p-2 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-center gap-2.5 flex-1 min-w-0 mr-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-xs shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="overflow-hidden">
                <h1 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {session.user.email.split('@')[0]}
                </h1>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 truncate flex items-center gap-1 font-medium">
                  <Shield className="w-3 h-3 inline" /> Ασφαλής Σύνδεση
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button 
                onClick={toggleTheme}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title={theme === 'dark' ? "Αλλαγή σε Φωτεινό Θέμα" : "Αλλαγή σε Σκοτεινό Θέμα"}
              >
                {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
              </button>

              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white md:hidden cursor-pointer"
                aria-label="Κλείσιμο μενού"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Navigation */}
          <div className="p-3 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase px-3 mb-2 block tracking-wider">Εργαλεια</span>
            <button
              onClick={() => { setActiveView('vault'); setSelectedCategory('all'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                activeView === 'vault' ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-200 dark:border-emerald-500/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FolderLock className="w-4 h-4" />
              <span>Οι Κωδικοί μου ({activeVault.length})</span>
            </button>

            <button
              onClick={() => { setActiveView('trash'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                activeView === 'trash' ? 'bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="flex items-center gap-3">
                <Trash2 className="w-4 h-4 text-rose-500" />
                <span>Κάδος ({trashItems.length})</span>
              </span>
            </button>

            <button
              onClick={() => { setActiveView('auditor'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                activeView === 'auditor' ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Έλεγχος Διαρροών</span>
            </button>

            <button
              onClick={() => { setActiveView('generator'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                activeView === 'generator' ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Dices className="w-4 h-4" />
              <span>Γεννήτρια Κωδικών</span>
            </button>

            <button
              onClick={() => { setActiveView('settings'); setIsSidebarOpen(false); setSettingsMsg(''); setSettingsError(''); }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                activeView === 'settings' ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Ρυθμίσεις & Ασφάλεια</span>
            </button>
          </div>

          {/* Categories */}
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase px-3 mb-2 block tracking-wider">Κατηγοριες</span>
            
            <button
              onClick={() => { setActiveView('vault'); setSelectedCategory('all'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors ${
                selectedCategory === 'all' && activeView === 'vault' ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5"><FolderLock className="w-3.5 h-3.5" /> Όλα</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">{activeVault.length}</span>
            </button>

            <button
              onClick={() => { setActiveView('vault'); setSelectedCategory('banking'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors ${
                selectedCategory === 'banking' && activeView === 'vault' ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5"><Landmark className="w-3.5 h-3.5 text-amber-500" /> Τράπεζες</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">{activeVault.filter(i => i.category === 'banking').length}</span>
            </button>

            <button
              onClick={() => { setActiveView('vault'); setSelectedCategory('email'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors ${
                selectedCategory === 'email' && activeView === 'vault' ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5"><Mail className="w-3.5 h-3.5 text-sky-500" /> E-mails</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">{activeVault.filter(i => i.category === 'email').length}</span>
            </button>

            <button
              onClick={() => { setActiveView('vault'); setSelectedCategory('social'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors ${
                selectedCategory === 'social' && activeView === 'vault' ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5"><Share2 className="w-3.5 h-3.5 text-pink-500" /> Social Media</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">{activeVault.filter(i => i.category === 'social').length}</span>
            </button>

            <button
              onClick={() => { setActiveView('vault'); setSelectedCategory('work'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors ${
                selectedCategory === 'work' && activeView === 'vault' ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5"><Briefcase className="w-3.5 h-3.5 text-purple-500" /> Εργασία / Σπουδές</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">{activeVault.filter(i => i.category === 'work').length}</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Επαναχρησιμοποιούμενα:</span>
            <span className={`font-mono font-bold ${reusedCount > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
              {reusedCount}
            </span>
          </div>

          <button
            onClick={handleSignOut}
            className="w-full py-2 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-300 font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-500" />
            <span>Αποσύνδεση</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col overflow-y-auto relative pb-28 w-full min-w-0">
        
        {/* Mobile Top Header */}
        <header className="md:hidden flex items-center justify-between p-3.5 bg-white/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-300 cursor-pointer"
              aria-label="Άνοιγμα μενού"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white block leading-tight">Password Vault</span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">Zero-Knowledge</span>
            </div>
          </div>
          
          <button 
            onClick={toggleTheme}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>
        </header>

        {/* VIEW 1: VAULT */}
        {activeView === 'vault' && (
          <div className="p-3.5 sm:p-6 md:p-8 max-w-6xl w-full mx-auto space-y-4 sm:space-y-6">
            
            {/* Top Bar: Title & Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white">Οι Κωδικοί μου</h2>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                  {activeVault.length} αποθηκευμένοι λογαριασμοί με κρυπτογράφηση AES-256
                </p>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Αναζήτηση υπηρεσίας ή username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 shadow-sm"
                />
              </div>
            </div>

            {/* Smart Security Health Dashboard Card */}
            {activeVault.length > 0 && (
              <div className="bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent dark:from-emerald-500/15 dark:via-slate-900/60 dark:to-slate-900/40 border border-emerald-500/20 dark:border-emerald-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-3.5">
                  <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                    <svg className="w-12 h-12 transform -rotate-90">
                      <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" className="text-slate-200 dark:text-slate-800" fill="transparent" />
                      <circle 
                        cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" 
                        strokeDasharray={125.6} 
                        strokeDashoffset={125.6 - (125.6 * healthScore) / 100} 
                        className={healthScore >= 80 ? 'text-emerald-500' : healthScore >= 50 ? 'text-amber-500' : 'text-rose-500'} 
                        strokeLinecap="round" 
                        fill="transparent" 
                      />
                    </svg>
                    <span className="absolute font-mono text-xs font-bold text-slate-900 dark:text-white">
                      {healthScore}%
                    </span>
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>Επίπεδο Ασφάλειας Vault</span>
                      {healthScore >= 80 ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                    </h3>
                    <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400">
                      {healthScore >= 80 
                        ? 'Εξαιρετικό! Οι κωδικοί σας είναι καλά προστατευμένοι.' 
                        : 'Υπάρχουν κωδικοί που χρειάζονται ανανέωση ή ενίσχυση.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 text-[11px] overflow-x-auto pb-1 sm:pb-0">
                  <div className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 shrink-0">
                    <span className="text-slate-400 block text-[9px] uppercase font-semibold">Αδυναμα</span>
                    <span className={`font-mono font-bold ${weakCount > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>{weakCount}</span>
                  </div>
                  <div className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 shrink-0">
                    <span className="text-slate-400 block text-[9px] uppercase font-semibold">Ίδιοι κωδικοί</span>
                    <span className={`font-mono font-bold ${reusedCount > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{reusedCount}</span>
                  </div>
                  <div className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 shrink-0">
                    <span className="text-slate-400 block text-[9px] uppercase font-semibold">Προς Αλλαγη</span>
                    <span className={`font-mono font-bold ${expiredCount > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{expiredCount}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Security Filter Pills */}
            <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 -mx-3.5 px-3.5 sm:mx-0 sm:px-0 scrollbar-none">
              <button
                onClick={() => setFilterSecurity('all')}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-medium whitespace-nowrap transition-colors ${
                  filterSecurity === 'all' ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                }`}
              >
                Όλα ({activeVault.length})
              </button>
              <button
                onClick={() => setFilterSecurity('reused')}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-medium whitespace-nowrap transition-colors ${
                  filterSecurity === 'reused' ? 'bg-rose-500 text-white font-bold' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                }`}
              >
                Reused ({reusedCount})
              </button>
              <button
                onClick={() => setFilterSecurity('weak')}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-medium whitespace-nowrap transition-colors ${
                  filterSecurity === 'weak' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                }`}
              >
                Αδύναμα ({weakCount})
              </button>
              <button
                onClick={() => setFilterSecurity('expired')}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
                  filterSecurity === 'expired' ? 'bg-rose-600 text-white font-bold' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                }`}
              >
                <Clock className="w-3 h-3" />
                <span>Προς Αλλαγή ({expiredCount})</span>
              </button>
            </div>

            {/* Vault Cards: Mobile Stacked & Desktop Grid */}
            {dataLoading ? (
              <div className="text-center py-16 text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
                <span>Φόρτωση κωδικών...</span>
              </div>
            ) : (
              <div>
                {filteredVault.length === 0 ? (
                  <div className="text-center py-14 text-slate-400 text-xs bg-white dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                    Δεν βρέθηκαν κωδικοί με αυτά τα κριτήρια.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-4">
                    {filteredVault.map((item) => {
                      const clearPwd = decryptedPasswords[item.id] || item.encrypted_password || '';
                      const clearTotp = decryptedTotpSecrets[item.id] || '';
                      const clearNote = decryptedNotes[item.id] || '';
                      const totpCode = getTOTPCode(clearTotp);
                      const entropy = calculateEntropy(clearPwd);
                      const isReused = clearPwd && passwordOccurrences[clearPwd] > 1;
                      const isVisible = visiblePasswords[item.id];
                      const isNoteOpen = expandedNotes[item.id];
                      const faviconUrl = getServiceFaviconUrl(item.service, item.website_url);
                      const targetUrl = formatWebsiteUrl(item.website_url, item.service);
                      const age = getPasswordAgeInfo(item.password_updated_at || item.created_at);
                      const isItemCopied = copiedId === item.id;

                      return (
                        <div 
                          key={item.id} 
                          className="bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between gap-3.5 transition-all shadow-sm hover:shadow-md"
                        >
                          {/* Card Header: Favicon, Name, Username, Badges */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-center shrink-0 overflow-hidden relative shadow-inner">
                                {faviconUrl ? (
                                  <img 
                                    src={faviconUrl} 
                                    alt={item.service} 
                                    className="w-5 h-5 object-contain"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                      e.currentTarget.nextElementSibling.style.display = 'block';
                                    }}
                                  />
                                ) : null}
                                <div className="hidden">
                                  {item.category === 'banking' && <Landmark className="w-4 h-4 text-amber-500" />}
                                  {item.category === 'email' && <Mail className="w-4 h-4 text-sky-500" />}
                                  {item.category === 'social' && <Share2 className="w-4 h-4 text-pink-500" />}
                                  {item.category === 'work' && <Briefcase className="w-4 h-4 text-purple-500" />}
                                </div>
                              </div>

                              <div className="overflow-hidden min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[130px] sm:max-w-[200px]">
                                    {item.service}
                                  </span>
                                  
                                  <a
                                    href={targetUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                    title="Άνοιγμα ιστοσελίδας"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                </div>
                                <span className="text-xs text-slate-500 dark:text-slate-400 truncate block">
                                  {item.username}
                                </span>
                              </div>
                            </div>

                            {/* Badges: Age & Reused */}
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span 
                                title={`Τελευταία αλλαγή: ${age.text}`}
                                className={`text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 font-medium ${
                                  age.status === 'expired' 
                                    ? 'bg-rose-500/15 text-rose-500 border-rose-500/30' 
                                    : age.status === 'warning'
                                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                                }`}
                              >
                                <Clock className="w-2.5 h-2.5" />
                                <span>{age.text}</span>
                              </span>

                              {isReused && (
                                <span className="text-[10px] bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-500/30">
                                  Reused
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 2FA Authenticator Row (if configured) */}
                          {totpCode && (
                            <div className="flex items-center justify-between bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/25 px-3 py-2 rounded-xl">
                              <div className="flex items-center gap-2">
                                <Smartphone className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">2FA</span>
                                <span className="font-mono text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 tracking-wider">
                                  {totpCode.slice(0, 3)} {totpCode.slice(3)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-mono font-bold ${totpRemaining <= 5 ? 'text-rose-500 animate-pulse' : 'text-slate-400'}`}>
                                  {totpRemaining}s
                                </span>
                                <button
                                  onClick={() => copyToClipboard(totpCode, 'Ο κωδικός 2FA')}
                                  className="p-1 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/15 transition-colors cursor-pointer"
                                  title="Αντιγραφή 2FA"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Password Display Box & Actions */}
                          <div className="bg-slate-50 dark:bg-slate-950/70 p-2 sm:p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className="font-mono text-xs sm:text-sm text-slate-800 dark:text-slate-200 truncate select-none">
                                {isVisible ? clearPwd : '••••••••••••••••'}
                              </span>
                              <button 
                                onClick={() => setVisiblePasswords(p => ({ ...p, [item.id]: !p[item.id] }))}
                                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors cursor-pointer shrink-0"
                                title={isVisible ? "Απόκρυψη" : "Προβολή"}
                              >
                                {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <span className={`text-[10px] font-mono font-bold mr-1 hidden sm:inline ${
                                entropy < 40 ? 'text-rose-500' : entropy < 60 ? 'text-amber-500' : 'text-emerald-500'
                              }`}>
                                {entropy}b
                              </span>

                              <button
                                onClick={() => copyToClipboard(clearPwd, 'Ο κωδικός', item.id)}
                                className={`p-2 rounded-lg transition-colors cursor-pointer ${
                                  isItemCopied 
                                    ? 'bg-emerald-500 text-slate-950' 
                                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800'
                                }`}
                                title="Αντιγραφή Κωδικού"
                              >
                                {isItemCopied ? <Check className="w-4 h-4 stroke-[3]" /> : <Copy className="w-4 h-4" />}
                              </button>

                              <button
                                onClick={() => openEditModal(item)}
                                className="p-2 text-slate-500 hover:text-emerald-500 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                title="Επεξεργασία"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => moveToTrash(item.id)}
                                className="p-2 text-slate-500 hover:text-rose-500 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                title="Διαγραφή"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Secure Notes Toggle (if notes exist) */}
                          {clearNote && (
                            <div className="pt-1">
                              <button
                                onClick={() => setExpandedNotes(p => ({ ...p, [item.id]: !p[item.id] }))}
                                className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 hover:underline cursor-pointer"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>{isNoteOpen ? 'Απόκρυψη Σημειώσεων' : 'Προβολή Ασφαλών Σημειώσεων'}</span>
                                {isNoteOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>

                              {isNoteOpen && (
                                <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-sans relative">
                                  <div>{clearNote}</div>
                                  <button
                                    onClick={() => copyToClipboard(clearNote, 'Οι σημειώσεις')}
                                    className="absolute top-2 right-2 p-1 text-slate-400 hover:text-emerald-500 transition-colors cursor-pointer"
                                    title="Αντιγραφή σημειώσεων"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {/* VIEW 2: TRASH */}
        {activeView === 'trash' && (
          <div className="p-4 md:p-8 max-w-4xl w-full mx-auto space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-500" />
                Κάδος Ανακύκλωσης
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Διεγραμμένοι κωδικοί που μπορείτε να επαναφέρετε</p>
            </div>

            <div className="space-y-3">
              {trashItems.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-xs bg-white dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800">
                  Ο κάδος είναι άδειος.
                </div>
              ) : (
                trashItems.map((item) => (
                  <div key={item.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                    <div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">{item.service}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{item.username}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => restoreFromTrash(item.id)}
                        className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-emerald-600 dark:text-emerald-400 text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Επαναφορά
                      </button>
                      <button
                        onClick={() => permanentDelete(item.id)}
                        className="px-3 py-1.5 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
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
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Έλεγχος Διαρροών</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Ελέγξτε αν ένας κωδικός έχει διαρρεύσει στο διαδίκτυο</p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm dark:shadow-xl space-y-5">
              <input
                type="text"
                value={auditorPassword}
                onChange={(e) => setAuditorPassword(e.target.value)}
                placeholder="Δοκιμάστε οποιονδήποτε κωδικό..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 font-mono text-sm"
              />

              <div className="bg-slate-50 dark:bg-slate-950/60 rounded-xl p-4 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">Ισχύς Κωδικού (Entropy)</span>
                  <span className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
                    {calculateEntropy(auditorPassword)} <span className="text-xs font-normal text-slate-400">bits</span>
                  </span>
                </div>
              </div>

              {auditorPassword && (
                <div className="bg-slate-50 dark:bg-slate-950/60 rounded-xl p-4 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
                  {isCheckingPwned ? (
                    <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                  ) : pwnedCount > 0 ? (
                    <>
                      <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0" />
                      <span className="text-xs text-rose-600 dark:text-rose-400">Βρέθηκε σε διαρροές <b>{pwnedCount.toLocaleString()}</b> φορές!</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
                      <span className="text-xs text-emerald-600 dark:text-emerald-400">Καμία γνωστή διαρροή βάσης δεδομένων.</span>
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
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Γεννήτρια Κωδικών</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Δημιουργία ισχυρών, τυχαίων κωδικών</p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm dark:shadow-xl space-y-6">
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between">
                <span className="font-mono text-emerald-600 dark:text-emerald-400 text-lg tracking-wider break-all mr-4 font-semibold">
                  {generatedPassword || 'Επιλέξτε τουλάχιστον έναν τύπο χαρακτήρων'}
                </span>
                <div className="flex gap-2 shrink-0">
                  <button onClick={generatePassword} className="p-2 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button onClick={() => copyToClipboard(generatedPassword, 'Ο παραγόμενος κωδικός')} className="p-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded-xl transition-colors cursor-pointer">
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Μήκος Χαρακτήρων</span>
                  <span className="font-mono text-slate-900 dark:text-white font-bold">{genLength}</span>
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
                <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer">
                  <input type="checkbox" checked={genLower} onChange={(e) => setGenLower(e.target.checked)} className="accent-emerald-500 rounded" />
                  <span className="text-xs font-semibold text-slate-800 dark:text-white">Πεζά (a-z)</span>
                </label>
                <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer">
                  <input type="checkbox" checked={genUpper} onChange={(e) => setGenUpper(e.target.checked)} className="accent-emerald-500 rounded" />
                  <span className="text-xs font-semibold text-slate-800 dark:text-white">Κεφαλαία (A-Z)</span>
                </label>
                <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer">
                  <input type="checkbox" checked={genDigits} onChange={(e) => setGenDigits(e.target.checked)} className="accent-emerald-500 rounded" />
                  <span className="text-xs font-semibold text-slate-800 dark:text-white">Αριθμοί (0-9)</span>
                </label>
                <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer">
                  <input type="checkbox" checked={genSymbols} onChange={(e) => setGenSymbols(e.target.checked)} className="accent-emerald-500 rounded" />
                  <span className="text-xs font-semibold text-slate-800 dark:text-white">Σύμβολα (!@#$)</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 5: SETTINGS */}
        {activeView === 'settings' && (
          <div className="p-4 md:p-8 max-w-2xl w-full mx-auto space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-emerald-500" />
                Ρυθμίσεις & Ασφάλεια
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Διαχειριστείτε τον κωδικό πρόσβασης και τον λογαριασμό σας
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm dark:shadow-xl space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-emerald-500" />
                Αλλαγή Master Password
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Όλα τα δεδομένα σας θα επαν-κρυπτογραφηθούν αυτόματα με το νέο κλειδί.
              </p>

              <form onSubmit={handleChangeMasterPassword} className="space-y-3" autoComplete="off">
                <div>
                  <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1 block">Τρέχων Κωδικός</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Εισάγετε τον τρέχοντα κωδικό"
                    value={oldPasswordInput}
                    onChange={(e) => setOldPasswordInput(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1 block">Νέος Κωδικός</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Τουλάχιστον 6 χαρακτήρες"
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1 block">Επιβεβαίωση Νέου Κωδικού</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Επαναλάβετε τον νέο κωδικό"
                    value={confirmPasswordInput}
                    onChange={(e) => setConfirmPasswordInput(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                {settingsError && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 py-2 px-3 rounded-xl">
                    {settingsError}
                  </p>
                )}

                {settingsMsg && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 py-2 px-3 rounded-xl">
                    {settingsMsg}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  {isChangingPassword ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Επαν-κρυπτογράφηση & Αποθήκευση...</span>
                    </>
                  ) : (
                    <span>Ενημέρωση Κωδικού</span>
                  )}
                </button>
              </form>
            </div>

            <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-500/20 rounded-3xl p-6 shadow-sm dark:shadow-xl space-y-4">
              <h3 className="text-sm font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Κατάργηση Λογαριασμού & Δεδομένων
              </h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                Η ενέργεια αυτή θα διαγράψει οριστικά όλους τους κωδικούς σας από το cloud vault και θα σας αποσυνδέσει.
              </p>

              <button
                onClick={handleDeleteAccount}
                disabled={isDeletingAccount}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                {isDeletingAccount ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Διαγραφή...</span>
                  </>
                ) : (
                  <span>Οριστική Διαγραφή Δεδομένων & Κατάργηση</span>
                )}
              </button>
            </div>

          </div>
        )}

        {/* BOTTOM FIXED BAR (FLOATING ACTION BUTTON) */}
        {activeView === 'vault' && (
          <div className="fixed bottom-5 left-0 right-0 md:left-64 flex justify-center px-4 pointer-events-none z-20">
            <button
              onClick={openAddModal}
              className="pointer-events-auto bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-6 py-3.5 rounded-2xl text-xs sm:text-sm flex items-center gap-2 shadow-2xl shadow-emerald-500/40 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Plus className="w-5 h-5 stroke-[3]" />
              <span>Προσθήκη Κωδικού</span>
            </button>
          </div>
        )}
        {/* BOTTOM RIGHT SECURITY BADGE & COPYRIGHT */}
        <div className="fixed bottom-3 right-4 z-10 pointer-events-none hidden sm:flex flex-col items-end gap-0.5 text-right opacity-70 hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
            <Shield className="w-3 h-3" />
          </div>
          <p className="text-[9px] text-slate-400 dark:text-slate-500 font-sans">
            © {new Date().getFullYear()} Password Vault • v1.4
          </p>
        </div>

      </main>

      {/* MODAL: ADD / EDIT PASSWORD */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-3.5 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 my-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {editingItem ? <Pencil className="w-4 h-4 text-emerald-500" /> : <PlusCircle className="w-4 h-4 text-emerald-500" />}
                {editingItem ? 'Επεξεργασία Κωδικού' : 'Προσθήκη Νέου Κωδικού'}
              </span>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEntry} className="space-y-3" autoComplete="off">
              <div>
                <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1 block">Υπηρεσία / Ιστότοπος</label>
                <input
                  type="text"
                  name="service_site"
                  autoComplete="off"
                  placeholder="π.χ. Google, Netflix, Spotify"
                  value={formService}
                  onChange={(e) => setFormService(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1 block">Ιστοσελίδα / URL (Προαιρετικό)</label>
                <input
                  type="text"
                  name="entry_website_url"
                  autoComplete="off"
                  placeholder="π.χ. https://spotify.com"
                  value={formWebsiteUrl}
                  onChange={(e) => setFormWebsiteUrl(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1 block">Username / Email</label>
                <input
                  type="text"
                  name="entry_account_id"
                  autoComplete="off"
                  placeholder="π.χ. user@example.com"
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1 block">Κωδικός Πρόσβασης</label>
                <input
                  type="password"
                  name="entry_credential_secret"
                  autoComplete="new-password"
                  placeholder="Εισάγετε τον κωδικό"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1 block flex items-center justify-between">
                  <span>2FA Secret / TOTP Key (Προαιρετικό)</span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Zero-Knowledge</span>
                </label>
                <input
                  type="text"
                  name="entry_totp_secret"
                  autoComplete="off"
                  placeholder="π.χ. JBSWY3DPEHPK3PXP"
                  value={formTotpSecret}
                  onChange={(e) => setFormTotpSecret(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1 block flex items-center justify-between">
                  <span>Ασφαλείς Σημειώσεις (Προαιρετικό)</span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Zero-Knowledge</span>
                </label>
                <textarea
                  rows="2"
                  name="entry_secure_notes"
                  placeholder="π.χ. PIN κάρτας, ερωτήσεις ασφαλείας, recovery codes..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 resize-none font-sans"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1 block">Κατηγορία</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-emerald-500"
                >
                  <option value="banking">Τράπεζα (Banking)</option>
                  <option value="email">Ηλεκτρονικό Ταχυδρομείο (Email)</option>
                  <option value="social">Social Media</option>
                  <option value="work">Εργασία / Σπουδές</option>
                </select>
              </div>

              <div className="pt-2 flex gap-2">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="w-1/2 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-medium transition-colors cursor-pointer">
                  Ακύρωση
                </button>
                <button type="submit" className="w-1/2 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-bold transition-colors cursor-pointer">
                  {editingItem ? 'Ενημέρωση' : 'Αποθήκευση'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}