import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, writeBatch } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError } from '../lib/errorHandlers';
import { Plus, Edit2, Trash2, Search, Activity, Scale, X, History, Syringe, TrendingUp, AlertCircle, AlertTriangle } from 'lucide-react';
import { Herd, HerdEvent, DietIngredient, DietPlan } from '../types';
import { validateHerdForm, validateDietForm, ValidationError } from '../lib/validators';
import { ValidationMessage, FieldError } from './ValidationMessage';
import { AdvancedFilters } from './AdvancedFilters';

interface GanaderiaModuleProps {
  farmId: string;
}

const SEXES = ['Macho', 'Hembra', 'Mixto'];
const STATUSES = ['Recría', 'Engorde'];
const STAGES = ['Iniciación', 'Crecimiento', 'Terminación'];
const INGREDIENTS = [
  { name: 'Maíz partido', type: 'Granos' },
  { name: 'Maíz entero', type: 'Granos' },
  { name: 'Sorgo', type: 'Granos' },
  { name: 'Concentrado proteico', type: 'Concentrados' },
  { name: 'Harina de soja', type: 'Concentrados' },
  { name: 'Alfalfa molida', type: 'Forrajes' },
  { name: 'Avena', type: 'Granos' }
];
const EVENT_TYPES = ['Medicación', 'Pesaje', 'Dieta', 'Control Veterinario', 'Otro'];

export default function GanaderiaModule({ farmId }: GanaderiaModuleProps) {
  const [herds, setHerds] = useState<Herd[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHerd, setEditingHerd] = useState<Herd | null>(null);
  const [modalMode, setModalMode] = useState<'view' | 'edit'>('view');
  const [modalTab, setModalTab] = useState<'details' | 'diet' | 'history'>('details');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedHerds, setSelectedHerds] = useState<string[]>([]);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [herdToDelete, setHerdToDelete] = useState<string | null>(null);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({
    status: [] as string[],
    weightRange: [50, 1000] as [number, number],
    sex: [] as string[],
    dateRange: ['', ''] as [string, string]
  });

  const [formData, setFormData] = useState({
    name: '',
    sex: 'Macho' as 'Macho' | 'Hembra' | 'Mixto',
    quantity: '',
    weightPerAnimal: '',
    status: 'Recría' as 'Recría' | 'Engorde',
    stage: 'Iniciación' as 'Iniciación' | 'Crecimiento' | 'Terminación',
    notes: '',
    events: [] as HerdEvent[]
  });

  const [dietForm, setDietForm] = useState({
    name: '',
    ingredients: [] as DietIngredient[]
  });

  const [newEvent, setNewEvent] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'Medicación' as HerdEvent['type'],
    description: ''
  });

  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<ValidationError[]>([]);
  const [showValidationErrors, setShowValidationErrors] = useState(false);

  // Un rodeo nuevo (editingHerd === null) siempre es editable; los existentes dependen de modalMode
  const isEditing = !editingHerd || modalMode === 'edit';

  useEffect(() => {
    if (!farmId) return;

    const herdsRef = collection(db, `farms/${farmId}/herds`);
    const q = query(herdsRef, orderBy('name', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const herdsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Herd[];
      setHerds(herdsData);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching herds:", error?.message || error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [farmId]);

  const handleOpenModal = (herd?: Herd, mode: 'view' | 'edit' = 'view') => {
    setModalMode(mode);
    setValidationErrors([]);
    setValidationWarnings([]);
    setShowValidationErrors(false);
    if (herd) {
      setEditingHerd(herd);
      setFormData({
        name: herd.name,
        sex: herd.sex,
        quantity: herd.quantity.toString(),
        weightPerAnimal: herd.weightPerAnimal.toString(),
        status: herd.status,
        stage: herd.stage || 'Iniciación',
        notes: herd.notes || '',
        events: herd.events || []
      });
      if (herd.feedingPlan) {
        setDietForm({
          name: herd.feedingPlan.name,
          ingredients: herd.feedingPlan.ingredients
        });
      }
      setModalTab('details');
    } else {
      setEditingHerd(null);
      setFormData({
        name: '',
        sex: 'Macho',
        quantity: '',
        weightPerAnimal: '',
        status: 'Recría',
        stage: 'Iniciación',
        notes: '',
        events: []
      });
      setDietForm({ name: '', ingredients: [] });
      setModalTab('details');
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingHerd(null);
    setValidationErrors([]);
    setValidationWarnings([]);
    setShowValidationErrors(false);
  };

  const validateForm = () => {
    setShowValidationErrors(true);
    const result = validateHerdForm({
      name: formData.name,
      quantity: formData.quantity,
      weightPerAnimal: formData.weightPerAnimal,
      status: formData.status
    });

    let allErrors = [...result.errors];
    let allWarnings = [...result.warnings];

    // Validar dieta si es engorde
    if (formData.status === 'Engorde' && dietForm.ingredients.length > 0) {
      const dietResult = validateDietForm({
        ingredients: dietForm.ingredients,
        quantity: Number(formData.quantity) || 1
      });

      allErrors = [...allErrors, ...dietResult.errors];
      allWarnings = [...allWarnings, ...dietResult.warnings];
    }

    setValidationErrors(allErrors);
    setValidationWarnings(allWarnings);

    return allErrors.length === 0;
  };

  const handleFormChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Solo validar en tiempo real si ya mostró errores antes
    if (showValidationErrors) {
      setTimeout(() => {
        const result = validateHerdForm({
          name: field === 'name' ? value : formData.name,
          quantity: field === 'quantity' ? value : formData.quantity,
          weightPerAnimal: field === 'weightPerAnimal' ? value : formData.weightPerAnimal,
          status: field === 'status' ? value : formData.status
        });

        setValidationErrors(result.errors);
        setValidationWarnings(result.warnings);
      }, 300);
    }
  };

  const calculateTotalWeight = (qty: number, weight: number) => qty * weight;

  const calculateDietCosts = (ingredients: DietIngredient[]) => {
    const totalKg = ingredients.reduce((sum, ing) => sum + ing.kg, 0);
    const totalPrice = ingredients.reduce((sum, ing) => sum + (ing.kg * ing.pricePerKg), 0);
    return { totalKg, totalPrice };
  };

  const handleAddEvent = () => {
    if (!newEvent.description) return;
    const event: HerdEvent = {
      id: Date.now().toString(),
      ...newEvent,
      type: newEvent.type as HerdEvent['type']
    };
    setFormData(prev => ({ ...prev, events: [event, ...prev.events] }));
    setNewEvent({
      date: new Date().toISOString().split('T')[0],
      type: 'Medicación',
      description: ''
    });
  };

  const handleRemoveEvent = (eventId: string) => {
    setFormData(prev => ({ ...prev, events: prev.events.filter(e => e.id !== eventId) }));
  };

  const handleAddDietIngredient = () => {
    setDietForm(prev => ({
      ...prev,
      ingredients: [...prev.ingredients, { type: '', kg: 0, pricePerKg: 0, totalPrice: 0 }]
    }));
  };

  const handleRemoveDietIngredient = (index: number) => {
    setDietForm(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index)
    }));
  };

  const handleUpdateDietIngredient = (index: number, field: keyof DietIngredient, value: any) => {
    setDietForm(prev => {
      const newIngredients = [...prev.ingredients];
      const ingredient = newIngredients[index];
      if (field === 'kg' || field === 'pricePerKg') {
        ingredient[field] = Number(value);
        ingredient.totalPrice = ingredient.kg * ingredient.pricePerKg;
      } else {
        ingredient[field] = value;
      }
      newIngredients[index] = ingredient;
      return { ...prev, ingredients: newIngredients };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditing) return;

    // Validar antes de guardar
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    const qty = Number(formData.quantity) || 0;
    const weightPer = Number(formData.weightPerAnimal) || 0;
    const totalWeight = calculateTotalWeight(qty, weightPer);

    const { totalKg, totalPrice } = calculateDietCosts(dietForm.ingredients);

    const herdData = {
      name: formData.name,
      sex: formData.sex,
      quantity: qty,
      weightPerAnimal: weightPer,
      totalWeight,
      status: formData.status,
      stage: formData.stage,
      notes: formData.notes,
      events: formData.events,
      feedingPlan: formData.status === 'Engorde' && dietForm.ingredients.length > 0 ? {
        id: editingHerd?.feedingPlan?.id || Date.now().toString(),
        herdId: editingHerd?.id || '',
        name: dietForm.name,
        ingredients: dietForm.ingredients,
        totalKgPerDay: totalKg,
        totalCostPerDay: totalPrice,
        createdAt: editingHerd?.feedingPlan?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } : undefined,
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingHerd) {
        await updateDoc(doc(db, `farms/${farmId}/herds`, editingHerd.id), herdData);
      } else {
        await addDoc(collection(db, `farms/${farmId}/herds`), {
          ...herdData,
          createdAt: new Date().toISOString()
        });
      }
      handleCloseModal();
    } catch (error) {
      handleFirestoreError(error, editingHerd ? 'update' : 'create', `farms/${farmId}/herds`, auth);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!herdToDelete) return;
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, `farms/${farmId}/herds`, herdToDelete));
      setIsConfirmDeleteOpen(false);
      setHerdToDelete(null);
    } catch (error) {
      handleFirestoreError(error, 'delete', `farms/${farmId}/herds/${herdToDelete}`, auth);
      setIsConfirmDeleteOpen(false);
      setHerdToDelete(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const applyFilters = (herdsToFilter: Herd[]) => {
    return herdsToFilter.filter(h => {
      // Búsqueda por nombre/sexo/estado
      const sTerm = (searchTerm || '').toLowerCase();
      const matchesSearch =
        (h.name || '').toLowerCase().includes(sTerm) ||
        (h.sex || '').toLowerCase().includes(sTerm) ||
        (h.status || '').toLowerCase().includes(sTerm);

      if (!matchesSearch) return false;

      // Filtro por estado
      if (filters.status.length > 0 && !filters.status.includes(h.status)) {
        return false;
      }

      // Filtro por sexo
      if (filters.sex.length > 0 && !filters.sex.includes(h.sex)) {
        return false;
      }

      // Filtro por rango de peso
      const weight = h.weightPerAnimal;
      if (weight < filters.weightRange[0] || weight > filters.weightRange[1]) {
        return false;
      }

      // Filtro por fecha de creación
      if (filters.dateRange[0] || filters.dateRange[1]) {
        const createdDate = new Date(h.createdAt).toISOString().split('T')[0];
        if (filters.dateRange[0] && createdDate < filters.dateRange[0]) return false;
        if (filters.dateRange[1] && createdDate > filters.dateRange[1]) return false;
      }

      return true;
    });
  };

  const filteredHerds = applyFilters(herds);

  const totalAnimals = herds.reduce((sum, h) => sum + (h.quantity || 0), 0);
  const totalWeight = herds.reduce((sum, h) => sum + (h.totalWeight || 0), 0);
  const engordoHerds = herds.filter(h => h.status === 'Engorde').length;

  if (isLoading) {
    return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div></div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex items-center space-x-5">
          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl">
            <Activity className="w-7 h-7" />
          </div>
          <div>
            <p className="text-sm text-stone-500 font-medium uppercase tracking-wider">Total Rodeos</p>
            <p className="text-3xl font-bold text-stone-900">{herds.length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex items-center space-x-5">
          <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl">
            <Scale className="w-7 h-7" />
          </div>
          <div>
            <p className="text-sm text-stone-500 font-medium uppercase tracking-wider">Total Animales</p>
            <p className="text-3xl font-bold text-stone-900">{totalAnimals}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex items-center space-x-5">
          <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl">
            <TrendingUp className="w-7 h-7" />
          </div>
          <div>
            <p className="text-sm text-stone-500 font-medium uppercase tracking-wider">Peso Total (kg)</p>
            <p className="text-3xl font-bold text-stone-900">{totalWeight.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex items-center space-x-5">
          <div className="p-4 bg-purple-50 text-purple-600 rounded-2xl">
            <Syringe className="w-7 h-7" />
          </div>
          <div>
            <p className="text-sm text-stone-500 font-medium uppercase tracking-wider">En Engorde</p>
            <p className="text-3xl font-bold text-stone-900">{engordoHerds}</p>
          </div>
        </div>
      </div>

      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
          <input
            type="text"
            placeholder="Buscar rodeo por nombre, sexo o estado..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
          />
        </div>
        <button
          onClick={() => handleOpenModal(undefined, 'edit')}
          className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Nuevo Rodeo</span>
        </button>
      </div>

      {/* Advanced Filters */}
      <AdvancedFilters
        isOpen={isFiltersOpen}
        onToggle={() => setIsFiltersOpen(!isFiltersOpen)}
        filters={filters}
        onFiltersChange={setFilters}
        onReset={() => setFilters({ status: [], weightRange: [50, 1000], sex: [], dateRange: ['', ''] })}
      />

      {selectedHerds.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-center justify-between shadow-sm">
          <span className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {selectedHerds.length} rodeos seleccionados
          </span>
          <button
            onClick={() => setSelectedHerds([])}
            className="bg-stone-200 hover:bg-stone-300 text-stone-700 px-4 py-1.5 rounded-lg text-sm font-bold transition-colors"
          >
            Deshacer
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 text-sm">
                <th className="p-4">
                  <input
                    type="checkbox"
                    checked={selectedHerds.length === filteredHerds.length && filteredHerds.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedHerds(filteredHerds.map(h => h.id));
                      } else {
                        setSelectedHerds([]);
                      }
                    }}
                  />
                </th>
                <th className="p-4 font-medium">Nombre</th>
                <th className="p-4 font-medium">Sexo</th>
                <th className="p-4 font-medium">Cantidad</th>
                <th className="p-4 font-medium">Peso Prom./Animal (kg)</th>
                <th className="p-4 font-medium">Peso Total (kg)</th>
                <th className="p-4 font-medium">Estado</th>
                <th className="p-4 font-medium">Etapa</th>
                <th className="p-4 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {filteredHerds.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-stone-500">
                    No se encontraron rodeos.
                  </td>
                </tr>
              ) : (
                filteredHerds.map((herd) => (
                  <tr key={herd.id} className="hover:bg-stone-50 transition-colors">
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={selectedHerds.includes(herd.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedHerds([...selectedHerds, herd.id]);
                          } else {
                            setSelectedHerds(selectedHerds.filter(id => id !== herd.id));
                          }
                        }}
                      />
                    </td>
                    <td className="p-4 font-medium text-stone-800">{herd.name}</td>
                    <td className="p-4 text-stone-600">{herd.sex}</td>
                    <td className="p-4 text-stone-600">{herd.quantity}</td>
                    <td className="p-4 text-stone-600">{herd.weightPerAnimal}</td>
                    <td className="p-4 text-stone-600 font-medium">{herd.totalWeight.toLocaleString()}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        herd.status === 'Recría' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
                      }`}>
                        {herd.status}
                      </span>
                    </td>
                    <td className="p-4 text-stone-600">{herd.stage || '-'}</td>
                    <td className="p-4 text-right space-x-2">
                      <button
                        onClick={() => handleOpenModal(herd, 'view')}
                        className="p-2 text-stone-400 hover:text-emerald-600 transition-colors"
                        title="Ver"
                      >
                        <Activity className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleOpenModal(herd, 'edit')}
                        className="p-2 text-stone-400 hover:text-emerald-600 transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setHerdToDelete(herd.id);
                          setIsConfirmDeleteOpen(true);
                        }}
                        className="p-2 text-stone-400 hover:text-red-600 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl p-0 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-stone-900">
                    {editingHerd ? `Rodeo: ${editingHerd.name}` : 'Nuevo Rodeo'}
                  </h3>
                  <p className="text-sm text-stone-500">
                    {isEditing ? 'Edición' : 'Visualización'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-stone-200 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-stone-400" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-stone-100 bg-white">
              <button
                onClick={() => setModalTab('details')}
                className={`px-6 py-3 text-sm font-bold transition-colors border-b-2 ${
                  modalTab === 'details' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-stone-400 hover:text-stone-600'
                }`}
              >
                Detalles
              </button>
              {formData.status === 'Engorde' && (
                <button
                  onClick={() => setModalTab('diet')}
                  className={`px-6 py-3 text-sm font-bold transition-colors border-b-2 ${
                    modalTab === 'diet' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-stone-400 hover:text-stone-600'
                  }`}
                >
                  Dieta
                </button>
              )}
              <button
                onClick={() => setModalTab('history')}
                className={`px-6 py-3 text-sm font-bold transition-colors border-b-2 ${
                  modalTab === 'history' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-stone-400 hover:text-stone-600'
                }`}
              >
                Historial
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-white">
              {modalTab === 'details' ? (
                <form id="herd-form" onSubmit={handleSubmit}>
                  {validationErrors.length > 0 && (
                    <div className="mb-6">
                      <ValidationMessage
                        errors={validationErrors.map(e => ({ message: e.message, type: e.type }))}
                        warnings={validationWarnings.map(w => ({ message: w.message, type: w.type }))}
                        compact={true}
                      />
                    </div>
                  )}

                  <fieldset disabled={!isEditing} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-stone-700">Nombre del Rodeo</label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => handleFormChange('name', e.target.value)}
                        className={`w-full p-2.5 border rounded-xl focus:ring-2 outline-none transition-all disabled:bg-stone-50 ${
                          validationErrors.some(e => e.field === 'name')
                            ? 'border-red-300 focus:ring-red-500'
                            : 'border-stone-200 focus:ring-emerald-500'
                        }`}
                        placeholder="Ej: Rodeo A"
                      />
                      <FieldError
                        error={validationErrors.find(e => e.field === 'name')?.message}
                        warning={validationWarnings.find(w => w.field === 'name')?.message}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-stone-700">Sexo</label>
                      <select
                        value={formData.sex}
                        onChange={(e) => setFormData({ ...formData, sex: e.target.value as any })}
                        className="w-full p-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all disabled:bg-stone-50"
                      >
                        {SEXES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-stone-700">Cantidad de Animales</label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={formData.quantity}
                        onChange={(e) => handleFormChange('quantity', e.target.value)}
                        className={`w-full p-2.5 border rounded-xl focus:ring-2 outline-none transition-all disabled:bg-stone-50 ${
                          validationErrors.some(e => e.field === 'quantity')
                            ? 'border-red-300 focus:ring-red-500'
                            : 'border-stone-200 focus:ring-emerald-500'
                        }`}
                      />
                      <FieldError
                        error={validationErrors.find(e => e.field === 'quantity')?.message}
                        warning={validationWarnings.find(w => w.field === 'quantity')?.message}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-stone-700">Peso Promedio por Animal (kg)</label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={formData.weightPerAnimal}
                        onChange={(e) => handleFormChange('weightPerAnimal', e.target.value)}
                        className={`w-full p-2.5 border rounded-xl focus:ring-2 outline-none transition-all disabled:bg-stone-50 ${
                          validationErrors.some(e => e.field === 'weightPerAnimal')
                            ? 'border-red-300 focus:ring-red-500'
                            : 'border-stone-200 focus:ring-emerald-500'
                        }`}
                      />
                      <FieldError
                        error={validationErrors.find(e => e.field === 'weightPerAnimal')?.message}
                        warning={validationWarnings.find(w => w.field === 'weightPerAnimal')?.message}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-stone-700">Estado</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                        className="w-full p-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all disabled:bg-stone-50"
                      >
                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    {formData.status === 'Engorde' && (
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-stone-700">Etapa</label>
                        <select
                          value={formData.stage}
                          onChange={(e) => setFormData({ ...formData, stage: e.target.value as any })}
                          className="w-full p-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all disabled:bg-stone-50"
                        >
                          {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    )}
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-bold text-stone-700">Notas</label>
                      <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        className="w-full p-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none h-24 resize-none transition-all disabled:bg-stone-50"
                        placeholder="Información adicional..."
                      />
                    </div>
                    {isEditing && (
                      <div className="md:col-span-2 p-4 bg-stone-50 rounded-xl">
                        <p className="text-sm text-stone-600">
                          <strong>Peso Total:</strong> {calculateTotalWeight(Number(formData.quantity) || 0, Number(formData.weightPerAnimal) || 0).toLocaleString()} kg
                        </p>
                      </div>
                    )}
                  </fieldset>
                </form>
              ) : modalTab === 'diet' ? (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-stone-700">Nombre de la Dieta</label>
                      <input
                        type="text"
                        disabled={!isEditing}
                        value={dietForm.name}
                        onChange={(e) => setDietForm({ ...dietForm, name: e.target.value })}
                        className="w-full p-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none disabled:bg-stone-50"
                        placeholder="Ej: Dieta Terminación"
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <h4 className="font-bold text-stone-800">Insumos</h4>
                        {isEditing && (
                          <button
                            type="button"
                            onClick={handleAddDietIngredient}
                            className="text-emerald-600 hover:text-emerald-700 font-medium text-sm"
                          >
                            + Agregar Insumo
                          </button>
                        )}
                      </div>

                      {dietForm.ingredients.length === 0 ? (
                        <p className="text-stone-400 text-sm">Sin insumos registrados</p>
                      ) : (
                        <div className="space-y-3">
                          {dietForm.ingredients.map((ing, idx) => (
                            <div key={idx} className="grid grid-cols-4 gap-2 p-3 bg-stone-50 rounded-lg">
                              <input
                                type="text"
                                disabled={!isEditing}
                                list="ingredients-list"
                                value={ing.type}
                                onChange={(e) => handleUpdateDietIngredient(idx, 'type', e.target.value)}
                                placeholder="Tipo"
                                className="p-2 border rounded disabled:bg-stone-100"
                              />
                              <input
                                type="number"
                                disabled={!isEditing}
                                value={ing.kg}
                                onChange={(e) => handleUpdateDietIngredient(idx, 'kg', e.target.value)}
                                placeholder="kg"
                                min="0"
                                step="0.1"
                                className="p-2 border rounded disabled:bg-stone-100"
                              />
                              <input
                                type="number"
                                disabled={!isEditing}
                                value={ing.pricePerKg}
                                onChange={(e) => handleUpdateDietIngredient(idx, 'pricePerKg', e.target.value)}
                                placeholder="Precio/kg"
                                min="0"
                                step="0.01"
                                className="p-2 border rounded disabled:bg-stone-100"
                              />
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-bold text-stone-700">${ing.totalPrice.toFixed(2)}</span>
                                {isEditing && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveDietIngredient(idx)}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {dietForm.ingredients.length > 0 && (
                        <div className="mt-4 p-4 bg-emerald-50 rounded-lg border border-emerald-100">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-stone-600 uppercase font-bold">Total kg/día</p>
                              <p className="text-2xl font-bold text-emerald-700">
                                {calculateDietCosts(dietForm.ingredients).totalKg.toFixed(2)} kg
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-stone-600 uppercase font-bold">Costo/día</p>
                              <p className="text-2xl font-bold text-emerald-700">
                                ${calculateDietCosts(dietForm.ingredients).totalPrice.toFixed(2)}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {isEditing && (
                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                      <h4 className="text-sm font-bold text-emerald-800 mb-3 uppercase tracking-wider flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        Registrar Evento
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <input
                          type="date"
                          value={newEvent.date}
                          onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                          className="p-2.5 border border-stone-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <select
                          value={newEvent.type}
                          onChange={(e) => setNewEvent({ ...newEvent, type: e.target.value as any })}
                          className="p-2.5 border border-stone-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Descripción..."
                            value={newEvent.description}
                            onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                            className="flex-1 p-2.5 border border-stone-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                          <button
                            type="button"
                            onClick={handleAddEvent}
                            className="bg-emerald-600 text-white p-2.5 rounded-xl hover:bg-emerald-700"
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-stone-800 uppercase tracking-wider flex items-center gap-2">
                      <History className="w-4 h-4" />
                      Eventos Registrados
                    </h4>
                    {formData.events.length === 0 ? (
                      <div className="text-center py-12 text-stone-400 border-2 border-dashed border-stone-100 rounded-2xl">
                        <Activity className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p className="font-medium">Sin eventos</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {formData.events.sort((a, b) => b.date.localeCompare(a.date)).map((event) => (
                          <div key={event.id} className="p-4 bg-stone-50 rounded-lg border border-stone-100">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <p className="text-xs text-stone-500 uppercase font-bold">{event.date}</p>
                                <p className="font-bold text-stone-800">{event.type}</p>
                                <p className="text-sm text-stone-600">{event.description}</p>
                              </div>
                              {isEditing && (
                                <button
                                  onClick={() => handleRemoveEvent(event.id)}
                                  className="text-red-600 hover:text-red-700 p-1"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-stone-100 flex justify-end gap-3 bg-stone-50/50">
              <button
                onClick={handleCloseModal}
                className="px-6 py-2.5 text-stone-600 font-bold hover:bg-stone-200 rounded-xl transition-all"
              >
                {!isEditing ? 'Cerrar' : 'Cancelar'}
              </button>
              {isEditing && (
                <div className="flex items-center gap-2">
                  {validationErrors.length > 0 && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-red-50 rounded-lg">
                      <AlertCircle className="w-4 h-4 text-red-600" />
                      <span className="text-xs font-bold text-red-600">{validationErrors.length} error{validationErrors.length > 1 ? 'es' : ''}</span>
                    </div>
                  )}
                  <button
                    type="submit"
                    form="herd-form"
                    disabled={isSubmitting || validationErrors.length > 0}
                    className={`px-10 py-2.5 font-bold rounded-xl transition-all ${
                      validationErrors.length > 0
                        ? 'bg-stone-300 text-stone-500 cursor-not-allowed'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    } disabled:opacity-50`}
                  >
                    {isSubmitting ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {isConfirmDeleteOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-stone-900 mb-2 text-center">Confirmar eliminación</h3>
            <p className="text-stone-600 mb-6 text-center">
              ¿Estás seguro de eliminar este rodeo?
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={confirmDelete}
                className="w-full py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700"
              >
                Eliminar
              </button>
              <button
                onClick={() => setIsConfirmDeleteOpen(false)}
                className="w-full py-2.5 text-stone-600 font-bold hover:bg-stone-100 rounded-xl"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <datalist id="ingredients-list">
        {INGREDIENTS.map(ing => <option key={ing.name} value={ing.name} />)}
      </datalist>
    </div>
  );
}
