import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import {
  Plus, PlusCircle, MinusCircle, Edit2, Trash2, Search, Scale, X, History,
  TrendingUp, AlertCircle, AlertTriangle, UtensilsCrossed,
  ArrowRight, ShoppingCart, Activity, CheckCircle,
  Users
} from 'lucide-react';
import { Tropa, TropaEvent, RegistroRacion } from '../types';

interface GanaderiaModuleProps {
  farmId: string;
}

const CONFINEMENT_ENTRY_KG = 400;
const SALE_WEIGHT_MIN_KG = 470;
const TERMINACION_TARGET_DAYS = 90;

// ---- Helper components ----

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: 'emerald' | 'blue' | 'sky' | 'amber' }) {
  const palette = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    sky: 'bg-sky-50 text-sky-600',
    amber: 'bg-amber-50 text-amber-600',
  };
  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-stone-100 flex items-center gap-4">
      <div className={`p-3 rounded-xl ${palette[color]}`}>{icon}</div>
      <div>
        <p className="text-xs text-stone-500 font-medium uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-stone-900">{value}</p>
      </div>
    </div>
  );
}

function Metric({ label, value, icon, highlight }: { label: string; value: string; icon: React.ReactNode; highlight?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-stone-400 shrink-0">{icon}</span>
      <div>
        <p className="text-xs text-stone-500">{label}</p>
        <p className={`text-sm font-semibold ${highlight ? 'text-amber-700 font-bold' : 'text-stone-700'}`}>{value}</p>
      </div>
    </div>
  );
}

function ActionBtn({ onClick, icon, label, variant }: { onClick: () => void; icon: React.ReactNode; label: string; variant: 'blue' | 'amber' | 'emerald' | 'ghost' }) {
  const styles = {
    blue: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
    amber: 'bg-amber-50 text-amber-700 hover:bg-amber-100',
    emerald: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
    ghost: 'bg-stone-100 text-stone-600 hover:bg-stone-200',
  };
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${styles[variant]}`}
    >
      {icon}
      {label}
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center py-16 text-stone-400 border-2 border-dashed border-stone-100 rounded-2xl">
      <Activity className="w-12 h-12 mx-auto mb-3 opacity-20" />
      <p className="font-medium">{text}</p>
    </div>
  );
}

interface ModalProps {
  title: string;
  onClose: () => void;
  onSave: () => void;
  isSubmitting?: boolean;
  saveLabel?: string;
  saveVariant?: 'emerald' | 'amber' | 'red';
  error?: string | null;
  children: React.ReactNode;
  maxWidth?: string;
}

function Modal({ title, onClose, onSave, isSubmitting, saveLabel = 'Guardar', saveVariant = 'emerald', error, children, maxWidth = 'max-w-2xl' }: ModalProps) {
  const btnColors = {
    emerald: 'bg-emerald-600 hover:bg-emerald-700',
    amber: 'bg-amber-500 hover:bg-amber-600',
    red: 'bg-red-600 hover:bg-red-700',
  };
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`bg-white rounded-2xl shadow-xl w-full ${maxWidth} flex flex-col max-h-[90vh]`}>
        <div className="p-5 border-b border-stone-100 flex justify-between items-center bg-stone-50/50 shrink-0">
          <h3 className="font-bold text-stone-900 text-lg">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-stone-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-stone-400" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        <div className="p-5 border-t border-stone-100 bg-stone-50/50 shrink-0 space-y-2">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="px-6 py-2.5 text-stone-600 font-bold hover:bg-stone-200 rounded-xl transition-all">
              Cancelar
            </button>
            <button
              onClick={onSave}
              disabled={isSubmitting}
              className={`px-8 py-2.5 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed ${btnColors[saveVariant]}`}
            >
              {isSubmitting ? 'Guardando...' : saveLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Main Component ----

export default function GanaderiaModule({ farmId }: GanaderiaModuleProps) {
  const [tropas, setTropas] = useState<Tropa[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'recria' | 'terminacion'>('recria');
  const [searchTerm, setSearchTerm] = useState('');

  // Herd modal
  const [isHerdOpen, setIsHerdOpen] = useState(false);
  const [editingTropa, setEditingTropa] = useState<Tropa | null>(null);
  const [herdForm, setHerdForm] = useState({
    name: '', sex: 'Macho' as 'Macho' | 'Hembra',
    quantity: '', entryDate: '', entryWeight: '', notes: '',
  });
  const [herdErrors, setHerdErrors] = useState<string[]>([]);

  // Pesaje modal
  const [isPesajeOpen, setIsPesajeOpen] = useState(false);
  const [pesajeTropaId, setPesajeTropaId] = useState('');
  const [pesajeForm, setPesajeForm] = useState({ date: '', weight: '', notes: '' });

  // Terminación modal
  const [isTerminacionOpen, setIsTerminacionOpen] = useState(false);
  const [terminacionTropaId, setTerminacionTropaId] = useState('');
  const [terminacionForm, setTerminacionForm] = useState({ quantity: '', weight: '', newName: '' });

  // Baja modal
  const [isBajaOpen, setIsBajaOpen] = useState(false);
  const [bajaTropaId, setBajaTropaId] = useState('');
  const [bajaForm, setBajaForm] = useState({ date: '', quantity: '', notes: '' });

  // Agregar animales modal
  const [isAgregarOpen, setIsAgregarOpen] = useState(false);
  const [agregarTropaId, setAgregarTropaId] = useState('');
  const [agregarForm, setAgregarForm] = useState({ date: '', quantity: '', weight: '', notes: '' });

  // Ración modal
  const [isRacionOpen, setIsRacionOpen] = useState(false);
  const [racionTropaId, setRacionTropaId] = useState('');
  const [racionForm, setRacionForm] = useState({
    date: '', siloMaiz: '', maizPartido: '', concentradoProteico: '',
    precioSiloMaiz: '', precioMaizPartido: '', precioConcentrado: '', notes: '',
  });

  // Venta modal
  const [isVentaOpen, setIsVentaOpen] = useState(false);
  const [ventaTropaId, setVentaTropaId] = useState('');
  const [ventaForm, setVentaForm] = useState({
    date: '', quantity: '', weightAtSale: '', pricePerKg: '', notes: '',
  });

  // Historial modal
  const [isHistorialOpen, setIsHistorialOpen] = useState(false);
  const [historialTropa, setHistorialTropa] = useState<Tropa | null>(null);
  const [historialTab, setHistorialTab] = useState<'eventos' | 'raciones'>('eventos');
  const [historialDateFilter, setHistorialDateFilter] = useState<{ from: string; to: string }>({ from: '', to: '' });

  // Delete confirm
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!farmId) return;
    const q = query(collection(db, `farms/${farmId}/herds`), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setTropas(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Tropa[]);
      setIsLoading(false);
    }, (err) => {
      console.error('Error loading tropas:', err);
      setIsLoading(false);
    });
    return () => unsub();
  }, [farmId]);

  // ---- Derived values ----
  const recriaTropas = tropas.filter(t => t.status === 'Recría');
  const terminacionTropas = tropas.filter(t => t.status === 'Terminación');
  const totalAnimals = tropas.reduce((s, t) => s + (t.quantity || 0), 0);
  const readyForConfinement = recriaTropas.filter(t => t.currentWeight >= CONFINEMENT_ENTRY_KG);
  const readyForSale = terminacionTropas.filter(t => t.currentWeight >= SALE_WEIGHT_MIN_KG);

  const filterList = (list: Tropa[]) => {
    const term = searchTerm.toLowerCase();
    if (!term) return list;
    return list.filter(t => t.name.toLowerCase().includes(term) || t.sex.toLowerCase().includes(term));
  };

  const getDaysIn = (tropa: Tropa) => {
    const ref = tropa.status === 'Terminación'
      ? (tropa.terminationStartDate || tropa.createdAt)
      : (tropa.entryDate || tropa.createdAt);
    return Math.max(0, Math.floor((Date.now() - new Date(ref).getTime()) / 86400000));
  };

  const getRacionCostPerAnimal = (r: RegistroRacion) =>
    r.siloMaiz * (r.precioSiloMaiz || 0) +
    r.maizPartido * (r.precioMaizPartido || 0) +
    r.concentradoProteico * (r.precioConcentrado || 0);

  // ---- Handlers ----

  const openNewHerd = () => {
    setEditingTropa(null);
    setHerdForm({ name: '', sex: 'Macho', quantity: '', entryDate: today, entryWeight: '', notes: '' });
    setHerdErrors([]);
    setModalError(null);
    setIsHerdOpen(true);
  };

  const openEditHerd = (t: Tropa) => {
    setEditingTropa(t);
    setHerdForm({
      name: t.name, sex: t.sex,
      quantity: t.quantity.toString(),
      entryDate: t.entryDate || today,
      entryWeight: t.entryWeight.toString(),
      notes: t.notes || '',
    });
    setHerdErrors([]);
    setModalError(null);
    setIsHerdOpen(true);
  };

  const saveHerd = async () => {
    const errs: string[] = [];
    if (!herdForm.name.trim()) errs.push('Nombre requerido.');
    const qty = Number(herdForm.quantity);
    if (!herdForm.quantity || isNaN(qty) || qty < 1 || !Number.isInteger(qty)) errs.push('Cantidad inválida (mínimo 1 animal, número entero).');
    const weight = Number(herdForm.entryWeight);
    if (!herdForm.entryWeight || isNaN(weight) || weight < 50) errs.push('Peso de ingreso inválido (mínimo 50 kg).');
    if (!herdForm.entryDate) errs.push('Fecha de ingreso requerida.');
    if (errs.length) { setHerdErrors(errs); return; }

    setIsSubmitting(true);
    setModalError(null);
    try {
      const data = {
        name: herdForm.name.trim(),
        sex: herdForm.sex,
        quantity: qty,
        entryDate: herdForm.entryDate,
        entryWeight: weight,
        currentWeight: editingTropa ? editingTropa.currentWeight : weight,
        status: editingTropa ? editingTropa.status : 'Recría' as const,
        terminationStartDate: editingTropa?.terminationStartDate || null,
        events: editingTropa?.events || [],
        raciones: editingTropa?.raciones || [],
        notes: herdForm.notes,
        updatedAt: new Date().toISOString(),
      };
      if (editingTropa) {
        await updateDoc(doc(db, `farms/${farmId}/herds`, editingTropa.id), data);
      } else {
        await addDoc(collection(db, `farms/${farmId}/herds`), { ...data, createdAt: new Date().toISOString() });
      }
      setIsHerdOpen(false);
    } catch (e: any) {
      setModalError(e?.message || 'Error al guardar.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, `farms/${farmId}/herds`, deleteId));
    } catch (e) { console.error(e); }
    setIsSubmitting(false);
    setIsDeleteOpen(false);
    setDeleteId(null);
  };

  const openPesaje = (tropaId: string) => {
    setPesajeTropaId(tropaId);
    setPesajeForm({ date: today, weight: '', notes: '' });
    setModalError(null);
    setIsPesajeOpen(true);
  };

  const savePesaje = async () => {
    const w = Number(pesajeForm.weight);
    if (!pesajeForm.weight || isNaN(w) || w < 50) { setModalError('Ingresá un peso válido (mínimo 50 kg).'); return; }
    setIsSubmitting(true);
    setModalError(null);
    try {
      const tropa = tropas.find(t => t.id === pesajeTropaId)!;
      const event: TropaEvent = {
        id: Date.now().toString(),
        date: pesajeForm.date,
        type: 'Pesaje',
        description: pesajeForm.notes || `Peso registrado: ${w} kg/animal`,
        weightPerAnimal: w,
        quantity: tropa.quantity,
      };
      await updateDoc(doc(db, `farms/${farmId}/herds`, pesajeTropaId), {
        currentWeight: w,
        events: [event, ...(tropa.events || [])],
        updatedAt: new Date().toISOString(),
      });
      setIsPesajeOpen(false);
    } catch (e: any) {
      setModalError(e?.message || 'Error al guardar pesaje.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openTerminacion = (tropaId: string) => {
    const tropa = tropas.find(t => t.id === tropaId)!;
    setTerminacionTropaId(tropaId);
    setTerminacionForm({
      quantity: tropa.quantity.toString(),
      weight: tropa.currentWeight.toString(),
      newName: `${tropa.name} - Terminación`,
    });
    setModalError(null);
    setIsTerminacionOpen(true);
  };

  const saveTerminacion = async () => {
    const tropa = tropas.find(t => t.id === terminacionTropaId)!;
    const qty = Number(terminacionForm.quantity);
    const weight = Number(terminacionForm.weight);
    if (!qty || qty < 1 || !Number.isInteger(qty) || qty > tropa.quantity) {
      setModalError(`Cantidad inválida (mínimo 1, máximo ${tropa.quantity} animales).`);
      return;
    }
    if (!weight || weight < 50) { setModalError('Peso inválido (mínimo 50 kg).'); return; }
    setIsSubmitting(true);
    setModalError(null);
    try {
      const eventRecria: TropaEvent = {
        id: Date.now().toString(),
        date: today,
        type: 'Traslado',
        description: `${qty} animales enviados a Terminación a ${weight} kg/an. promedio.`,
        quantity: qty,
        weightPerAnimal: weight,
      };
      const eventTerm: TropaEvent = {
        id: (Date.now() + 1).toString(),
        date: today,
        type: 'Traslado',
        description: `Ingreso a confinamiento desde recría. ${qty} animales a ${weight} kg/an. Días en recría: ${getDaysIn(tropa)}.`,
        quantity: qty,
        weightPerAnimal: weight,
      };
      const batch = writeBatch(db);
      const remainingQty = tropa.quantity - qty;
      if (remainingQty <= 0) {
        batch.delete(doc(db, `farms/${farmId}/herds`, terminacionTropaId));
      } else {
        batch.update(doc(db, `farms/${farmId}/herds`, terminacionTropaId), {
          quantity: remainingQty,
          events: [eventRecria, ...(tropa.events || [])],
          updatedAt: new Date().toISOString(),
        });
      }
      const newRef = doc(collection(db, `farms/${farmId}/herds`));
      batch.set(newRef, {
        name: terminacionForm.newName.trim() || `${tropa.name} - Terminación`,
        sex: tropa.sex,
        quantity: qty,
        entryDate: tropa.entryDate,
        entryWeight: weight,
        currentWeight: weight,
        status: 'Terminación',
        terminationStartDate: today,
        events: [eventTerm],
        raciones: [],
        notes: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      await batch.commit();
      setIsTerminacionOpen(false);
      setActiveTab('terminacion');
    } catch (e: any) {
      setModalError(e?.message || 'Error al mover a terminación.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openBaja = (tropaId: string) => {
    setBajaTropaId(tropaId);
    setBajaForm({ date: today, quantity: '', notes: '' });
    setModalError(null);
    setIsBajaOpen(true);
  };

  const saveBaja = async () => {
    const tropa = tropas.find(t => t.id === bajaTropaId)!;
    const qty = Number(bajaForm.quantity);
    if (!qty || qty < 1 || !Number.isInteger(qty) || qty > tropa.quantity) {
      setModalError(`Cantidad inválida (mínimo 1, máximo ${tropa.quantity} animales).`);
      return;
    }
    setIsSubmitting(true);
    setModalError(null);
    try {
      const event: TropaEvent = {
        id: Date.now().toString(),
        date: bajaForm.date,
        type: 'Baja',
        description: `Baja de ${qty} animal${qty > 1 ? 'es' : ''}.${bajaForm.notes ? ' ' + bajaForm.notes : ''}`,
        quantity: qty,
      };
      const remaining = tropa.quantity - qty;
      if (remaining <= 0) {
        await deleteDoc(doc(db, `farms/${farmId}/herds`, bajaTropaId));
      } else {
        await updateDoc(doc(db, `farms/${farmId}/herds`, bajaTropaId), {
          quantity: remaining,
          events: [event, ...(tropa.events || [])],
          updatedAt: new Date().toISOString(),
        });
      }
      setIsBajaOpen(false);
    } catch (e: any) {
      setModalError(e?.message || 'Error al registrar baja.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openAgregar = (tropaId: string) => {
    setAgregarTropaId(tropaId);
    setAgregarForm({ date: today, quantity: '', weight: '', notes: '' });
    setModalError(null);
    setIsAgregarOpen(true);
  };

  const saveAgregar = async () => {
    const qty = Number(agregarForm.quantity);
    const weight = Number(agregarForm.weight);
    if (!qty || qty < 1 || !Number.isInteger(qty)) { setModalError('Cantidad inválida (mínimo 1 animal, entero).'); return; }
    if (!weight || weight < 50) { setModalError('Peso inválido (mínimo 50 kg).'); return; }
    setIsSubmitting(true);
    setModalError(null);
    try {
      const tropa = tropas.find(t => t.id === agregarTropaId)!;
      const newQty = tropa.quantity + qty;
      const newWeight = Math.round(((tropa.currentWeight * tropa.quantity + weight * qty) / newQty) * 10) / 10;
      const event: TropaEvent = {
        id: Date.now().toString(),
        date: agregarForm.date,
        type: 'Compra',
        description: `Ingreso de ${qty} animales a ${weight} kg/an. Nuevo total: ${newQty} animales, promedio: ${newWeight} kg/an.${agregarForm.notes ? ' · ' + agregarForm.notes : ''}`,
        quantity: qty,
        weightPerAnimal: weight,
      };
      await updateDoc(doc(db, `farms/${farmId}/herds`, agregarTropaId), {
        quantity: newQty,
        currentWeight: newWeight,
        events: [event, ...(tropa.events || [])],
        updatedAt: new Date().toISOString(),
      });
      setIsAgregarOpen(false);
    } catch (e: any) {
      setModalError(e?.message || 'Error al agregar animales.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openRacion = (tropaId: string) => {
    setRacionTropaId(tropaId);
    setRacionForm({ date: today, siloMaiz: '', maizPartido: '', concentradoProteico: '', precioSiloMaiz: '', precioMaizPartido: '', precioConcentrado: '', notes: '' });
    setModalError(null);
    setIsRacionOpen(true);
  };

  const saveRacion = async () => {
    const s = Number(racionForm.siloMaiz) || 0;
    const m = Number(racionForm.maizPartido) || 0;
    const c = Number(racionForm.concentradoProteico) || 0;
    if (s + m + c <= 0) { setModalError('Ingresá al menos una cantidad mayor a 0.'); return; }
    setIsSubmitting(true);
    setModalError(null);
    try {
      const tropa = tropas.find(t => t.id === racionTropaId)!;
      const racion: RegistroRacion = {
        id: Date.now().toString(),
        date: racionForm.date,
        siloMaiz: s,
        maizPartido: m,
        concentradoProteico: c,
        precioSiloMaiz: Number(racionForm.precioSiloMaiz) || 0,
        precioMaizPartido: Number(racionForm.precioMaizPartido) || 0,
        precioConcentrado: Number(racionForm.precioConcentrado) || 0,
        notes: racionForm.notes,
      };
      await updateDoc(doc(db, `farms/${farmId}/herds`, racionTropaId), {
        raciones: [racion, ...(tropa.raciones || [])],
        updatedAt: new Date().toISOString(),
      });
      setIsRacionOpen(false);
    } catch (e: any) {
      setModalError(e?.message || 'Error al guardar ración.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openVenta = (tropaId: string) => {
    const tropa = tropas.find(t => t.id === tropaId)!;
    setVentaTropaId(tropaId);
    setVentaForm({ date: today, quantity: tropa.quantity.toString(), weightAtSale: tropa.currentWeight.toString(), pricePerKg: '', notes: '' });
    setModalError(null);
    setIsVentaOpen(true);
  };

  const saveVenta = async () => {
    const qty = Number(ventaForm.quantity);
    const w = Number(ventaForm.weightAtSale);
    if (!qty || qty < 1 || !w || w < 50) { setModalError('Completá cantidad y peso correctamente.'); return; }
    setIsSubmitting(true);
    setModalError(null);
    try {
      const tropa = tropas.find(t => t.id === ventaTropaId)!;
      if (qty > tropa.quantity) {
        setModalError(`No podés vender más de ${tropa.quantity} animales.`);
        setIsSubmitting(false);
        return;
      }
      const pxkg = Number(ventaForm.pricePerKg) || 0;
      const totalIncome = qty * w * pxkg;
      const event: TropaEvent = {
        id: Date.now().toString(),
        date: ventaForm.date,
        type: 'Otro',
        description: `Venta/Faena: ${qty} animales · ${w} kg/an.${pxkg ? ` · $${pxkg}/kg · Total: $${totalIncome.toLocaleString()}` : ''}${ventaForm.notes ? ` · ${ventaForm.notes}` : ''}`,
      };
      const remaining = tropa.quantity - qty;
      if (remaining <= 0) {
        await deleteDoc(doc(db, `farms/${farmId}/herds`, ventaTropaId));
      } else {
        await updateDoc(doc(db, `farms/${farmId}/herds`, ventaTropaId), {
          quantity: remaining,
          events: [event, ...(tropa.events || [])],
          updatedAt: new Date().toISOString(),
        });
      }
      setIsVentaOpen(false);
    } catch (e: any) {
      setModalError(e?.message || 'Error al registrar venta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---- Render ----

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }

  const filteredRecria = filterList(recriaTropas);
  const filteredTerminacion = filterList(terminacionTropas);

  // Computed values for pesaje modal (outside JSX to avoid IIFE issues)
  const pesajeTropa = tropas.find(t => t.id === pesajeTropaId);
  const pesajeNewWeight = Number(pesajeForm.weight);
  const pesajeReadyForConf = pesajeTropa?.status === 'Recría' && pesajeNewWeight >= CONFINEMENT_ENTRY_KG;

  // Computed values for ración modal
  const racionTropa = tropas.find(t => t.id === racionTropaId);
  const rSilo = Number(racionForm.siloMaiz) || 0;
  const rMaiz = Number(racionForm.maizPartido) || 0;
  const rConc = Number(racionForm.concentradoProteico) || 0;
  const rTotalPerAnimal = rSilo + rMaiz + rConc;
  const rCostPerAnimal =
    rSilo * (Number(racionForm.precioSiloMaiz) || 0) +
    rMaiz * (Number(racionForm.precioMaizPartido) || 0) +
    rConc * (Number(racionForm.precioConcentrado) || 0);

  // Computed values for venta modal
  const ventaTropa = tropas.find(t => t.id === ventaTropaId);
  const vQty = Number(ventaForm.quantity) || 0;
  const vWeight = Number(ventaForm.weightAtSale) || 0;
  const vPxKg = Number(ventaForm.pricePerKg) || 0;
  const vTotal = vQty * vWeight * vPxKg;

  // Computed values for terminación modal
  const terminacionTropaData = tropas.find(t => t.id === terminacionTropaId);
  const tQty = Number(terminacionForm.quantity) || 0;
  const tWeight = Number(terminacionForm.weight) || 0;

  // Computed values for agregar modal
  const agregarTropaData = tropas.find(t => t.id === agregarTropaId);
  const aQty = Number(agregarForm.quantity) || 0;
  const aWeight = Number(agregarForm.weight) || 0;
  const aNewQty = agregarTropaData ? agregarTropaData.quantity + aQty : 0;
  const aNewWeight = (agregarTropaData && aQty > 0 && aWeight >= 50)
    ? Math.round(((agregarTropaData.currentWeight * agregarTropaData.quantity + aWeight * aQty) / aNewQty) * 10) / 10
    : 0;

  return (
    <div className="space-y-6">

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<Activity className="w-6 h-6" />} label="Total Tropas" value={tropas.length} color="emerald" />
        <StatCard icon={<Users className="w-6 h-6" />} label="Total Animales" value={totalAnimals} color="blue" />
        <StatCard icon={<TrendingUp className="w-6 h-6" />} label="En Recría" value={recriaTropas.length} color="sky" />
        <StatCard icon={<UtensilsCrossed className="w-6 h-6" />} label="En Terminación" value={terminacionTropas.length} color="amber" />
      </div>

      {/* Alert banners */}
      {readyForConfinement.length > 0 && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-sm font-semibold text-amber-800">
            {readyForConfinement.length} tropa{readyForConfinement.length > 1 ? 's' : ''} con peso ≥ {CONFINEMENT_ENTRY_KG} kg —{' '}
            lista{readyForConfinement.length > 1 ? 's' : ''} para pasar a Terminación en confinamiento.
          </p>
        </div>
      )}
      {readyForSale.length > 0 && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <p className="text-sm font-semibold text-emerald-800">
            {readyForSale.length} tropa{readyForSale.length > 1 ? 's' : ''} con peso ≥ {SALE_WEIGHT_MIN_KG} kg —{' '}
            lista{readyForSale.length > 1 ? 's' : ''} para venta/faena.
          </p>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
          <input
            type="text"
            placeholder="Buscar tropa..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
          />
        </div>
        <button
          onClick={openNewHerd}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition-colors font-medium"
        >
          <Plus className="w-5 h-5" />
          Nueva Tropa
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-stone-200">
        <button
          onClick={() => setActiveTab('recria')}
          className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'recria'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-stone-400 hover:text-stone-600'
          }`}
        >
          Recría Pastoril ({recriaTropas.length})
          {readyForConfinement.length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 bg-amber-500 text-white text-xs rounded-full">{readyForConfinement.length}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('terminacion')}
          className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'terminacion'
              ? 'border-amber-600 text-amber-600'
              : 'border-transparent text-stone-400 hover:text-stone-600'
          }`}
        >
          Terminación / Confinamiento ({terminacionTropas.length})
          {readyForSale.length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 bg-emerald-500 text-white text-xs rounded-full">{readyForSale.length}</span>
          )}
        </button>
      </div>

      {/* ---- RECRÍA TAB ---- */}
      {activeTab === 'recria' && (
        filteredRecria.length === 0 ? (
          <EmptyState text={recriaTropas.length === 0 ? 'No hay tropas en recría. Registrá una nueva tropa.' : 'Sin resultados para la búsqueda.'} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredRecria.map(tropa => {
              const ready = tropa.currentWeight >= CONFINEMENT_ENTRY_KG;
              const days = getDaysIn(tropa);
              const weightGain = tropa.currentWeight - tropa.entryWeight;
              return (
                <div key={tropa.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-shadow hover:shadow-md ${ready ? 'border-amber-300' : 'border-stone-200'}`}>
                  {/* Header */}
                  <div className={`px-5 py-4 ${ready ? 'bg-amber-50' : 'bg-blue-50'}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-stone-900 text-lg leading-tight truncate">{tropa.name}</h3>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tropa.sex === 'Macho' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                            {tropa.sex}
                          </span>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Recría</span>
                          {ready && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              ≥{CONFINEMENT_ENTRY_KG} kg
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => openEditHerd(tropa)} className="p-1.5 text-stone-400 hover:text-emerald-600 transition-colors rounded" title="Editar">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => { setDeleteId(tropa.id); setIsDeleteOpen(true); }} className="p-1.5 text-stone-400 hover:text-red-600 transition-colors rounded" title="Eliminar">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="px-5 py-4 grid grid-cols-2 gap-3">
                    <Metric label="Animales" value={tropa.quantity.toString()} icon={<Users className="w-4 h-4" />} />
                    <Metric label="Peso actual" value={`${tropa.currentWeight} kg`} icon={<Scale className="w-4 h-4" />} highlight={ready} />
                  </div>

                  {/* Footer actions */}
                  <div className="px-5 pb-4 flex flex-wrap gap-2 border-t border-stone-100 pt-3">
                    <ActionBtn onClick={() => openPesaje(tropa.id)} icon={<Scale className="w-4 h-4" />} label="Pesaje" variant="blue" />
                    <ActionBtn onClick={() => openAgregar(tropa.id)} icon={<PlusCircle className="w-4 h-4" />} label="Agregar Animales" variant="ghost" />
                    <ActionBtn onClick={() => openBaja(tropa.id)} icon={<MinusCircle className="w-4 h-4" />} label="Baja" variant="ghost" />
                    <ActionBtn onClick={() => openTerminacion(tropa.id)} icon={<ArrowRight className="w-4 h-4" />} label="Pasar a Terminación" variant="amber" />
                    <ActionBtn onClick={() => { setHistorialTropa(tropa); setHistorialTab('eventos'); setHistorialDateFilter({ from: '', to: '' }); setIsHistorialOpen(true); }} icon={<History className="w-4 h-4" />} label="Historial" variant="ghost" />
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ---- TERMINACIÓN TAB ---- */}
      {activeTab === 'terminacion' && (
        filteredTerminacion.length === 0 ? (
          <EmptyState text={terminacionTropas.length === 0 ? 'No hay tropas en terminación.' : 'Sin resultados para la búsqueda.'} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredTerminacion.map(tropa => {
              const readyToSell = tropa.currentWeight >= SALE_WEIGHT_MIN_KG;
              const daysInConf = getDaysIn(tropa);
              const confProgress = Math.min(100, Math.round((daysInConf / TERMINACION_TARGET_DAYS) * 100));
              const sortedRaciones = [...(tropa.raciones || [])].sort((a, b) => b.date.localeCompare(a.date));
              const lastRacion = sortedRaciones[0];
              return (
                <div key={tropa.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-shadow hover:shadow-md ${readyToSell ? 'border-emerald-300' : 'border-stone-200'}`}>
                  {/* Header */}
                  <div className={`px-5 py-4 ${readyToSell ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-stone-900 text-lg leading-tight truncate">{tropa.name}</h3>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tropa.sex === 'Macho' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                            {tropa.sex}
                          </span>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-800">Terminación</span>
                          {readyToSell && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-800 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Listo para venta
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => openEditHerd(tropa)} className="p-1.5 text-stone-400 hover:text-emerald-600 transition-colors rounded">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => { setDeleteId(tropa.id); setIsDeleteOpen(true); }} className="p-1.5 text-stone-400 hover:text-red-600 transition-colors rounded">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="px-5 py-4 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <Metric label="Animales" value={tropa.quantity.toString()} icon={<Users className="w-4 h-4" />} />
                      <Metric label="Peso actual" value={`${tropa.currentWeight} kg`} icon={<Scale className="w-4 h-4" />} highlight={readyToSell} />
                    </div>

                    {/* Confinement progress bar */}
                    <div>
                      <div className="flex justify-between text-xs text-stone-500 mb-1">
                        <span>Días en confinamiento</span>
                        <span className="font-semibold">{daysInConf} / {TERMINACION_TARGET_DAYS} días</span>
                      </div>
                      <div className="w-full bg-stone-100 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${daysInConf >= TERMINACION_TARGET_DAYS ? 'bg-emerald-500' : 'bg-amber-500'}`}
                          style={{ width: `${confProgress}%` }}
                        />
                      </div>
                    </div>

                    {/* Last ración summary */}
                    {lastRacion ? (
                      <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                        <p className="text-xs font-bold text-stone-600 mb-1.5">Última ración — {lastRacion.date}</p>
                        <div className="space-y-0.5 text-xs text-stone-600">
                          {lastRacion.siloMaiz > 0 && <p>Silo maíz: <span className="font-bold">{lastRacion.siloMaiz} kg/an.</span></p>}
                          {lastRacion.maizPartido > 0 && <p>Maíz partido: <span className="font-bold">{lastRacion.maizPartido} kg/an.</span></p>}
                          {lastRacion.concentradoProteico > 0 && <p>Concentrado: <span className="font-bold">{lastRacion.concentradoProteico} kg/an.</span></p>}
                          <p className="font-bold text-stone-700 pt-1 border-t border-amber-200 mt-1">
                            Total: {(lastRacion.siloMaiz + lastRacion.maizPartido + lastRacion.concentradoProteico).toFixed(1)} kg/an./día
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-stone-50 rounded-xl border border-dashed border-stone-200 text-center">
                        <p className="text-xs text-stone-400">Sin raciones registradas aún</p>
                      </div>
                    )}
                  </div>

                  {/* Footer actions */}
                  <div className="px-5 pb-4 flex flex-wrap gap-2 border-t border-stone-100 pt-3">
                    <ActionBtn onClick={() => openRacion(tropa.id)} icon={<UtensilsCrossed className="w-4 h-4" />} label="Registrar Ración" variant="amber" />
                    <ActionBtn onClick={() => openPesaje(tropa.id)} icon={<Scale className="w-4 h-4" />} label="Pesaje" variant="blue" />
                    <ActionBtn onClick={() => openVenta(tropa.id)} icon={<ShoppingCart className="w-4 h-4" />} label="Registrar Venta" variant={readyToSell ? 'emerald' : 'ghost'} />
                    <ActionBtn onClick={() => openBaja(tropa.id)} icon={<MinusCircle className="w-4 h-4" />} label="Baja" variant="ghost" />
                    <ActionBtn onClick={() => { setHistorialTropa(tropa); setHistorialTab('eventos'); setHistorialDateFilter({ from: '', to: '' }); setIsHistorialOpen(true); }} icon={<History className="w-4 h-4" />} label="Historial" variant="ghost" />
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ======== MODALS ======== */}

      {/* Nueva / Editar Tropa */}
      {isHerdOpen && (
        <Modal
          title={editingTropa ? `Editar: ${editingTropa.name}` : 'Nueva Tropa'}
          onClose={() => setIsHerdOpen(false)}
          onSave={saveHerd}
          isSubmitting={isSubmitting}
          error={modalError}
        >
          <div className="space-y-4">
            {herdErrors.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl space-y-1">
                {herdErrors.map((e, i) => (
                  <p key={i} className="text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {e}
                  </p>
                ))}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1 md:col-span-2">
                <label className="text-sm font-bold text-stone-700">Nombre de la Tropa *</label>
                <input
                  type="text"
                  value={herdForm.name}
                  onChange={e => setHerdForm({ ...herdForm, name: e.target.value })}
                  placeholder="Ej: Terneros Lote A"
                  className="w-full p-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-bold text-stone-700">Sexo *</label>
                <select
                  value={herdForm.sex}
                  onChange={e => setHerdForm({ ...herdForm, sex: e.target.value as 'Macho' | 'Hembra' })}
                  className="w-full p-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="Macho">Macho</option>
                  <option value="Hembra">Hembra</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-bold text-stone-700">Cantidad de Animales *</label>
                <input
                  type="number"
                  value={herdForm.quantity}
                  onChange={e => setHerdForm({ ...herdForm, quantity: e.target.value })}
                  min="1"
                  step="1"
                  placeholder="Ej: 100"
                  className="w-full p-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-bold text-stone-700">Fecha de Ingreso al Campo *</label>
                <input
                  type="date"
                  value={herdForm.entryDate}
                  onChange={e => setHerdForm({ ...herdForm, entryDate: e.target.value })}
                  className="w-full p-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-bold text-stone-700">Peso Promedio de Ingreso (kg) *</label>
                <input
                  type="number"
                  value={herdForm.entryWeight}
                  onChange={e => setHerdForm({ ...herdForm, entryWeight: e.target.value })}
                  min="50"
                  step="0.1"
                  placeholder="Ej: 200"
                  className="w-full p-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                <p className="text-xs text-stone-400">Los animales pasan a Terminación cuando alcanzan ≥ {CONFINEMENT_ENTRY_KG} kg.</p>
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-sm font-bold text-stone-700">Notas</label>
                <textarea
                  value={herdForm.notes}
                  onChange={e => setHerdForm({ ...herdForm, notes: e.target.value })}
                  rows={3}
                  placeholder="Observaciones adicionales..."
                  className="w-full p-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                />
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Registrar Pesaje */}
      {isPesajeOpen && pesajeTropa && (
        <Modal
          title={`Registrar Pesaje — ${pesajeTropa.name}`}
          onClose={() => setIsPesajeOpen(false)}
          onSave={savePesaje}
          isSubmitting={isSubmitting}
          saveLabel="Guardar Pesaje"
          error={modalError}
          maxWidth="max-w-lg"
        >
          <div className="space-y-4">
            {pesajeReadyForConf && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-amber-800">
                  Con {pesajeNewWeight} kg esta tropa supera el umbral de {CONFINEMENT_ENTRY_KG} kg y está lista para pasar a Terminación en confinamiento.
                </p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-bold text-stone-700">Fecha *</label>
                <input
                  type="date"
                  value={pesajeForm.date}
                  onChange={e => setPesajeForm({ ...pesajeForm, date: e.target.value })}
                  className="w-full p-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-bold text-stone-700">Peso Promedio por Animal (kg) *</label>
                <input
                  type="number"
                  value={pesajeForm.weight}
                  onChange={e => setPesajeForm({ ...pesajeForm, weight: e.target.value })}
                  min="50"
                  step="0.1"
                  placeholder="Ej: 380"
                  className="w-full p-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-bold text-stone-700">Notas</label>
              <input
                type="text"
                value={pesajeForm.notes}
                onChange={e => setPesajeForm({ ...pesajeForm, notes: e.target.value })}
                placeholder="Opcional..."
                className="w-full p-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div className="p-3 bg-stone-50 rounded-xl text-sm text-stone-600 flex items-center gap-3">
              <Scale className="w-4 h-4 text-stone-400 shrink-0" />
              <span>Peso actual: <strong>{pesajeTropa.currentWeight} kg/animal</strong></span>
              {pesajeNewWeight >= 50 && (
                <span className={`font-bold ${pesajeNewWeight > pesajeTropa.currentWeight ? 'text-emerald-600' : 'text-red-600'}`}>
                  → {pesajeNewWeight > pesajeTropa.currentWeight ? '+' : ''}{(pesajeNewWeight - pesajeTropa.currentWeight).toFixed(1)} kg
                </span>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Pasar a Terminación */}
      {isTerminacionOpen && terminacionTropaData && (
        <Modal
          title="Pasar a Terminación en Confinamiento"
          onClose={() => setIsTerminacionOpen(false)}
          onSave={saveTerminacion}
          isSubmitting={isSubmitting}
          saveLabel="Confirmar Ingreso"
          saveVariant="amber"
          error={modalError}
        >
          <div className="space-y-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="font-bold text-amber-900 mb-2">{terminacionTropaData.name}</p>
              <div className="grid grid-cols-2 gap-y-1 text-sm text-amber-800">
                <p><span className="font-medium">Disponibles:</span> {terminacionTropaData.quantity} animales</p>
                <p><span className="font-medium">Peso actual:</span> {terminacionTropaData.currentWeight} kg/an.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-bold text-stone-700">Cantidad a trasladar *</label>
                <input
                  type="number"
                  value={terminacionForm.quantity}
                  onChange={e => setTerminacionForm({ ...terminacionForm, quantity: e.target.value })}
                  min="1"
                  max={terminacionTropaData.quantity}
                  step="1"
                  className="w-full p-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                />
                <p className="text-xs text-stone-400">Máximo: {terminacionTropaData.quantity} animales</p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-bold text-stone-700">Peso promedio al traslado (kg/an.) *</label>
                <input
                  type="number"
                  value={terminacionForm.weight}
                  onChange={e => setTerminacionForm({ ...terminacionForm, weight: e.target.value })}
                  min="50"
                  step="0.1"
                  className="w-full p-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-sm font-bold text-stone-700">Nombre del nuevo grupo en Terminación</label>
                <input
                  type="text"
                  value={terminacionForm.newName}
                  onChange={e => setTerminacionForm({ ...terminacionForm, newName: e.target.value })}
                  className="w-full p-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
            </div>
            {tQty > 0 && tWeight >= 50 && (
              <div className="p-3 bg-stone-50 rounded-xl text-sm text-stone-600 space-y-1">
                {tQty < terminacionTropaData.quantity ? (
                  <p>Quedarán en recría: <strong>{terminacionTropaData.quantity - tQty} animales</strong></p>
                ) : (
                  <p className="text-amber-700 font-semibold">Se trasladarán todos los animales. El grupo de recría quedará vacío.</p>
                )}
                <p className="text-xs text-stone-400">La ración diaria se registra por separado para el nuevo grupo de terminación.</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Registrar Ración Diaria */}
      {isRacionOpen && racionTropa && (
        <Modal
          title={`Registrar Ración Diaria — ${racionTropa.name}`}
          onClose={() => setIsRacionOpen(false)}
          onSave={saveRacion}
          isSubmitting={isSubmitting}
          saveLabel="Guardar Ración"
          saveVariant="amber"
          error={modalError}
        >
          <div className="space-y-5">
            <div className="space-y-1">
              <label className="text-sm font-bold text-stone-700">Fecha *</label>
              <input
                type="date"
                value={racionForm.date}
                onChange={e => setRacionForm({ ...racionForm, date: e.target.value })}
                className="w-full p-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-bold text-stone-700 uppercase tracking-wider">Ingredientes — kg / animal / día</h4>

              {/* Silo picado de maíz */}
              <div className="p-4 bg-stone-50 rounded-xl space-y-2 border border-stone-100">
                <p className="text-sm font-bold text-stone-800">Silo Picado de Maíz</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-stone-500">kg / animal</label>
                    <input
                      type="number"
                      value={racionForm.siloMaiz}
                      onChange={e => setRacionForm({ ...racionForm, siloMaiz: e.target.value })}
                      min="0" step="0.1" placeholder="0"
                      className="w-full p-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-stone-500">Precio / kg ($)</label>
                    <input
                      type="number"
                      value={racionForm.precioSiloMaiz}
                      onChange={e => setRacionForm({ ...racionForm, precioSiloMaiz: e.target.value })}
                      min="0" step="0.01" placeholder="0"
                      className="w-full p-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Maíz partido */}
              <div className="p-4 bg-stone-50 rounded-xl space-y-2 border border-stone-100">
                <p className="text-sm font-bold text-stone-800">Maíz Partido</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-stone-500">kg / animal</label>
                    <input
                      type="number"
                      value={racionForm.maizPartido}
                      onChange={e => setRacionForm({ ...racionForm, maizPartido: e.target.value })}
                      min="0" step="0.1" placeholder="0"
                      className="w-full p-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-stone-500">Precio / kg ($)</label>
                    <input
                      type="number"
                      value={racionForm.precioMaizPartido}
                      onChange={e => setRacionForm({ ...racionForm, precioMaizPartido: e.target.value })}
                      min="0" step="0.01" placeholder="0"
                      className="w-full p-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Concentrado proteico pelleteado */}
              <div className="p-4 bg-stone-50 rounded-xl space-y-2 border border-stone-100">
                <p className="text-sm font-bold text-stone-800">Concentrado Proteico Pelleteado</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-stone-500">kg / animal</label>
                    <input
                      type="number"
                      value={racionForm.concentradoProteico}
                      onChange={e => setRacionForm({ ...racionForm, concentradoProteico: e.target.value })}
                      min="0" step="0.1" placeholder="0"
                      className="w-full p-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-stone-500">Precio / kg ($)</label>
                    <input
                      type="number"
                      value={racionForm.precioConcentrado}
                      onChange={e => setRacionForm({ ...racionForm, precioConcentrado: e.target.value })}
                      min="0" step="0.01" placeholder="0"
                      className="w-full p-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Summary */}
            {rTotalPerAnimal > 0 && (
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold text-stone-500 uppercase tracking-wider">Total kg / animal / día</p>
                  <p className="text-2xl font-bold text-amber-700">{rTotalPerAnimal.toFixed(1)} kg</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-stone-500 uppercase tracking-wider">Total herd / día ({racionTropa.quantity} an.)</p>
                  <p className="text-2xl font-bold text-amber-700">{(rTotalPerAnimal * racionTropa.quantity).toFixed(0)} kg</p>
                </div>
                {rCostPerAnimal > 0 && (
                  <>
                    <div>
                      <p className="text-xs font-bold text-stone-500 uppercase tracking-wider">Costo / animal / día</p>
                      <p className="text-xl font-bold text-stone-800">${rCostPerAnimal.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-stone-500 uppercase tracking-wider">Costo total / día</p>
                      <p className="text-xl font-bold text-stone-800">${(rCostPerAnimal * racionTropa.quantity).toFixed(2)}</p>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-sm font-bold text-stone-700">Notas</label>
              <input
                type="text"
                value={racionForm.notes}
                onChange={e => setRacionForm({ ...racionForm, notes: e.target.value })}
                placeholder="Opcional..."
                className="w-full p-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Registrar Venta / Faena */}
      {isVentaOpen && ventaTropa && (
        <Modal
          title={`Registrar Venta / Faena — ${ventaTropa.name}`}
          onClose={() => setIsVentaOpen(false)}
          onSave={saveVenta}
          isSubmitting={isSubmitting}
          saveLabel="Confirmar Venta"
          saveVariant="emerald"
          error={modalError}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-bold text-stone-700">Fecha *</label>
                <input
                  type="date"
                  value={ventaForm.date}
                  onChange={e => setVentaForm({ ...ventaForm, date: e.target.value })}
                  className="w-full p-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-bold text-stone-700">Cantidad a Vender *</label>
                <input
                  type="number"
                  value={ventaForm.quantity}
                  onChange={e => setVentaForm({ ...ventaForm, quantity: e.target.value })}
                  min="1"
                  max={ventaTropa.quantity}
                  step="1"
                  className="w-full p-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                <p className="text-xs text-stone-400">Disponibles: {ventaTropa.quantity} animales</p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-bold text-stone-700">Peso al Momento de Venta (kg/an.) *</label>
                <input
                  type="number"
                  value={ventaForm.weightAtSale}
                  onChange={e => setVentaForm({ ...ventaForm, weightAtSale: e.target.value })}
                  min="50"
                  step="0.1"
                  className="w-full p-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-bold text-stone-700">Precio por kg ($)</label>
                <input
                  type="number"
                  value={ventaForm.pricePerKg}
                  onChange={e => setVentaForm({ ...ventaForm, pricePerKg: e.target.value })}
                  min="0"
                  step="0.01"
                  placeholder="Opcional"
                  className="w-full p-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-sm font-bold text-stone-700">Notas</label>
                <input
                  type="text"
                  value={ventaForm.notes}
                  onChange={e => setVentaForm({ ...ventaForm, notes: e.target.value })}
                  placeholder="Destino, frigorífico, etc."
                  className="w-full p-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>

            {vQty > 0 && vWeight > 0 && (
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-bold text-stone-500 uppercase tracking-wider">Peso total vendido</p>
                    <p className="text-xl font-bold text-emerald-700">{(vQty * vWeight).toLocaleString()} kg</p>
                  </div>
                  {vPxKg > 0 && (
                    <div>
                      <p className="text-xs font-bold text-stone-500 uppercase tracking-wider">Ingreso estimado</p>
                      <p className="text-xl font-bold text-emerald-700">${vTotal.toLocaleString()}</p>
                    </div>
                  )}
                </div>
                {vQty >= ventaTropa.quantity && (
                  <div className="flex items-center gap-2 pt-2 border-t border-emerald-200">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <p className="text-xs font-semibold text-amber-700">Se venderán todos los animales. La tropa será eliminada del sistema.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Historial */}
      {isHistorialOpen && historialTropa && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-stone-100 flex justify-between items-center bg-stone-50/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-stone-900">Historial — {historialTropa.name}</h3>
                  <p className="text-xs text-stone-500">{historialTropa.sex} · {historialTropa.quantity} animales · {historialTropa.status}</p>
                </div>
              </div>
              <button onClick={() => setIsHistorialOpen(false)} className="p-2 hover:bg-stone-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-stone-400" />
              </button>
            </div>

            <div className="flex border-b border-stone-100 shrink-0">
              <button
                onClick={() => setHistorialTab('eventos')}
                className={`px-6 py-3 text-sm font-bold transition-colors border-b-2 ${historialTab === 'eventos' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-stone-400 hover:text-stone-600'}`}
              >
                Eventos ({(historialTropa.events || []).length})
              </button>
              <button
                onClick={() => setHistorialTab('raciones')}
                className={`px-6 py-3 text-sm font-bold transition-colors border-b-2 ${historialTab === 'raciones' ? 'border-amber-600 text-amber-600' : 'border-transparent text-stone-400 hover:text-stone-600'}`}
              >
                Raciones ({(historialTropa.raciones || []).length})
              </button>
            </div>

            {/* Date filter */}
            <div className="px-5 py-3 border-b border-stone-100 bg-stone-50/50 shrink-0 flex flex-wrap gap-3 items-center">
              <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Filtrar por fecha:</span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={historialDateFilter.from}
                  onChange={e => setHistorialDateFilter(f => ({ ...f, from: e.target.value }))}
                  className="p-1.5 text-xs border border-stone-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-xs text-stone-400">—</span>
                <input
                  type="date"
                  value={historialDateFilter.to}
                  onChange={e => setHistorialDateFilter(f => ({ ...f, to: e.target.value }))}
                  className="p-1.5 text-xs border border-stone-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              {(historialDateFilter.from || historialDateFilter.to) && (
                <button
                  onClick={() => setHistorialDateFilter({ from: '', to: '' })}
                  className="text-xs text-stone-400 hover:text-stone-600 flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Limpiar
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {historialTab === 'eventos' ? (() => {
                const allEvents = [...(historialTropa.events || [])].sort((a, b) => b.date.localeCompare(a.date));
                const filteredEvents = allEvents.filter(ev => {
                  if (historialDateFilter.from && ev.date < historialDateFilter.from) return false;
                  if (historialDateFilter.to && ev.date > historialDateFilter.to) return false;
                  return true;
                });
                return filteredEvents.length === 0 ? (
                  <div className="text-center py-8 text-stone-400">
                    <Activity className="w-10 h-10 mx-auto mb-2 opacity-20" />
                    <p>{allEvents.length === 0 ? 'Sin eventos registrados' : 'Sin eventos en el período seleccionado'}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredEvents.map(ev => (
                      <div key={ev.id} className="p-4 bg-stone-50 rounded-xl border border-stone-100">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="text-xs text-stone-400 font-medium">{ev.date}</p>
                            <p className="font-bold text-stone-800 mt-0.5">{ev.type}</p>
                            {ev.type === 'Compra' ? (
                              <div className="mt-1 text-sm text-stone-600 space-y-0.5">
                                {ev.quantity != null && <p>Cantidad ingresada: <strong>{ev.quantity} animales</strong></p>}
                                {ev.weightPerAnimal != null && <p>Peso promedio: <strong>{ev.weightPerAnimal} kg/an.</strong></p>}
                                {ev.description?.includes(' · ') && (
                                  <p>Origen: <strong>{ev.description.slice(ev.description.indexOf(' · ') + 3)}</strong></p>
                                )}
                              </div>
                            ) : (
                              <>
                                {ev.description && <p className="text-sm text-stone-600 mt-0.5">{ev.description}</p>}
                                {ev.weightPerAnimal && ev.type === 'Pesaje' && (
                                  <p className="text-sm font-bold text-blue-600 mt-1">{ev.weightPerAnimal} kg/animal</p>
                                )}
                              </>
                            )}
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                            ev.type === 'Pesaje' ? 'bg-blue-100 text-blue-700' :
                            ev.type === 'Medicación' ? 'bg-purple-100 text-purple-700' :
                            ev.type === 'Traslado' ? 'bg-amber-100 text-amber-700' :
                            ev.type === 'Control Veterinario' ? 'bg-pink-100 text-pink-700' :
                            ev.type === 'Baja' ? 'bg-red-100 text-red-700' :
                            ev.type === 'Compra' ? 'bg-emerald-100 text-emerald-700' :
                            'bg-stone-100 text-stone-600'
                          }`}>
                            {ev.type}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })() : (
                (historialTropa.raciones || []).length === 0 ? (
                  <div className="text-center py-8 text-stone-400">
                    <UtensilsCrossed className="w-10 h-10 mx-auto mb-2 opacity-20" />
                    <p>Sin raciones registradas</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(() => {
                      const allRaciones = [...(historialTropa.raciones || [])].sort((a, b) => b.date.localeCompare(a.date));
                      const filteredRaciones = allRaciones.filter(r => {
                        if (historialDateFilter.from && r.date < historialDateFilter.from) return false;
                        if (historialDateFilter.to && r.date > historialDateFilter.to) return false;
                        return true;
                      });
                      if (filteredRaciones.length === 0) {
                        return (
                          <div className="text-center py-8 text-stone-400">
                            <UtensilsCrossed className="w-10 h-10 mx-auto mb-2 opacity-20" />
                            <p>{allRaciones.length === 0 ? 'Sin raciones registradas' : 'Sin raciones en el período seleccionado'}</p>
                          </div>
                        );
                      }
                      return filteredRaciones.map(r => {
                        const total = r.siloMaiz + r.maizPartido + r.concentradoProteico;
                        const cost = getRacionCostPerAnimal(r);
                        return (
                          <div key={r.id} className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                            <p className="text-xs text-stone-500 font-medium mb-2">{r.date}</p>
                            <div className="grid grid-cols-3 gap-2 text-sm mb-2">
                              <div>
                                <p className="text-xs text-stone-500">Silo maíz</p>
                                <p className="font-bold text-stone-700">{r.siloMaiz} kg/an.</p>
                              </div>
                              <div>
                                <p className="text-xs text-stone-500">Maíz partido</p>
                                <p className="font-bold text-stone-700">{r.maizPartido} kg/an.</p>
                              </div>
                              <div>
                                <p className="text-xs text-stone-500">Concentrado</p>
                                <p className="font-bold text-stone-700">{r.concentradoProteico} kg/an.</p>
                              </div>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-amber-200">
                              <span className="text-sm font-bold text-stone-700">Total: {total.toFixed(1)} kg/an./día</span>
                              {cost > 0 && <span className="text-sm font-bold text-amber-700">${cost.toFixed(2)}/an./día</span>}
                            </div>
                            {r.notes && <p className="text-xs text-stone-500 mt-1">{r.notes}</p>}
                          </div>
                        );
                      });
                    })()}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* Registrar Baja */}
      {isBajaOpen && (() => {
        const tropa = tropas.find(t => t.id === bajaTropaId);
        if (!tropa) return null;
        const bajaQty = Number(bajaForm.quantity) || 0;
        return (
          <Modal
            title={`Registrar Baja — ${tropa.name}`}
            onClose={() => setIsBajaOpen(false)}
            onSave={saveBaja}
            isSubmitting={isSubmitting}
            saveLabel="Confirmar Baja"
            saveVariant="red"
            error={modalError}
            maxWidth="max-w-md"
          >
            <div className="space-y-4">
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>Registrá los animales fallecidos. Se descontarán del total de la tropa.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-bold text-stone-700">Fecha *</label>
                  <input
                    type="date"
                    value={bajaForm.date}
                    onChange={e => setBajaForm({ ...bajaForm, date: e.target.value })}
                    className="w-full p-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-bold text-stone-700">Cantidad de bajas *</label>
                  <input
                    type="number"
                    value={bajaForm.quantity}
                    onChange={e => setBajaForm({ ...bajaForm, quantity: e.target.value })}
                    min="1"
                    max={tropa.quantity}
                    step="1"
                    className="w-full p-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                  />
                  <p className="text-xs text-stone-400">Actuales: {tropa.quantity} animales</p>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-bold text-stone-700">Causa / Notas</label>
                <input
                  type="text"
                  value={bajaForm.notes}
                  onChange={e => setBajaForm({ ...bajaForm, notes: e.target.value })}
                  placeholder="Enfermedad, accidente, etc."
                  className="w-full p-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>
              {bajaQty > 0 && bajaQty <= tropa.quantity && (
                <div className="p-3 bg-stone-50 rounded-xl text-sm text-stone-600">
                  {bajaQty >= tropa.quantity
                    ? <span className="text-amber-700 font-semibold">Se eliminarán todos los animales. La tropa será eliminada.</span>
                    : <span>Quedarán <strong>{tropa.quantity - bajaQty} animales</strong> en la tropa.</span>
                  }
                </div>
              )}
            </div>
          </Modal>
        );
      })()}

      {/* Agregar Animales */}
      {isAgregarOpen && agregarTropaData && (
        <Modal
          title={`Agregar Animales — ${agregarTropaData.name}`}
          onClose={() => setIsAgregarOpen(false)}
          onSave={saveAgregar}
          isSubmitting={isSubmitting}
          saveLabel="Confirmar Ingreso"
          error={modalError}
          maxWidth="max-w-md"
        >
          <div className="space-y-4">
            <div className="p-3 bg-stone-50 rounded-xl text-sm text-stone-600 flex items-center gap-2">
              <Users className="w-4 h-4 text-stone-400 shrink-0" />
              <p>Actual: <strong>{agregarTropaData.quantity} animales</strong> · <strong>{agregarTropaData.currentWeight} kg/an.</strong> promedio</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-bold text-stone-700">Fecha de ingreso *</label>
                <input
                  type="date"
                  value={agregarForm.date}
                  onChange={e => setAgregarForm({ ...agregarForm, date: e.target.value })}
                  className="w-full p-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-bold text-stone-700">Cantidad a agregar *</label>
                <input
                  type="number"
                  value={agregarForm.quantity}
                  onChange={e => setAgregarForm({ ...agregarForm, quantity: e.target.value })}
                  min="1"
                  step="1"
                  placeholder="Ej: 50"
                  className="w-full p-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-bold text-stone-700">Peso promedio (kg/an.) *</label>
                <input
                  type="number"
                  value={agregarForm.weight}
                  onChange={e => setAgregarForm({ ...agregarForm, weight: e.target.value })}
                  min="50"
                  step="0.1"
                  placeholder="Ej: 200"
                  className="w-full p-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-bold text-stone-700">Notas</label>
                <input
                  type="text"
                  value={agregarForm.notes}
                  onChange={e => setAgregarForm({ ...agregarForm, notes: e.target.value })}
                  placeholder="Origen, lote, remito, etc."
                  className="w-full p-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>
            {aQty > 0 && aWeight >= 50 && (
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-stone-500 uppercase font-bold tracking-wider">Nuevo total</p>
                  <p className="text-xl font-bold text-stone-800">{aNewQty} animales</p>
                </div>
                <div>
                  <p className="text-xs text-stone-500 uppercase font-bold tracking-wider">Nuevo peso prom.</p>
                  <p className="text-xl font-bold text-stone-800">{aNewWeight} kg/an.</p>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Delete Confirm */}
      {isDeleteOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-stone-900 mb-2">Eliminar Tropa</h3>
            <p className="text-stone-500 text-sm mb-6">Esta acción eliminará la tropa con todos sus eventos y raciones. No se puede deshacer.</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={confirmDelete}
                disabled={isSubmitting}
                className="w-full py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Eliminando...' : 'Eliminar'}
              </button>
              <button
                onClick={() => { setIsDeleteOpen(false); setDeleteId(null); }}
                className="w-full py-2.5 text-stone-600 font-bold hover:bg-stone-100 rounded-xl"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
