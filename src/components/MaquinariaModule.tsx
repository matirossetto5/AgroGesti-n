import React, { useState, useEffect } from 'react';
import { 
  collection, onSnapshot, addDoc, query, orderBy, deleteDoc, doc, Timestamp, updateDoc 
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError } from '../lib/errorHandlers';
import { 
  Wrench, Settings as SettingsIcon, Truck, Plus, Trash2, 
  History, Gauge, Fuel, Calendar, Activity, ChevronRight, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Machine {
  id: string;
  name: string;
  type: string;
  brand: string;
  year: number;
  currentHours: number;
  status: 'operativa' | 'mantenimiento' | 'fuera_servicio';
}

interface Maintenance {
  id: string;
  machineId: string;
  date: any;
  description: string;
  cost: number;
  hoursAtMaintenance: number;
}

export default function MaquinariaModule({ farmId }: { farmId: string }) {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [activeView, setActiveView] = useState<'lista' | 'nuevo' | 'mantenimiento'>('lista');
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);

  // Form States
  const [machineForm, setMachineForm] = useState({
    name: '', type: '', brand: '', year: new Date().getFullYear(), currentHours: 0
  });
  const [maintForm, setMaintForm] = useState({
    description: '', cost: '', hours: '', date: new Date().toISOString().split('T')[0]
  });
  const [isActionLoading, setIsActionLoading] = useState(false);

  useEffect(() => {
    if (!farmId) return;

    const machinesUnsubscribe = onSnapshot(collection(db, 'farms', farmId, 'machines'), (snapshot) => {
      const loaded: Machine[] = [];
      snapshot.forEach((doc) => loaded.push({ id: doc.id, ...doc.data() } as Machine));
      setMachines(loaded);
    });

    return () => machinesUnsubscribe();
  }, [farmId]);

  const loadMaintenances = (machineId: string) => {
    return onSnapshot(
      query(collection(db, 'farms', farmId, 'machines', machineId, 'maintenance'), orderBy('date', 'desc')),
      (snapshot) => {
        const loaded: Maintenance[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          loaded.push({ 
            id: doc.id, 
            ...data, 
            date: data.date instanceof Timestamp ? data.date.toDate() : new Date(data.date)
          } as Maintenance);
        });
        setMaintenances(loaded);
      }
    );
  };

  const handleCreateMachine = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsActionLoading(true);
    try {
      await addDoc(collection(db, 'farms', farmId, 'machines'), {
        ...machineForm,
        status: 'operativa',
        createdAt: Timestamp.now()
      });
      setActiveView('lista');
      setMachineForm({ name: '', type: '', brand: '', year: new Date().getFullYear(), currentHours: 0 });
    } catch (error) {
       handleFirestoreError(error, 'create', `farms/${farmId}/machines`, auth);
    } finally {
       setIsActionLoading(false);
    }
  };

  const handleAddMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMachine) return;
    setIsActionLoading(true);
    try {
      await addDoc(collection(db, 'farms', farmId, 'machines', selectedMachine.id, 'maintenance'), {
        description: maintForm.description,
        cost: Number(maintForm.cost),
        hoursAtMaintenance: Number(maintForm.hours),
        date: Timestamp.fromDate(new Date(maintForm.date))
      });
      
      // Update machine hours if maintenance hours are higher
      if (Number(maintForm.hours) > selectedMachine.currentHours) {
        await updateDoc(doc(db, 'farms', farmId, 'machines', selectedMachine.id), {
          currentHours: Number(maintForm.hours)
        });
      }

      setMaintForm({ description: '', cost: '', hours: '', date: new Date().toISOString().split('T')[0] });
      setActiveView('lista');
    } catch (error) {
       handleFirestoreError(error, 'create', `farms/${farmId}/machines/${selectedMachine.id}/maintenance`, auth);
    } finally {
       setIsActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-1">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-stone-900 tracking-tight">Parque de Maquinarias</h2>
          <p className="text-stone-500 text-sm">Control de inventario, horas de uso y gastos de mantenimiento</p>
        </div>
        <button 
          onClick={() => setActiveView('nuevo')}
          className="bg-emerald-600 text-white font-bold px-6 py-3 rounded-2xl hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg shadow-emerald-100"
        >
          <Plus className="w-5 h-5" /> Nueva Máquina
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeView === 'lista' ? (
          <motion.div 
            key="lista"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {machines.map(machine => (
              <div key={machine.id} className="bg-white border border-stone-100 rounded-[2.5rem] p-6 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
                <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-5 ${
                  machine.status === 'operativa' ? 'bg-emerald-500' : 
                  machine.status === 'mantenimiento' ? 'bg-amber-500' : 'bg-red-500'
                }`} />
                
                <div className="flex justify-between items-start mb-6">
                  <div className="p-4 bg-stone-50 rounded-2xl">
                    <Truck className="w-8 h-8 text-stone-400" />
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                    machine.status === 'operativa' ? 'bg-emerald-100 text-emerald-700' : 
                    machine.status === 'mantenimiento' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {(machine.status || '').replace('_', ' ')}
                  </span>
                </div>

                <h3 className="text-xl font-black text-stone-900 mb-1">{machine.name}</h3>
                <p className="text-stone-400 text-xs font-bold uppercase tracking-wider mb-4">{machine.brand} • {machine.type} • Mod {machine.year}</p>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-stone-50 p-3 rounded-2xl">
                    <div className="flex items-center gap-2 text-stone-400 mb-1">
                      <Gauge className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase">Uso Total</span>
                    </div>
                    <p className="text-lg font-black text-stone-800">{machine.currentHours} <span className="text-xs font-normal text-stone-500">hs</span></p>
                  </div>
                  <div className="bg-stone-50 p-3 rounded-2xl">
                    <div className="flex items-center gap-2 text-stone-400 mb-1">
                      <Fuel className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase">Estado</span>
                    </div>
                    <p className="text-lg font-black text-stone-800">100%</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                       setSelectedMachine(machine);
                       setActiveView('mantenimiento');
                       loadMaintenances(machine.id);
                    }}
                    className="flex-1 bg-stone-100 text-stone-600 font-bold py-3 rounded-xl hover:bg-stone-200 transition-all text-sm flex items-center justify-center gap-2"
                  >
                    <Wrench className="w-4 h-4" /> Mantenimiento
                  </button>
                </div>
              </div>
            ))}
          </motion.div>
        ) : activeView === 'nuevo' ? (
          <motion.div 
            key="nuevo"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-2xl mx-auto bg-white border border-stone-200 rounded-[2.5rem] p-8 shadow-sm"
          >
            <h3 className="text-2xl font-black text-stone-900 mb-6">Alta de Maquinaria</h3>
            <form onSubmit={handleCreateMachine} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-bold text-stone-700 mb-2">Nombre / Identificación</label>
                  <input required type="text" value={machineForm.name} onChange={e => setMachineForm({...machineForm, name: e.target.value})} className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Ej: John Deere 6125J" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-2">Tipo</label>
                  <select required value={machineForm.type} onChange={e => setMachineForm({...machineForm, type: e.target.value})} className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-emerald-500">
                    <option value="">Selecciona...</option>
                    <option value="Tractor">Tractor</option>
                    <option value="Cosechadora">Cosechadora</option>
                    <option value="Sembradora">Sembradora</option>
                    <option value="Pulverizadora">Pulverizadora</option>
                    <option value="Camioneta">Camioneta</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-2">Marca</label>
                  <input required type="text" value={machineForm.brand} onChange={e => setMachineForm({...machineForm, brand: e.target.value})} className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Ej: New Holland" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-2">Año</label>
                  <input required type="number" value={machineForm.year} onChange={e => setMachineForm({...machineForm, year: Number(e.target.value)})} className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-2">Horas/Km Actuales</label>
                  <input required type="number" value={machineForm.currentHours} onChange={e => setMachineForm({...machineForm, currentHours: Number(e.target.value)})} className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setActiveView('lista')} className="flex-1 bg-stone-100 text-stone-600 font-bold py-4 rounded-2xl hover:bg-stone-200 transition-all">Cancelar</button>
                <button type="submit" disabled={isActionLoading} className="flex-[2] bg-emerald-600 text-white font-black py-4 rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 uppercase tracking-widest text-sm disabled:opacity-50">
                   {isActionLoading ? 'Guardando...' : 'Guardar Maquinaria'}
                </button>
              </div>
            </form>
          </motion.div>
        ) : (
          <motion.div 
            key="mantenimiento"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white border border-stone-200 rounded-[2rem] p-6">
                <button onClick={() => setActiveView('lista')} className="flex items-center gap-2 text-stone-400 hover:text-stone-600 font-bold mb-4 text-xs uppercase tracking-wider transition-colors">
                  <ArrowBack className="w-4 h-4" /> Volver al listado
                </button>
                <h3 className="text-xl font-black text-stone-900 mb-1">{selectedMachine?.name}</h3>
                <p className="text-stone-400 text-xs font-bold uppercase tracking-wider mb-6">{selectedMachine?.brand} • {selectedMachine?.year}</p>
                
                <form onSubmit={handleAddMaintenance} className="space-y-4">
                  <h4 className="text-sm font-black text-stone-800 uppercase tracking-widest mb-2">Registrar Servicio</h4>
                  <input required type="text" placeholder="Descripción del trabajo" value={maintForm.description} onChange={e => setMaintForm({...maintForm, description: e.target.value})} className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-emerald-500 text-sm" />
                  <div className="grid grid-cols-2 gap-3">
                    <input required type="number" placeholder="Horas/Km" value={maintForm.hours} onChange={e => setMaintForm({...maintForm, hours: e.target.value})} className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-emerald-500 text-sm" />
                    <input required type="number" placeholder="Costo $" value={maintForm.cost} onChange={e => setMaintForm({...maintForm, cost: e.target.value})} className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-emerald-500 text-sm" />
                  </div>
                  <input required type="date" value={maintForm.date} onChange={e => setMaintForm({...maintForm, date: e.target.value})} className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-emerald-500 text-sm" />
                  <button type="submit" disabled={isActionLoading} className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition-all text-sm uppercase tracking-widest disabled:opacity-50">
                    {isActionLoading ? 'Guardando...' : 'Guardar Registro'}
                  </button>
                </form>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="bg-white border border-stone-200 rounded-[2.5rem] p-8 min-h-[400px]">
                <h3 className="text-xl font-black text-stone-900 mb-6 flex items-center gap-2">
                  <History className="w-5 h-5 text-emerald-600" />
                  Historial de Mantenimiento
                </h3>
                
                {maintenances.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-stone-400">
                    <History className="w-12 h-12 mb-4 opacity-20" />
                    <p className="font-bold">Sin registros de servicio aún</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {maintenances.map(m => (
                      <div key={m.id} className="flex items-center justify-between p-4 border-b border-stone-100 last:border-0 hover:bg-stone-50 transition-colors">
                        <div>
                          <p className="font-bold text-stone-900">{m.description}</p>
                          <p className="text-xs text-stone-400 font-bold uppercase tracking-widest">{m.date.toLocaleDateString('es-AR')} • {m.hoursAtMaintenance} hs</p>
                        </div>
                        <p className="text-lg font-black text-amber-600">$ {m.cost.toLocaleString('es-AR')}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ArrowBack({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}
