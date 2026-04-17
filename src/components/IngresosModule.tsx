import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Plus, Edit2, Trash2, Receipt, DollarSign, X } from 'lucide-react';

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
  const [formData, setFormData] = useState({ date: new Date().toISOString().split('T')[0], category: CATEGORIES[0], description: '', amount: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

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
    const incomeData = {
      date: formData.date,
      category: formData.category,
      description: formData.description,
      amount: parseFloat(formData.amount)
    };

    if (editingId) {
      await updateDoc(doc(db, 'farms', farmId, 'incomes', editingId), incomeData);
    } else {
      await addDoc(collection(db, 'farms', farmId, 'incomes'), incomeData);
    }
    setIsModalOpen(false);
    setFormData({ date: '', category: CATEGORIES[0], description: '', amount: '' });
    setEditingId(null);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDoc(doc(db, 'farms', farmId, 'incomes', itemToDelete));
      setItemToDelete(null);
    } catch (error) {
      console.error("Error deleting income:", error);
      setItemToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-stone-900 tracking-tight">Gestión de Ingresos</h2>
          <p className="text-stone-500 text-sm">Control de ventas y otros ingresos del campo</p>
        </div>
        <button 
          onClick={() => { setEditingId(null); setFormData({ date: new Date().toISOString().split('T')[0], category: CATEGORIES[0], description: '', amount: '' }); setIsModalOpen(true); }}
          className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2.5 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 active:scale-95"
        >
          <Plus className="w-5 h-5" /> Nuevo Ingreso
        </button>
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
              ) : incomes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-stone-400 italic">
                      <Receipt className="w-12 h-12 opacity-20" />
                      <p>No hay ingresos registrados aún</p>
                    </div>
                  </td>
                </tr>
              ) : (
                incomes.map(income => (
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
                          onClick={() => { setEditingId(income.id); setFormData({ date: income.date, category: income.category, description: income.description, amount: income.amount.toString() }); setIsModalOpen(true); }} 
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
            {incomes.length > 0 && (
              <tfoot className="bg-emerald-50/50">
                <tr>
                  <td colSpan={3} className="p-4 text-right font-bold text-stone-600">Total Ingresos:</td>
                  <td className="p-4 text-right font-black text-emerald-700 text-xl whitespace-nowrap">
                    $ {incomes.reduce((sum, inc) => sum + inc.amount, 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
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
          <form onSubmit={handleSubmit} className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
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
                  onChange={e => setFormData({...formData, date: e.target.value})} 
                  className="w-full p-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all" 
                  required 
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-stone-700 mb-1">Categoría</label>
                <select 
                  value={formData.category} 
                  onChange={e => setFormData({...formData, category: e.target.value})} 
                  className="w-full p-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                >
                  {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-stone-700 mb-1">Descripción</label>
                <input 
                  type="text" 
                  placeholder="Ej: Venta de trigo" 
                  value={formData.description} 
                  onChange={e => setFormData({...formData, description: e.target.value})} 
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
                    onChange={e => setFormData({...formData, amount: e.target.value})} 
                    className="w-full pl-8 pr-4 py-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-emerald-700" 
                    required 
                  />
                </div>
              </div>
            </div>

            <button 
              type="submit" 
              className="w-full mt-8 bg-emerald-600 text-white font-bold py-3 rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 active:scale-95"
            >
              Guardar Ingreso
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
