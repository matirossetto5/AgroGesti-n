import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError } from '../lib/errorHandlers';
import { Plus, Edit2, Trash2, Receipt, X, Filter } from 'lucide-react';

interface IncomeRecord {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
}

interface IngresosModuleProps {
  farmId: string;
}

const CATEGORIES = ['Venta de ganado', 'Venta de granos', 'Servicios', 'Otro'];

export default function IngresosModule({ farmId }: IngresosModuleProps) {
  const [incomes, setIncomes] = useState<IncomeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    category: CATEGORIES[0],
    description: '',
    amount: '',
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  // List filters
  const [filterCategory, setFilterCategory] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    const q = query(collection(db, 'farms', farmId, 'incomes'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedIncomes: IncomeRecord[] = [];
      snapshot.forEach((doc) => {
        loadedIncomes.push({ id: doc.id, ...doc.data() } as IncomeRecord);
      });
      setIncomes(loadedIncomes);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [farmId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    const incomeData = {
      date: formData.date,
      category: formData.category,
      description: formData.description,
      amount: parseFloat(formData.amount) || 0,
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, 'farms', farmId, 'incomes', editingId), incomeData);
      } else {
        await addDoc(collection(db, 'farms', farmId, 'incomes'), incomeData);
      }
      setIsModalOpen(false);
      setFormData({ date: new Date().toISOString().split('T')[0], category: CATEGORIES[0], description: '', amount: '' });
      setEditingId(null);
    } catch (error) {
      handleFirestoreError(error, editingId ? 'update' : 'create', `farms/${farmId}/incomes`, auth);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, 'farms', farmId, 'incomes', itemToDelete));
      setItemToDelete(null);
    } catch (error) {
      handleFirestoreError(error, 'delete', `farms/${farmId}/incomes/${itemToDelete}`, auth);
      setItemToDelete(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasActiveFilters = filterCategory !== '' || filterFrom !== '' || filterTo !== '';

  const filteredIncomes = incomes.filter(inc => {
    if (filterCategory && inc.category !== filterCategory) return false;
    if (filterFrom && inc.date < filterFrom) return false;
    if (filterTo && inc.date > filterTo) return false;
    return true;
  });

  const totalIncomes = incomes.reduce((sum, inc) => sum + inc.amount, 0);
  const byCategory = CATEGORIES.map(cat => {
    const total = incomes.filter(i => i.category === cat).reduce((s, i) => s + i.amount, 0);
    return { cat, total, pct: totalIncomes > 0 ? (total / totalIncomes) * 100 : 0 };
  }).filter(c => c.total > 0).sort((a, b) => b.total - a.total);

  const CAT_COLORS: Record<string, string> = {
    'Venta de ganado': 'bg-emerald-500',
    'Venta de granos': 'bg-amber-500',
    'Servicios': 'bg-blue-500',
    'Otro': 'bg-stone-400',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-stone-900 tracking-tight">Gestión de Ingresos</h2>
          <p className="text-stone-500 text-sm">Control de ventas y otros ingresos del campo</p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setFormData({ date: new Date().toISOString().split('T')[0], category: CATEGORIES[0], description: '', amount: '' });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2.5 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 active:scale-95"
        >
          <Plus className="w-5 h-5" /> Nuevo Ingreso
        </button>
      </div>

      {/* Resumen por categoría */}
      {byCategory.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {byCategory.map(({ cat, total, pct }) => (
            <div key={cat} className="bg-white rounded-2xl border border-stone-200 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-2.5 h-2.5 rounded-full ${CAT_COLORS[cat] ?? 'bg-stone-400'}`} />
                <span className="text-xs font-bold text-stone-500 truncate">{cat}</span>
              </div>
              <p className="text-base font-black text-stone-900">
                $ {total.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
              </p>
              <div className="mt-2 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                <div className={`h-full ${CAT_COLORS[cat] ?? 'bg-stone-400'} rounded-full`} style={{ width: `${pct}%` }} />
              </div>
              <p className="text-[10px] text-stone-400 font-bold mt-1">{pct.toFixed(1)}% del total</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="space-y-3">
        <button
          onClick={() => setShowFilters(f => !f)}
          className="flex items-center gap-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-lg transition-colors text-sm"
        >
          <Filter className="w-4 h-4" />
          Filtros
          {hasActiveFilters && (
            <span className="ml-1 px-2 py-0.5 bg-emerald-500 text-white text-xs rounded-full font-bold">Activo</span>
          )}
        </button>

        {showFilters && (
          <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-sm flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-600 uppercase tracking-wider">Categoría</label>
              <select
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
                className="p-2 border border-stone-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Todas</option>
                {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-600 uppercase tracking-wider">Desde</label>
              <input
                type="date"
                value={filterFrom}
                onChange={e => setFilterFrom(e.target.value)}
                className="p-2 border border-stone-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-600 uppercase tracking-wider">Hasta</label>
              <input
                type="date"
                value={filterTo}
                onChange={e => setFilterTo(e.target.value)}
                className="p-2 border border-stone-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            {hasActiveFilters && (
              <button
                onClick={() => { setFilterCategory(''); setFilterFrom(''); setFilterTo(''); }}
                className="flex items-center gap-1 px-3 py-2 text-sm text-stone-500 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors font-medium"
              >
                <X className="w-3.5 h-3.5" /> Limpiar
              </button>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-stone-50/50 border-b border-stone-200">
              <tr className="text-stone-500 text-sm font-bold uppercase tracking-wider">
                <th className="p-4">Fecha</th>
                <th className="p-4">Categoría</th>
                <th className="p-4">Descripción</th>
                <th className="p-4 text-right">Monto</th>
                <th className="p-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {isLoading ? (
                <tr><td colSpan={5} className="p-12 text-center text-stone-400">Cargando ingresos...</td></tr>
              ) : filteredIncomes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-stone-400 italic">
                      <Receipt className="w-12 h-12 opacity-20" />
                      <p>{incomes.length === 0 ? 'No hay ingresos registrados aún' : 'Sin resultados para los filtros aplicados'}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredIncomes.map(income => (
                  <tr key={income.id} className="hover:bg-emerald-50/30 transition-colors group">
                    <td className="p-4 text-stone-600 font-medium">
                      {new Date(income.date).toLocaleDateString('es-AR', { timeZone: 'UTC' })}
                    </td>
                    <td className="p-4">
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 whitespace-nowrap">
                        {income.category}
                      </span>
                    </td>
                    <td className="p-4 font-semibold text-stone-800">{income.description}</td>
                    <td className="p-4 font-bold text-emerald-600 text-right text-lg">
                      $ {income.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => {
                            setEditingId(income.id);
                            setFormData({ date: income.date, category: income.category, description: income.description, amount: income.amount.toString() });
                            setIsModalOpen(true);
                          }}
                          className="p-2 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setItemToDelete(income.id)}
                          className="p-2 text-stone-400 hover:text-red-700 hover:bg-red-50 rounded-xl transition-all"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredIncomes.length > 0 && (
              <tfoot className="bg-emerald-50/50">
                <tr>
                  <td colSpan={3} className="p-4 text-right font-bold text-stone-600">
                    {hasActiveFilters ? 'Total filtrado:' : 'Total Ingresos:'}
                  </td>
                  <td className="p-4 text-right font-black text-emerald-700 text-xl whitespace-nowrap">
                    $ {filteredIncomes.reduce((sum, inc) => sum + inc.amount, 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {itemToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-stone-900 mb-2">Confirmar eliminación</h3>
            <p className="text-stone-600 mb-6">¿Estás seguro de que deseas eliminar este ingreso? Esta acción no se puede deshacer.</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={confirmDelete}
                className="w-full py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-100"
              >
                Sí, eliminar definitivamente
              </button>
              <button
                onClick={() => setItemToDelete(null)}
                className="w-full py-2.5 text-stone-600 font-bold hover:bg-stone-100 rounded-xl transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSubmit} className="bg-white p-8 rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-stone-900">{editingId ? 'Editar' : 'Nuevo'} Ingreso</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-stone-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-stone-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-stone-700 mb-1">Fecha</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                  className="w-full p-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-stone-700 mb-1">Categoría</label>
                <select
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  className="w-full p-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                >
                  {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-stone-700 mb-1">Descripción</label>
                <input
                  type="text"
                  placeholder="Ej: Venta de lotes vacas"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-stone-700 mb-1">Monto ($)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full pl-8 pr-4 py-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-emerald-700"
                    required
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-8 bg-emerald-600 text-white font-black py-4 rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 active:scale-95 uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Guardando...' : (editingId ? 'Actualizar Ingreso' : 'Guardar Ingreso')}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
