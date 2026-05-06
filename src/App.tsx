import React, { useState, useMemo, useEffect } from 'react';
import { 
  MapPin, User, Building2, Plus, Trash2, 
  ArrowLeft, Sprout, CloudRain, Wallet, Info, LayoutGrid,
  Droplets, Receipt, Edit, Filter, X, LogOut, Mail, Lock, AlertCircle, Camera, Save, Wrench,
  Menu, ChevronRight, Home, Map, Truck, Wheat
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import LocationPicker from './components/LocationPicker';
import GanaderiaModule from './components/GanaderiaModule';
import IngresosModule from './components/IngresosModule';
import DashboardModule from './components/DashboardModule';
import MapasModule from './components/MapasModule';
import AgriculturaModule from './components/AgriculturaModule';
import MaquinariaModule from './components/MaquinariaModule';
import { auth, db } from './firebase';
import { 
  signInWithPopup, signOut, onAuthStateChanged, GoogleAuthProvider, User as FirebaseUser,
  createUserWithEmailAndPassword, signInWithEmailAndPassword
} from 'firebase/auth';
import { collection, query, onSnapshot, doc, setDoc, updateDoc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { handleFirestoreError } from './lib/errorHandlers';

// --- ERROR HANDLING ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo?: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

const googleProvider = new GoogleAuthProvider();

// --- LOGO COMPONENT ---
const AppLogo = ({ className = "w-8 h-8" }: { className?: string }) => (
  <div className={`bg-emerald-600 rounded-xl flex items-center justify-center overflow-hidden shrink-0 shadow-inner ${className}`}>
    <Wheat className="w-3/5 h-3/5 text-white" />
  </div>
);

// --- INTERFACES ---
interface RainRecord {
  id: string;
  date: string;
  mm: number;
}

interface ExpenseRecord {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  machineId?: string;
}

interface IncomeRecord {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
}

interface UserProfile {
  firstName: string;
  lastName: string;
  profession: string;
  photoBase64: string;
}

interface Machine {
  id: string;
  name: string;
  type: string;
  brand: string;
}

interface Farm {
  id: string;
  name: string;
  location: string;
  coordinates: string;
  owner: string;
  manager: string;
  userId: string;
  rains: RainRecord[];
  expenses: ExpenseRecord[];
  incomes: IncomeRecord[];
}

// --- MAIN APP COMPONENT ---
export default function AgroApp() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState('');

  const [farms, setFarms] = useState<Farm[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('info');
  const [activeUsers, setActiveUsers] = useState<{ uid: string; name: string; photo: string | null }[]>([]);

  // User Profile State
  const [userProfile, setUserProfile] = useState<UserProfile>({ firstName: '', lastName: '', profession: '', photoBase64: '' });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Modal State
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showRainModal, setShowRainModal] = useState(false);

  // Forms state
  const [farmForm, setFarmForm] = useState({ name: '', location: '', coordinates: '', owner: '', manager: '' });
  const [isEditingFarm, setIsEditingFarm] = useState(false);

  const [rainForm, setRainForm] = useState({ date: '', mm: '' });
  const [rainFilters, setRainFilters] = useState({ startDate: '', endDate: '' });

  const [expenseForm, setExpenseForm] = useState({ 
    date: '', 
    category: 'Gastos generales', 
    description: '', 
    amount: '',
    machineId: ''
  });
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expenseFilters, setExpenseFilters] = useState({ category: 'Todos', startDate: '', endDate: '' });
  const [machines, setMachines] = useState<Machine[]>([]);

  const handleError = (error: unknown, operationType: OperationType, path: string | null) => {
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
        tenantId: auth.currentUser?.tenantId,
        providerInfo: auth.currentUser?.providerData.map(provider => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL
        })) || []
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', errInfo.error);
    setGlobalError(errInfo.error);
  };

  const selectedFarm = farms.find(f => f.id === selectedFarmId);

  // --- AUTH & FIRESTORE EFFECTS ---
  useEffect(() => {
    console.log("AgroApp: Initializing auth listener");
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log("AgroApp: Auth state changed", currentUser);
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthReady) return;
    if (!user) {
      setFarms([]);
      return;
    }

    const q = collection(db, 'farms');
    const unsubscribeFarms = onSnapshot(q, (snapshot) => {
      const loadedFarms: Farm[] = [];
      snapshot.forEach((doc) => {
        loadedFarms.push({ id: doc.id, ...doc.data() } as Farm);
      });
      setFarms(loadedFarms);
    }, (error) => {
      handleError(error, OperationType.LIST, 'farms');
    });

    const unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserProfile({
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          profession: data.profession || '',
          photoBase64: data.photoBase64 || ''
        });
      } else {
        // Initialize empty profile if it doesn't exist
        setUserProfile({ firstName: '', lastName: '', profession: '', photoBase64: '' });
      }
    }, (error) => {
      handleError(error, OperationType.GET, `users/${user.uid}`);
    });

    return () => {
      unsubscribeFarms();
      unsubscribeProfile();
    };
  }, [user, isAuthReady]);

  useEffect(() => {
    if (!selectedFarmId) {
      setMachines([]);
      return;
    }

    const q = query(collection(db, 'farms', selectedFarmId, 'machines'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loaded: Machine[] = [];
      snapshot.forEach((doc) => {
        loaded.push({ id: doc.id, ...doc.data() } as Machine);
      });
      setMachines(loaded);
    });

    return () => unsubscribe();
  }, [selectedFarmId]);

  // Presencia en tiempo real: registra al usuario activo y escucha a otros
  useEffect(() => {
    if (!selectedFarmId || !user) {
      setActiveUsers([]);
      return;
    }

    const presenceRef = doc(db, 'farms', selectedFarmId, 'presence', user.uid);
    const displayName = userProfile.firstName
      ? `${userProfile.firstName} ${userProfile.lastName}`.trim()
      : user.displayName || user.email || 'Usuario';

    setDoc(presenceRef, {
      uid: user.uid,
      name: displayName,
      photo: userProfile.photoBase64 || user.photoURL || null,
      lastSeen: serverTimestamp()
    }).catch(() => {});

    const presenceCol = collection(db, 'farms', selectedFarmId, 'presence');
    const unsubscribePresence = onSnapshot(presenceCol, (snapshot) => {
      const others: { uid: string; name: string; photo: string | null }[] = [];
      snapshot.forEach((d) => {
        if (d.id !== user.uid) others.push(d.data() as any);
      });
      setActiveUsers(others);
    });

    const handleUnload = () => { deleteDoc(presenceRef).catch(() => {}); };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      deleteDoc(presenceRef).catch(() => {});
      unsubscribePresence();
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [selectedFarmId, user, userProfile.firstName, userProfile.lastName, userProfile.photoBase64]);

  const handleGoogleLogin = async () => {
    setAuthError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Error logging in with Google", error);
      if (error.code === 'auth/unauthorized-domain') {
        setAuthError('Dominio no autorizado. Por favor, agrega esta URL a los dominios autorizados en Firebase.');
      } else {
        setAuthError('Error al iniciar sesión con Google.');
      }
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      console.error("Email auth error", error);
      switch (error.code) {
        case 'auth/email-already-in-use':
          setAuthError('El correo electrónico ya está registrado.');
          break;
        case 'auth/invalid-email':
          setAuthError('El correo electrónico no es válido.');
          break;
        case 'auth/weak-password':
          setAuthError('La contraseña debe tener al menos 6 caracteres.');
          break;
        case 'auth/invalid-credential':
        case 'auth/user-not-found':
        case 'auth/wrong-password':
          setAuthError('Correo o contraseña incorrectos.');
          break;
        default:
          setAuthError('Ocurrió un error en la autenticación.');
      }
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setSelectedFarmId(null);
    setShowProfileModal(false);
  };

  // --- PROFILE ACTIONS ---
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setProfileError('');
    setIsSavingProfile(true);

    try {
      const profileToSave = {
        firstName: userProfile.firstName || '',
        lastName: userProfile.lastName || '',
        profession: userProfile.profession || '',
        photoBase64: userProfile.photoBase64 || ''
      };
      
      // Añadimos un timeout de 30 segundos para evitar que se quede colgado
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('timeout')), 30000)
      );

      await Promise.race([
        setDoc(doc(db, 'users', user.uid), profileToSave, { merge: true }),
        timeoutPromise
      ]);

      setIsEditingProfile(false);
      setShowProfileModal(false);
    } catch (error: any) {
      console.error("Error saving profile", error);
      const errorMessage = error?.message || '';
      if (errorMessage === 'timeout') {
        setProfileError('Tiempo de espera agotado. Verifica tu conexión a internet o asegúrate de haber creado la base de datos Firestore en la consola de Firebase.');
      } else if (errorMessage && (errorMessage.toLowerCase().includes('permissions') || errorMessage.toLowerCase().includes('missing or insufficient permissions'))) {
        setProfileError('Error de permisos: Asegúrate de actualizar las reglas de Firestore en tu consola de Firebase para permitir escribir en la colección "users".');
      } else {
        setProfileError(`Error al guardar el perfil: ${errorMessage}`);
      }
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (limit to ~500KB to fit safely within Firestore 1MB document limit after base64 encoding)
    if (file.size > 500 * 1024) {
      setProfileError('La imagen es demasiado grande. El tamaño máximo es 500KB.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setUserProfile(prev => ({ ...prev, photoBase64: base64String }));
      setProfileError('');
    };
    reader.readAsDataURL(file);
  };

  // --- ACTIONS ---

  const requestConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmDialog({ isOpen: true, title, message, onConfirm });
  };

  const handleFarmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmForm.name || !user) return;
    
    setIsActionLoading(true);
    try {
      if (isEditingFarm && selectedFarmId) {
        await updateDoc(doc(db, 'farms', selectedFarmId), {
          name: farmForm.name,
          location: farmForm.location,
          coordinates: farmForm.coordinates,
          owner: farmForm.owner,
          manager: farmForm.manager
        });
        setIsEditingFarm(false);
      } else {
        const newFarmRef = doc(collection(db, 'farms'));
        await setDoc(newFarmRef, {
          name: farmForm.name,
          location: farmForm.location,
          coordinates: farmForm.coordinates,
          owner: farmForm.owner,
          manager: farmForm.manager,
          userId: user.uid,
          rains: [],
          expenses: []
        });
        setSelectedFarmId(newFarmRef.id);
      }
      setFarmForm({ name: '', location: '', coordinates: '', owner: '', manager: '' });
    } catch (error) {
       handleFirestoreError(error, 'write' as any, 'farms', auth);
    } finally {
       setIsActionLoading(false);
    }
  };

  const startEditFarm = () => {
    if (selectedFarm) {
      setFarmForm({
        name: selectedFarm.name,
        location: selectedFarm.location,
        coordinates: selectedFarm.coordinates,
        owner: selectedFarm.owner,
        manager: selectedFarm.manager
      });
      setIsEditingFarm(true);
    }
  };

  const cancelEditFarm = () => {
    setFarmForm({ name: '', location: '', coordinates: '', owner: '', manager: '' });
    setIsEditingFarm(false);
  };

  const deleteFarm = async (id: string) => {
    setIsActionLoading(true);
    try {
      await deleteDoc(doc(db, 'farms', id));
      if (selectedFarmId === id) setSelectedFarmId(null);
    } catch (error) {
      handleFirestoreError(error, 'delete' as any, `farms/${id}`, auth);
    } finally {
      setIsActionLoading(false);
    }
  };

  // --- RAIN ACTIONS ---

  const handleAddRain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFarmId || !rainForm.date || !rainForm.mm || !selectedFarm) return;
    
    setIsActionLoading(true);
    try {
      const newRain = { id: crypto.randomUUID(), date: rainForm.date, mm: Number(rainForm.mm) };
      const updatedRains = [...selectedFarm.rains, newRain].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      await updateDoc(doc(db, 'farms', selectedFarmId), { rains: updatedRains });
      setRainForm({ date: '', mm: '' });
      setShowRainModal(false);
    } catch (error) {
       handleFirestoreError(error, 'update' as any, `farms/${selectedFarmId}`, auth);
    } finally {
       setIsActionLoading(false);
    }
  };

  const deleteRain = async (rainId: string) => {
    if (!selectedFarm || !selectedFarmId) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Eliminar Registro de Lluvia',
      message: '¿Estás seguro de eliminar este registro?',
      onConfirm: async () => {
        setIsActionLoading(true);
        try {
          const updatedRains = selectedFarm.rains.filter(r => r.id !== rainId);
          await updateDoc(doc(db, 'farms', selectedFarmId), { rains: updatedRains });
        } catch (error) {
           handleFirestoreError(error, 'update' as any, `farms/${selectedFarmId}`, auth);
        } finally {
           setIsActionLoading(false);
           setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  // --- EXPENSE ACTIONS ---

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFarmId || !expenseForm.date || !expenseForm.description || !expenseForm.amount || !selectedFarm) return;
    
    setIsActionLoading(true);
    try {
      let updatedExpenses;
      if (editingExpenseId) {
        updatedExpenses = selectedFarm.expenses.map(exp => exp.id === editingExpenseId ? {
          ...exp,
          date: expenseForm.date,
          category: expenseForm.category,
          description: expenseForm.description,
          amount: Number(expenseForm.amount),
          machineId: expenseForm.category === 'Maquinaria' ? expenseForm.machineId : ''
        } : exp);
      } else {
        updatedExpenses = [...selectedFarm.expenses, { 
          id: crypto.randomUUID(), 
          date: expenseForm.date, 
          category: expenseForm.category,
          description: expenseForm.description,
          amount: Number(expenseForm.amount),
          machineId: expenseForm.category === 'Maquinaria' ? expenseForm.machineId : ''
        }];
      }
      updatedExpenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      await updateDoc(doc(db, 'farms', selectedFarmId), { expenses: updatedExpenses });
      setExpenseForm({ date: '', category: 'Gastos generales', description: '', amount: '', machineId: '' });
      setEditingExpenseId(null);
      setShowExpenseModal(false);
    } catch (error) {
       handleFirestoreError(error, 'update' as any, `farms/${selectedFarmId}`, auth);
    } finally {
       setIsActionLoading(false);
    }
  };

  const startEditExpense = (expense: ExpenseRecord) => {
    setExpenseForm({
      date: expense.date,
      category: expense.category,
      description: expense.description,
      amount: expense.amount.toString(),
      machineId: expense.machineId || ''
    });
    setEditingExpenseId(expense.id);
    setShowExpenseModal(true);
  };

  const cancelEditExpense = () => {
    setExpenseForm({ date: '', category: 'Gastos generales', description: '', amount: '', machineId: '' });
    setEditingExpenseId(null);
    setShowExpenseModal(false);
  };

  const deleteExpense = async (expenseId: string) => {
    if (!selectedFarm || !selectedFarmId) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Eliminar Gasto',
      message: '¿Estás seguro de eliminar este registro de gasto?',
      onConfirm: async () => {
        setIsActionLoading(true);
        try {
          const updatedExpenses = selectedFarm.expenses.filter(e => e.id !== expenseId);
          await updateDoc(doc(db, 'farms', selectedFarmId), { expenses: updatedExpenses });
          if (editingExpenseId === expenseId) cancelEditExpense();
        } catch (error) {
           handleFirestoreError(error, 'update' as any, `farms/${selectedFarmId}`, auth);
        } finally {
           setIsActionLoading(false);
           setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  // --- FILTERING & ANALYSIS ---

  const filteredExpenses = useMemo(() => {
    if (!selectedFarm || !selectedFarm.expenses) return [];
    return selectedFarm.expenses.filter(exp => {
      const expDate = exp.date || '';
      const matchCategory = expenseFilters.category === 'Todos' || exp.category === expenseFilters.category;
      const matchStart = !expenseFilters.startDate || expDate >= expenseFilters.startDate;
      const matchEnd = !expenseFilters.endDate || expDate <= expenseFilters.endDate;
      return matchCategory && matchStart && matchEnd;
    });
  }, [selectedFarm, expenseFilters]);

  const filteredRains = useMemo(() => {
    if (!selectedFarm || !selectedFarm.rains) return [];
    return selectedFarm.rains.filter(rain => {
      const rainDate = rain.date || '';
      const matchStart = !rainFilters.startDate || rainDate >= rainFilters.startDate;
      const matchEnd = !rainFilters.endDate || rainDate <= rainFilters.endDate;
      return matchStart && matchEnd;
    });
  }, [selectedFarm, rainFilters]);

  const totalRain = filteredRains.reduce((sum, r) => sum + r.mm, 0);
  const maxRain = (filteredRains || []).length ? Math.max(...(filteredRains || []).map(r => r.mm)) : 0;

  // --- RENDER ---

  if (!isAuthReady) {
    return <div className="min-h-screen flex items-center justify-center bg-stone-100 text-stone-600">Cargando...</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100 p-4 font-sans">
        <div className="bg-white p-8 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] max-w-md w-full border border-stone-100">
          <div className="text-center mb-10">
            <AppLogo className="w-20 h-20 mx-auto mb-6 shadow-lg rotate-12" />
            <h1 className="text-4xl font-extrabold text-stone-900 tracking-tight mb-2">AgroGestión</h1>
            <p className="text-stone-500 font-medium">Control Inteligente de tu Producción</p>
          </div>

          {authError && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-3 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p>{authError}</p>
            </div>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Correo Electrónico</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-5 w-5 text-stone-400" />
                <input 
                  type="email" 
                  required 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 px-4 py-2.5 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                  placeholder="tu@email.com"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-5 w-5 text-stone-400" />
                <input 
                  type="password" 
                  required 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 px-4 py-2.5 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>
            <button 
              type="submit" 
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors shadow-sm"
            >
              {isRegistering ? 'Crear Cuenta' : 'Iniciar Sesión'}
            </button>
          </form>

          <div className="text-center mb-6">
            <button 
              type="button" 
              onClick={() => { setIsRegistering(!isRegistering); setAuthError(''); }}
              className="text-emerald-600 hover:text-emerald-800 text-sm font-medium transition-colors"
            >
              {isRegistering ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
            </button>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-stone-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-stone-500">O continúa con</span>
            </div>
          </div>

          <button 
            onClick={handleGoogleLogin} 
            type="button"
            className="w-full bg-white border border-stone-300 hover:bg-stone-50 text-stone-700 font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-3 shadow-sm"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 font-sans">
      <AnimatePresence>
        {globalError && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[1000] w-[90%] max-w-2xl"
          >
            <div className="bg-red-600 text-white p-4 rounded-2xl shadow-2xl border-4 border-white flex items-start gap-4">
              <div className="bg-white/20 p-2 rounded-xl">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h4 className="font-black text-sm uppercase tracking-widest mb-1">Error del Sistema</h4>
                <div className="text-sm font-medium opacity-90 leading-tight">
                  {globalError.includes('{') ? JSON.parse(globalError).error : globalError}
                </div>
                {globalError.includes('{') && (
                  <p className="text-[10px] mt-2 font-mono opacity-50">
                    ID: {JSON.parse(globalError).authInfo.userId} • OP: {JSON.parse(globalError).operationType}
                  </p>
                )}
              </div>
              <button onClick={() => setGlobalError('')} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Confirm Modal */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 animate-in fade-in zoom-in duration-200 border border-stone-100">
            <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mb-5">
              <Trash2 className="w-7 h-7 text-red-500" />
            </div>
            <h3 className="text-xl font-black text-stone-900 mb-2">{confirmDialog.title}</h3>
            <p className="text-stone-500 mb-8 leading-relaxed">{confirmDialog.message}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 px-4 py-3 text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-2xl font-bold transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(prev => ({ ...prev, isOpen: false })); }}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold transition-colors shadow-lg shadow-red-200"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-white/90 backdrop-blur-md sticky top-0 z-[50] border-b border-stone-200/80 px-4 py-3 sm:px-6 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AppLogo className="w-10 h-10" />
            <div>
              <h1 className="text-xl font-black text-stone-900 tracking-tight sm:text-2xl leading-none">AgroGestión</h1>
              <p className="text-[10px] text-emerald-600 font-semibold uppercase tracking-widest hidden sm:block">Control inteligente</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {selectedFarmId && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setSelectedFarmId(null); setIsEditingFarm(false); }}
                  className="flex items-center gap-2 text-emerald-100 hover:text-white transition-colors bg-emerald-900/50 px-4 py-2 rounded-lg"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Volver a Campos</span>
                </button>
                {activeUsers.length > 0 && (
                  <div className="flex items-center gap-1.5 bg-emerald-700/40 px-3 py-2 rounded-lg" title={`También conectados: ${activeUsers.map(u => u.name).join(', ')}`}>
                    <span className="w-2 h-2 bg-emerald-300 rounded-full animate-pulse shrink-0" />
                    <div className="flex -space-x-2">
                      {activeUsers.slice(0, 3).map((u) => (
                        <div key={u.uid} className="w-6 h-6 rounded-full border-2 border-emerald-800 overflow-hidden bg-emerald-200 flex items-center justify-center shrink-0" title={u.name}>
                          {u.photo ? (
                            <img src={u.photo} alt={u.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <span className="text-[9px] font-bold text-emerald-800">{u.name.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                      ))}
                    </div>
                    <span className="text-xs text-emerald-200 font-medium hidden sm:inline">
                      {activeUsers.length === 1 ? `${activeUsers[0].name.split(' ')[0]} también aquí` : `${activeUsers.length} más conectados`}
                    </span>
                  </div>
                )}
              </div>
            )}
            <div className="flex items-center gap-2 sm:gap-4 border-l border-stone-200 pl-4">
              <button 
                onClick={() => { setShowProfileModal(true); setIsEditingProfile(false); setProfileError(''); }}
                className="flex items-center gap-2 sm:gap-3 text-left hover:bg-stone-100 p-1 rounded-xl transition-all"
              >
                <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-emerald-100 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center shrink-0">
                  {userProfile.photoBase64 ? (
                    <img src={userProfile.photoBase64} alt="Profile" className="w-full h-full object-cover" />
                  ) : user.photoURL ? (
                    <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <User className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
                  )}
                </div>
                <div className="hidden sm:block max-w-[120px]">
                  <p className="text-xs font-bold text-stone-900 leading-tight truncate">
                    {userProfile.firstName || user?.displayName?.split(' ')[0] || 'Mi Perfil'}
                  </p>
                  <p className="text-[10px] text-stone-500 font-medium truncate">
                    {userProfile.profession || 'Administrador'}
                  </p>
                </div>
              </button>

              <button 
                onClick={() => signOut(auth)}
                className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                title="Cerrar Sesión"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 my-8 relative">
            <button 
              onClick={() => setShowProfileModal(false)}
              className="absolute top-4 right-4 text-stone-400 hover:text-stone-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h2 className="text-2xl font-bold text-stone-800 mb-6">Perfil de Usuario</h2>
            
            {profileError && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                {profileError}
              </div>
            )}

            {!isEditingProfile ? (
              <div className="flex flex-col items-center">
                <div className="w-24 h-24 rounded-full bg-stone-100 border-4 border-white shadow-md mb-4 overflow-hidden flex items-center justify-center">
                  {userProfile.photoBase64 ? (
                    <img src={userProfile.photoBase64} alt="Perfil" className="w-full h-full object-cover" />
                  ) : user.photoURL ? (
                    <img src={user.photoURL} alt="Perfil" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <User className="w-12 h-12 text-stone-400" />
                  )}
                </div>
                <h3 className="text-xl font-semibold text-stone-900">
                  {userProfile.firstName || userProfile.lastName 
                    ? `${userProfile.firstName} ${userProfile.lastName}`.trim() 
                    : user.displayName || 'Sin nombre'}
                </h3>
                <p className="text-stone-500 mb-1">{userProfile.profession || 'Sin profesión'}</p>
                <p className="text-sm text-stone-400 mb-6">{user.email}</p>
                
                <button 
                  onClick={() => setIsEditingProfile(true)}
                  className="w-full bg-stone-100 hover:bg-stone-200 text-stone-800 font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Edit className="w-4 h-4" /> Editar Perfil
                </button>
              </div>
            ) : (
              <form onSubmit={handleProfileSubmit} className="space-y-4">
                <div className="flex flex-col items-center mb-6">
                  <div className="relative group cursor-pointer">
                    <div className="w-24 h-24 rounded-full bg-stone-100 border-4 border-white shadow-md overflow-hidden flex items-center justify-center">
                      {userProfile.photoBase64 ? (
                        <img src={userProfile.photoBase64} alt="Perfil" className="w-full h-full object-cover" />
                      ) : user.photoURL ? (
                        <img src={user.photoURL} alt="Perfil" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <User className="w-12 h-12 text-stone-400" />
                      )}
                    </div>
                    <label className="absolute inset-0 flex items-center justify-center bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      <Camera className="w-6 h-6" />
                      <input type="file" accept="image/jpeg, image/png, image/webp" className="hidden" onChange={handlePhotoUpload} />
                    </label>
                  </div>
                  <p className="text-xs text-stone-500 mt-2">Haz clic para cambiar la foto</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Nombre</label>
                    <input 
                      type="text" 
                      value={userProfile.firstName} 
                      onChange={e => setUserProfile({...userProfile, firstName: e.target.value})}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="Tu nombre"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Apellido</label>
                    <input 
                      type="text" 
                      value={userProfile.lastName} 
                      onChange={e => setUserProfile({...userProfile, lastName: e.target.value})}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="Tu apellido"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Profesión / Cargo</label>
                  <input 
                    type="text" 
                    value={userProfile.profession} 
                    onChange={e => setUserProfile({...userProfile, profession: e.target.value})}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="Ej: Ingeniero Agrónomo"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button" 
                    onClick={() => {
                      setIsEditingProfile(false);
                      setProfileError('');
                    }} 
                    className="flex-1 px-4 py-2.5 text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-lg font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSavingProfile}
                    className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSavingProfile ? (
                      <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {isSavingProfile ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto p-6">
        {!selectedFarmId ? (
          // --- LIST VIEW ---
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-1">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-200">
                <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-emerald-600" />
                  Registrar Nuevo Campo
                </h2>
                <form onSubmit={handleFarmSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Nombre del Campo *</label>
                    <input type="text" required value={farmForm.name} onChange={e => setFarmForm({...farmForm, name: e.target.value})} className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent" placeholder="Ej: La Esperanza" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Ubicación</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
                      <input type="text" value={farmForm.location} onChange={e => setFarmForm({...farmForm, location: e.target.value})} className="w-full pl-10 px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent" placeholder="Provincia, Localidad" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Coordenadas (Opcional)</label>
                    <input 
                      type="text" 
                      value={farmForm.coordinates} 
                      onChange={e => setFarmForm({...farmForm, coordinates: e.target.value})} 
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm font-mono mb-2" 
                      placeholder="Ej: -34.6037, -58.3816" 
                    />
                    <LocationPicker 
                      coordinates={farmForm.coordinates} 
                      onChange={(coords) => setFarmForm({...farmForm, coordinates: coords})} 
                    />
                    <p className="text-xs text-stone-500 mt-1">Puedes escribir las coordenadas o hacer clic en el mapa.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Dueño o Firma</label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
                      <input type="text" value={farmForm.owner} onChange={e => setFarmForm({...farmForm, owner: e.target.value})} className="w-full pl-10 px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent" placeholder="Nombre de la empresa" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Encargado</label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
                      <input type="text" value={farmForm.manager} onChange={e => setFarmForm({...farmForm, manager: e.target.value})} className="w-full pl-10 px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent" placeholder="Nombre del encargado" />
                    </div>
                  </div>
                  <button type="submit" className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-medium py-2.5 px-4 rounded-lg transition-colors">Guardar Campo</button>
                </form>
              </div>
            </div>

            <div className="md:col-span-2">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200 min-h-[500px]">
                <h2 className="text-lg font-black text-stone-800 mb-5 flex items-center gap-2">
                  <Wheat className="w-5 h-5 text-emerald-600" />
                  Mis Campos
                </h2>
                {farms.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-stone-400">
                    <div className="w-20 h-20 rounded-3xl bg-stone-100 flex items-center justify-center mb-4">
                      <Wheat className="w-10 h-10 text-stone-300" />
                    </div>
                    <p className="font-semibold text-stone-500 mb-1">Sin campos registrados</p>
                    <p className="text-sm text-stone-400">Crea tu primer campo con el formulario</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {farms.map(farm => (
                      <div 
                        key={farm.id} 
                        className="bg-white border border-stone-200 rounded-3xl p-6 hover:border-emerald-500 hover:shadow-xl hover:shadow-emerald-900/5 transition-all group cursor-pointer relative overflow-hidden active:scale-[0.98]" 
                        onClick={() => { setSelectedFarmId(farm.id); setActiveTab('dashboard'); }}
                      >
                        <div className="absolute top-0 right-0 p-12 bg-emerald-50 rounded-full translate-x-1/2 -translate-y-1/2 group-hover:bg-emerald-100 transition-colors" />
                        <div className="relative z-10">
                          <div className="flex justify-between items-start mb-4">
                            <h3 className="text-2xl font-bold text-stone-900 group-hover:text-emerald-800 transition-colors">{farm.name}</h3>
                            <button 
                              onClick={(e) => { e.stopPropagation(); requestConfirm('Eliminar Campo', `¿Estás seguro de que deseas eliminar el campo "${farm.name}" y todos sus datos?`, () => deleteFarm(farm.id)); }} 
                              className="text-stone-300 hover:text-red-600 transition-colors p-2 hover:bg-red-50 rounded-xl"
                              title="Eliminar campo"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-4 text-sm font-medium text-stone-500">
                            {farm.location && <div className="flex items-center gap-2 bg-stone-100 px-3 py-1.5 rounded-full"><MapPin className="w-4 h-4" />{farm.location}</div>}
                            {farm.owner && <div className="flex items-center gap-2 bg-stone-100 px-3 py-1.5 rounded-full"><Building2 className="w-4 h-4" />{farm.owner}</div>}
                          </div>
                          <div className="mt-6 flex items-center text-emerald-600 font-bold text-sm">
                            Gestionar Campo <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          // --- DASHBOARD VIEW ---
          selectedFarm && (
            <div className="flex flex-col md:flex-row gap-6">
              {/* Navigation Sidebar/TopBar */}
              <div className="w-full md:w-72 flex flex-col gap-4 shrink-0">
                <div className="bg-emerald-900 text-white p-5 rounded-2xl shadow-lg shadow-emerald-950/20 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform" />
                  <div className="relative z-10">
                    <h2 className="font-bold text-xl mb-1 truncate">{selectedFarm.name}</h2>
                    <div className="flex items-center gap-1.5 text-emerald-200 text-sm">
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="truncate">{selectedFarm.location || 'Ubicación no definida'}</span>
                    </div>
                  </div>
                </div>
                
                <nav className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-y-visible pb-2 md:pb-0 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
                  {[
                    { id: 'dashboard', icon: Home, label: 'Tablero' },
                    { id: 'info', icon: Info, label: 'Información' },
                    { id: 'ganaderia', icon: LayoutGrid, label: 'Ganadería' },
                    { id: 'mapas', icon: Map, label: 'Lotes y Mapa' },
                    { id: 'agricultura', icon: Sprout, label: 'Agricultura' },
                    { id: 'maquinarias', icon: Truck, label: 'Maquinarias' },
                    { id: 'lluvias', icon: CloudRain, label: 'Lluvias' },
                    { id: 'gastos', icon: Wallet, label: 'Gastos' },
                    { id: 'ingresos', icon: Receipt, label: 'Ingresos' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => { setActiveTab(tab.id); setIsEditingFarm(false); }}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all whitespace-nowrap md:whitespace-normal shrink-0 md:shrink ${
                        activeTab === tab.id 
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200' 
                          : 'text-stone-500 hover:bg-stone-200/50 hover:text-stone-800'
                      }`}
                    >
                      <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-white' : 'text-stone-400'}`} />
                      <span className="text-sm font-bold tracking-tight">{tab.label}</span>
                    </button>
                  ))}
                </nav>
              </div>

              {/* Content Area */}
              <div className="flex-1 bg-white rounded-3xl shadow-sm border border-stone-200/60 p-4 sm:p-8 min-h-[600px] mb-8">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                
                {activeTab === 'dashboard' && selectedFarm && (
                  <DashboardModule 
                    farmId={selectedFarm.id} 
                    farmRains={selectedFarm.rains || []} 
                    farmExpenses={selectedFarm.expenses || []} 
                  />
                )}
                
                {activeTab === 'info' && (
                  <div>
                    <div className="flex justify-between items-center mb-6 border-b pb-4">
                      <h3 className="text-xl font-semibold text-stone-800">Información General</h3>
                      {!isEditingFarm && (
                        <button onClick={startEditFarm} className="flex items-center gap-2 text-sm text-emerald-700 hover:text-emerald-800 font-medium bg-emerald-50 px-3 py-1.5 rounded-lg">
                          <Edit className="w-4 h-4" /> Editar Datos
                        </button>
                      )}
                    </div>

                    {isEditingFarm ? (
                      <form onSubmit={handleFarmSubmit} className="space-y-4 max-w-2xl">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="sm:col-span-2">
                            <label className="block text-sm font-medium text-stone-700 mb-1">Nombre del Campo *</label>
                            <input type="text" required value={farmForm.name} onChange={e => setFarmForm({...farmForm, name: e.target.value})} className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-stone-700 mb-1">Ubicación</label>
                            <input type="text" value={farmForm.location} onChange={e => setFarmForm({...farmForm, location: e.target.value})} className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-stone-700 mb-1">Dueño o Firma</label>
                            <input type="text" value={farmForm.owner} onChange={e => setFarmForm({...farmForm, owner: e.target.value})} className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-stone-700 mb-1">Encargado</label>
                            <input type="text" value={farmForm.manager} onChange={e => setFarmForm({...farmForm, manager: e.target.value})} className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500" />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-sm font-medium text-stone-700 mb-1">Coordenadas</label>
                            <input type="text" value={farmForm.coordinates} onChange={e => setFarmForm({...farmForm, coordinates: e.target.value})} className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-mono text-sm mb-2" />
                            <LocationPicker coordinates={farmForm.coordinates} onChange={(coords) => setFarmForm({...farmForm, coordinates: coords})} />
                          </div>
                        </div>
                        <div className="flex gap-3 pt-4">
                          <button type="button" onClick={cancelEditFarm} className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg font-medium">Cancelar</button>
                          <button type="submit" className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-medium">Guardar Cambios</button>
                        </div>
                      </form>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                          <p className="text-sm text-stone-500 mb-1">Nombre del Campo</p>
                          <p className="font-medium text-stone-900 text-lg">{selectedFarm.name}</p>
                        </div>
                        <div>
                          <p className="text-sm text-stone-500 mb-1">Ubicación</p>
                          <p className="font-medium text-stone-900">{selectedFarm.location || '-'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-stone-500 mb-1">Dueño o Firma</p>
                          <p className="font-medium text-stone-900">{selectedFarm.owner || '-'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-stone-500 mb-1">Encargado</p>
                          <p className="font-medium text-stone-900">{selectedFarm.manager || '-'}</p>
                        </div>
                        <div className="sm:col-span-2">
                          <p className="text-sm text-stone-500 mb-2">Ubicación Geográfica</p>
                          <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200">
                             <div className="flex items-center gap-2 text-stone-600 font-mono text-sm mb-4">
                               <MapPin className="w-4 h-4 text-emerald-600" />
                               {selectedFarm.coordinates || 'Coordenadas no definidas'}
                             </div>
                             {selectedFarm.coordinates && (
                               <div className="rounded-xl overflow-hidden shadow-sm border border-stone-200">
                                 <div style={{ height: '250px', width: '100%', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                   <div className="text-center">
                                     <p className="text-stone-600 font-medium mb-2">Ubicación: {selectedFarm.coordinates}</p>
                                     <p className="text-xs text-stone-500">Abre el módulo de "Lotes y Mapa" para ver el mapa interactivo</p>
                                   </div>
                                 </div>
                               </div>
                             )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'ganaderia' && (
                  <div className="p-6">
                    <div className="mb-6">
                      <h2 className="text-2xl font-bold text-stone-800">Módulo de Ganadería</h2>
                      <p className="text-stone-500">Gestiona el rodeo, categorías, pesos y estado de los animales.</p>
                    </div>
                    <GanaderiaModule farmId={selectedFarm.id} />
                  </div>
                )}

                {activeTab === 'mapas' && selectedFarm && (
                  <MapasModule farmId={selectedFarm.id} coordinates={selectedFarm.coordinates} />
                )}

                {activeTab === 'agricultura' && selectedFarm && (
                  <AgriculturaModule farmId={selectedFarm.id} />
                )}

                {activeTab === 'maquinarias' && selectedFarm && (
                  <MaquinariaModule farmId={selectedFarm.id} />
                )}

                {activeTab === 'lluvias' && (
                  <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b pb-4">
                      <div className="flex items-center gap-3">
                        <CloudRain className="w-6 h-6 text-blue-500" />
                        <h3 className="text-xl font-bold text-stone-800">Registro de Lluvias</h3>
                      </div>
                      <button
                        onClick={() => { setRainForm({ date: '', mm: '' }); setShowRainModal(true); }}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl transition-colors shadow-sm text-sm"
                      >
                        <Plus className="w-4 h-4" /> Nueva Medición
                      </button>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl text-center">
                        <p className="text-[10px] text-blue-500 font-black uppercase tracking-widest mb-1">Total Acumulado</p>
                        <p className="text-2xl font-black text-blue-900">{totalRain.toFixed(1)} <span className="text-sm font-normal text-blue-500">mm</span></p>
                      </div>
                      <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl text-center">
                        <p className="text-[10px] text-blue-500 font-black uppercase tracking-widest mb-1">Eventos</p>
                        <p className="text-2xl font-black text-blue-900">{filteredRains.length}</p>
                      </div>
                      <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl text-center">
                        <p className="text-[10px] text-blue-500 font-black uppercase tracking-widest mb-1">Máxima</p>
                        <p className="text-2xl font-black text-blue-900">{maxRain.toFixed(1)} <span className="text-sm font-normal text-blue-500">mm</span></p>
                      </div>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-wrap gap-3 items-end bg-stone-50 border border-stone-200 rounded-xl p-3">
                      <Filter className="w-4 h-4 text-stone-400 self-center" />
                      <div>
                        <label className="block text-xs text-stone-500 mb-1 font-medium">Desde</label>
                        <input type="date" value={rainFilters.startDate} onChange={e => setRainFilters({...rainFilters, startDate: e.target.value})} className="px-3 py-1.5 border border-stone-300 rounded-lg text-sm bg-white" />
                      </div>
                      <div>
                        <label className="block text-xs text-stone-500 mb-1 font-medium">Hasta</label>
                        <input type="date" value={rainFilters.endDate} onChange={e => setRainFilters({...rainFilters, endDate: e.target.value})} className="px-3 py-1.5 border border-stone-300 rounded-lg text-sm bg-white" />
                      </div>
                      {(rainFilters.startDate || rainFilters.endDate) && (
                        <button onClick={() => setRainFilters({startDate: '', endDate: ''})} className="text-xs text-blue-600 hover:text-blue-800 px-3 py-1.5 font-bold bg-white border border-blue-200 rounded-lg">Limpiar</button>
                      )}
                    </div>

                    {/* Table */}
                    {filteredRains.length === 0 ? (
                      <div className="text-center py-16 text-stone-400 bg-stone-50 rounded-2xl border border-dashed border-stone-200">
                        <Droplets className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="font-semibold">Sin registros para este período</p>
                        <button onClick={() => { setRainForm({ date: '', mm: '' }); setShowRainModal(true); }} className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-bold">+ Registrar primer lluvia</button>
                      </div>
                    ) : (
                      <div className="border border-stone-200 rounded-xl overflow-hidden">
                        <table className="w-full text-left border-collapse table-fixed">
                          <colgroup>
                            <col style={{width: '140px'}} />
                            <col />
                            <col style={{width: '56px'}} />
                          </colgroup>
                          <thead>
                            <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 text-xs font-bold uppercase tracking-wide">
                              <th className="py-3 px-4">Fecha</th>
                              <th className="py-3 px-4 text-right">Milímetros</th>
                              <th className="py-3 px-4"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredRains.map(rain => (
                              <tr key={rain.id} className="border-b border-stone-100 hover:bg-stone-50">
                                <td className="py-3 px-4 font-medium text-stone-800 text-sm">
                                  {new Date(rain.date).toLocaleDateString('es-AR', { timeZone: 'UTC' })}
                                </td>
                                <td className="py-3 px-4 text-right font-bold text-blue-700">
                                  {rain.mm} mm
                                </td>
                                <td className="py-3 px-4">
                                  <button
                                    onClick={() => requestConfirm('Eliminar Registro', '¿Eliminar este registro de lluvia?', () => deleteRain(rain.id))}
                                    className="text-stone-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'gastos' && (
                  <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <h2 className="text-2xl font-bold text-stone-900 tracking-tight">Gestión de Gastos</h2>
                        <p className="text-stone-500 text-sm">Control de egresos y costos del campo</p>
                      </div>
                      <button
                        onClick={() => { setExpenseForm({ date: '', category: 'Gastos generales', description: '', amount: '', machineId: '' }); setEditingExpenseId(null); setShowExpenseModal(true); }}
                        className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-2.5 rounded-2xl transition-all shadow-lg shadow-red-200 active:scale-95"
                      >
                        <Plus className="w-5 h-5" /> Nuevo Gasto
                      </button>
                    </div>

                    {/* Resumen por categoría */}
                    {(() => {
                      const expCats = ['Gastos generales','Ganaderos','Agrícolas','Maquinaria'];
                      const expTotal = (selectedFarm?.expenses || []).reduce((s: number, e: any) => s + e.amount, 0);
                      const catColors: Record<string, string> = { 'Gastos generales': 'bg-stone-400', 'Ganaderos': 'bg-orange-500', 'Agrícolas': 'bg-emerald-500', 'Maquinaria': 'bg-blue-500' };
                      const bycat = expCats.map(cat => {
                        const total = (selectedFarm?.expenses || []).filter((e: any) => e.category === cat).reduce((s: number, e: any) => s + e.amount, 0);
                        return { cat, total, pct: expTotal > 0 ? (total / expTotal) * 100 : 0 };
                      }).filter(c => c.total > 0).sort((a, b) => b.total - a.total);
                      return bycat.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {bycat.map(({ cat, total, pct }) => (
                            <div key={cat} className="bg-white rounded-2xl border border-stone-200 p-4 shadow-sm">
                              <div className="flex items-center gap-2 mb-2">
                                <div className={`w-2.5 h-2.5 rounded-full ${catColors[cat] ?? 'bg-stone-400'}`} />
                                <span className="text-xs font-bold text-stone-500 truncate">{cat}</span>
                              </div>
                              <p className="text-base font-black text-stone-900">
                                $ {total.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                              </p>
                              <div className="mt-2 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                                <div className={`h-full ${catColors[cat] ?? 'bg-stone-400'} rounded-full`} style={{ width: `${pct}%` }} />
                              </div>
                              <p className="text-[10px] text-stone-400 font-bold mt-1">{pct.toFixed(1)}% del total</p>
                            </div>
                          ))}
                        </div>
                      ) : null;
                    })()}

                    {/* Filters */}
                    <div className="flex flex-wrap gap-3 items-end bg-stone-50 border border-stone-200 rounded-2xl p-3">
                      <Filter className="w-4 h-4 text-stone-400 self-center" />
                      <div>
                        <label className="block text-xs text-stone-500 mb-1 font-medium">Rubro</label>
                        <select value={expenseFilters.category} onChange={e => setExpenseFilters({...expenseFilters, category: e.target.value})} className="px-3 py-1.5 border border-stone-300 rounded-xl text-sm bg-white">
                          <option value="Todos">Todos</option>
                          <option value="Gastos generales">Gastos generales</option>
                          <option value="Ganaderos">Ganaderos</option>
                          <option value="Agrícolas">Agrícolas</option>
                          <option value="Maquinaria">Maquinaria</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-stone-500 mb-1 font-medium">Desde</label>
                        <input type="date" value={expenseFilters.startDate} onChange={e => setExpenseFilters({...expenseFilters, startDate: e.target.value})} className="px-3 py-1.5 border border-stone-300 rounded-xl text-sm bg-white" />
                      </div>
                      <div>
                        <label className="block text-xs text-stone-500 mb-1 font-medium">Hasta</label>
                        <input type="date" value={expenseFilters.endDate} onChange={e => setExpenseFilters({...expenseFilters, endDate: e.target.value})} className="px-3 py-1.5 border border-stone-300 rounded-xl text-sm bg-white" />
                      </div>
                      {(expenseFilters.category !== 'Todos' || expenseFilters.startDate || expenseFilters.endDate) && (
                        <button onClick={() => setExpenseFilters({category: 'Todos', startDate: '', endDate: ''})} className="text-xs text-red-600 hover:text-red-800 px-3 py-1.5 font-bold bg-white border border-red-200 rounded-xl">Limpiar</button>
                      )}
                    </div>

                    <div className="bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden">
                      <div className="overflow-x-auto">
                        {filteredExpenses.length === 0 ? (
                          <div className="text-center py-12 text-stone-400 flex flex-col items-center gap-2">
                            <Receipt className="w-12 h-12 opacity-20" />
                            <p className="italic">No hay gastos registrados para estos filtros.</p>
                          </div>
                        ) : (
                          <table className="w-full text-left">
                            <thead className="bg-stone-50/50 border-b border-stone-200">
                              <tr className="text-stone-500 text-sm font-bold uppercase tracking-wider">
                                <th className="p-4">Fecha</th>
                                <th className="p-4">Rubro</th>
                                <th className="p-4">Descripción</th>
                                <th className="p-4 text-right">Monto</th>
                                <th className="p-4 text-right">Acciones</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100">
                              {filteredExpenses.map(expense => (
                                <tr key={expense.id} className="hover:bg-red-50/20 transition-colors group">
                                  <td className="p-4 text-stone-600 font-medium">
                                    {new Date(expense.date).toLocaleDateString('es-AR', { timeZone: 'UTC' })}
                                  </td>
                                  <td className="p-4">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${
                                      expense.category === 'Ganaderos' ? 'bg-orange-100 text-orange-700' :
                                      expense.category === 'Agrícolas' ? 'bg-emerald-100 text-emerald-700' :
                                      expense.category === 'Maquinaria' ? 'bg-blue-100 text-blue-700' :
                                      'bg-stone-100 text-stone-600'
                                    }`}>
                                      {expense.category}
                                    </span>
                                  </td>
                                  <td className="p-4 font-semibold text-stone-800">
                                    <p>{expense.description}</p>
                                    {expense.machineId && (
                                      <span className="text-xs text-blue-600 flex items-center gap-1 font-bold mt-0.5">
                                        <Wrench className="w-3 h-3 shrink-0" />
                                        {machines.find((m: any) => m.id === expense.machineId)?.name || 'Máquina no encontrada'}
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-4 font-bold text-red-600 text-right text-lg">
                                    $ {expense.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="p-4 text-right">
                                    <div className="flex justify-end gap-1">
                                      <button
                                        onClick={() => startEditExpense(expense)}
                                        className="p-2 text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                                        title="Editar"
                                      >
                                        <Edit className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => requestConfirm('Eliminar Gasto', `¿Eliminar el gasto "${expense.description}"?`, () => deleteExpense(expense.id))}
                                        className="p-2 text-stone-400 hover:text-red-700 hover:bg-red-50 rounded-xl transition-all"
                                        title="Eliminar"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="bg-red-50/50">
                              <tr>
                                <td colSpan={3} className="p-4 text-right font-bold text-stone-600">Total Gastos:</td>
                                <td className="p-4 text-right font-black text-red-700 text-xl whitespace-nowrap">
                                  $ {filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </td>
                                <td></td>
                              </tr>
                            </tfoot>
                          </table>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'ingresos' && selectedFarm && (
                  <IngresosModule farmId={selectedFarm.id} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      )
    )}
  </main>

  {/* ── Modal: Nuevo / Editar Gasto ── */}
  {showExpenseModal && (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg border border-stone-100 animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-6 border-b border-stone-100">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${editingExpenseId ? 'bg-amber-100' : 'bg-stone-100'}`}>
              <Wallet className={`w-5 h-5 ${editingExpenseId ? 'text-amber-600' : 'text-stone-600'}`} />
            </div>
            <h3 className="text-lg font-black text-stone-900">{editingExpenseId ? 'Editar Gasto' : 'Nuevo Gasto'}</h3>
          </div>
          <button onClick={cancelEditExpense} className="p-2 hover:bg-stone-100 rounded-xl transition-colors">
            <X className="w-5 h-5 text-stone-400" />
          </button>
        </div>
        <form onSubmit={handleExpenseSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">Fecha</label>
              <input type="date" required value={expenseForm.date} onChange={e => setExpenseForm({...expenseForm, date: e.target.value})} className="w-full px-3 py-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-400 outline-none bg-stone-50 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">Rubro</label>
              <select value={expenseForm.category} onChange={e => setExpenseForm({...expenseForm, category: e.target.value})} className="w-full px-3 py-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-400 outline-none bg-stone-50 text-sm">
                <option value="Gastos generales">Gastos generales</option>
                <option value="Ganaderos">Ganaderos</option>
                <option value="Agrícolas">Agrícolas</option>
                <option value="Maquinaria">Maquinaria</option>
              </select>
            </div>
          </div>
          {expenseForm.category === 'Maquinaria' && (
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">Maquinaria</label>
              <select required value={expenseForm.machineId} onChange={e => setExpenseForm({...expenseForm, machineId: e.target.value})} className="w-full px-3 py-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-400 outline-none bg-stone-50 text-sm">
                <option value="">Seleccionar máquina...</option>
                {machines.map(m => <option key={m.id} value={m.id}>{m.name} ({m.brand})</option>)}
              </select>
              {machines.length === 0 && <p className="text-[10px] text-red-500 mt-1">No hay maquinarias registradas.</p>}
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">Descripción</label>
            <input type="text" required placeholder="Ej: Compra de gasoil" value={expenseForm.description} onChange={e => setExpenseForm({...expenseForm, description: e.target.value})} className="w-full px-3 py-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-400 outline-none bg-stone-50 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">Monto ($)</label>
            <input type="number" step="0.01" min="0" required placeholder="Ej: 150000" value={expenseForm.amount} onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})} className="w-full px-3 py-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-400 outline-none bg-stone-50 text-sm" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={cancelEditExpense} className="flex-1 py-3 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold transition-colors text-sm">Cancelar</button>
            <button type="submit" disabled={isActionLoading} className={`flex-[2] py-3 rounded-2xl text-white font-black text-sm transition-colors shadow-lg disabled:opacity-50 ${editingExpenseId ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-100' : 'bg-stone-900 hover:bg-stone-700 shadow-stone-200'}`}>
              {isActionLoading ? 'Guardando...' : (editingExpenseId ? 'Actualizar Gasto' : 'Registrar Gasto')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )}

  {/* ── Modal: Nueva Lluvia ── */}
  {showRainModal && (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm border border-stone-100 animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-6 border-b border-stone-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-xl">
              <CloudRain className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-lg font-black text-stone-900">Nueva Medición</h3>
          </div>
          <button onClick={() => { setShowRainModal(false); setRainForm({ date: '', mm: '' }); }} className="p-2 hover:bg-stone-100 rounded-xl transition-colors">
            <X className="w-5 h-5 text-stone-400" />
          </button>
        </div>
        <form onSubmit={handleAddRain} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">Fecha</label>
            <input type="date" required value={rainForm.date} onChange={e => setRainForm({...rainForm, date: e.target.value})} className="w-full px-3 py-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-blue-400 outline-none bg-stone-50 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">Milímetros (mm)</label>
            <input type="number" step="0.1" min="0" required placeholder="Ej: 15.5" value={rainForm.mm} onChange={e => setRainForm({...rainForm, mm: e.target.value})} className="w-full px-3 py-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-blue-400 outline-none bg-stone-50 text-sm" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setShowRainModal(false); setRainForm({ date: '', mm: '' }); }} className="flex-1 py-3 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold transition-colors text-sm">Cancelar</button>
            <button type="submit" disabled={isActionLoading} className="flex-[2] py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm transition-colors shadow-lg shadow-blue-100 disabled:opacity-50">
              {isActionLoading ? 'Guardando...' : 'Registrar Lluvia'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )}
</div>
);
}


