import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, writeBatch } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError } from '../lib/errorHandlers';
import { Plus, Edit2, Trash2, Search, Tag, Activity, Scale, X, History, Syringe, TrendingUp, AlertCircle } from 'lucide-react';

interface UnifiedEvent {
  id: string;
  date: string;
  type: 'Medicación' | 'Variación de Peso' | 'Control Veterinario' | 'Ración' | 'Otro';
  description?: string;
  ingredients?: { type: string; amount: number }[];
  totalAmount?: number;
}

interface Animal {
  id: string;
  tagNumber: string;
  category: string;
  breed: string;
  weight: number;
  birthDate: string;
  status: string;
  notes: string;
  batch?: string;
  events?: UnifiedEvent[];
}

interface GanaderiaModuleProps {
  farmId: string;
}

const CATEGORIES = ['Vaca', 'Toro', 'Novillo', 'Vaquillona', 'Ternero', 'Ternera'];
const BREEDS = ['Angus', 'Hereford', 'Braford', 'Brangus', 'Holando', 'Cruza', 'Otro'];
const STATUSES = ['Activo', 'Vendido', 'Muerto', 'Enfermo'];
const EVENT_TYPES = ['Medicación', 'Variación de Peso', 'Control Veterinario', 'Ración', 'Otro'];

const updateCategory = (category: string, weight: number) => {
  if (weight > 300) {
    if (category === 'Ternero') return 'Novillo';
    if (category === 'Ternera') return 'Vaquillona';
  }
  return category;
};

export default function GanaderiaModule({ farmId }: GanaderiaModuleProps) {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAnimal, setEditingAnimal] = useState<Animal | null>(null);
  const [modalMode, setModalMode] = useState<'view' | 'edit'>('view');
  const [modalTab, setModalTab] = useState<'details' | 'history'>('details');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedAnimals, setSelectedAnimals] = useState<string[]>([]);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isBatchCreateModalOpen, setIsBatchCreateModalOpen] = useState(false);
  const [batchAnimals, setBatchAnimals] = useState<Partial<Animal>[]>([]);
  const [batchActionType, setBatchActionType] = useState<'rations' | 'pesajes' | 'medicacion' | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const [batchActionInputs, setBatchActionInputs] = useState<Record<string, any>>({});
  const [selectedAnimalsForAction, setSelectedAnimalsForAction] = useState<Animal[]>([]);
  const [isConfirmationStep, setIsConfirmationStep] = useState(false);
  const INGREDIENTS = ['Maíz partido', 'Maíz entero', 'Sorgo', 'Maíz picado', 'Concentrado proteico'];
  
  const [formData, setFormData] = useState({
    tagNumber: '',
    category: 'Vaca',
    breed: 'Angus',
    weight: '',
    birthDate: '',
    status: 'Activo',
    notes: '',
    batch: '',
    events: [] as UnifiedEvent[]
  });

  const [newEvent, setNewEvent] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'Medicación',
    description: ''
  });

  const [newRation, setNewRation] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'Maíz',
    amount: 0
  });

  useEffect(() => {
    if (!farmId) return;

    const animalsRef = collection(db, `farms/${farmId}/animals`);
    const q = query(animalsRef, orderBy('tagNumber', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const animalsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Animal[];
      setAnimals(animalsData);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching animals:", error?.message || error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [farmId]);

  const handleOpenModal = (animal?: Animal, mode: 'view' | 'edit' = 'view') => {
    setModalMode(mode);
    if (animal) {
      setEditingAnimal(animal);
      setFormData({
        tagNumber: animal.tagNumber,
        category: animal.category,
        breed: animal.breed,
        weight: animal.weight.toString(),
        birthDate: animal.birthDate,
        status: animal.status,
        notes: animal.notes || '',
        batch: animal.batch || '',
        events: animal.events || []
      });
      setModalTab('details');
    } else {
      setEditingAnimal(null);
      setFormData({
        tagNumber: '',
        category: 'Vaca',
        breed: 'Angus',
        weight: '',
        birthDate: new Date().toISOString().split('T')[0],
        status: 'Activo',
        notes: '',
        batch: '',
        events: []
      });
      setModalTab('details');
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingAnimal(null);
  };

  const handleAddEvent = () => {
    if (!newEvent.description) return;
    const event: UnifiedEvent = {
      id: Date.now().toString(),
      ...newEvent,
      type: newEvent.type as UnifiedEvent['type']
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (modalMode === 'view') return;
    
    const animalData = {
      tagNumber: formData.tagNumber,
      category: updateCategory(formData.category, Number(formData.weight) || 0),
      breed: formData.breed,
      weight: Number(formData.weight) || 0,
      birthDate: formData.birthDate,
      status: formData.status,
      notes: formData.notes,
      batch: formData.batch,
      events: formData.events,
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingAnimal) {
        await updateDoc(doc(db, `farms/${farmId}/animals`, editingAnimal.id), animalData);
      } else {
        await addDoc(collection(db, `farms/${farmId}/animals`), {
          ...animalData,
          createdAt: new Date().toISOString()
        });
      }
      handleCloseModal();
    } catch (error) {
       handleFirestoreError(error, editingAnimal ? 'update' : 'create', `farms/${farmId}/animals`, auth);
    } finally {
       setIsSubmitting(false);
    }
  };

  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isConfirmBatchDeleteOpen, setIsConfirmBatchDeleteOpen] = useState(false);
  const [animalToDelete, setAnimalToDelete] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setAnimalToDelete(id);
    setIsConfirmDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!animalToDelete) return;
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, `farms/${farmId}/animals`, animalToDelete));
      setIsConfirmDeleteOpen(false);
      setAnimalToDelete(null);
    } catch (error) {
      handleFirestoreError(error, 'delete', `farms/${farmId}/animals/${animalToDelete}`, auth);
      setIsConfirmDeleteOpen(false);
      setAnimalToDelete(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmBatchDelete = async () => {
    if (selectedAnimals.length === 0) return;
    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      selectedAnimals.forEach(id => {
        batch.delete(doc(db, `farms/${farmId}/animals`, id));
      });
      await batch.commit();
      setSelectedAnimals([]);
      setIsConfirmBatchDeleteOpen(false);
    } catch (error) {
      handleFirestoreError(error, 'write', `farms/${farmId}/animals`, auth);
      setIsConfirmBatchDeleteOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredAnimals = animals.filter(a => {
    const sTerm = (searchTerm || '').toLowerCase();
    return (a.tagNumber || '').toLowerCase().includes(sTerm) ||
           (a.category || '').toLowerCase().includes(sTerm) ||
           (a.breed || '').toLowerCase().includes(sTerm) ||
           (a.batch && a.batch.toLowerCase().includes(sTerm));
  });

  // Stats
  const totalAnimals = animals.filter(a => a.status === 'Activo').length;
  const totalWeight = animals.filter(a => a.status === 'Activo').reduce((sum, a) => sum + (a.weight || 0), 0);
  const avgWeight = totalAnimals > 0 ? Math.round(totalWeight / totalAnimals) : 0;

  if (isLoading) {
    return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div></div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex items-center space-x-5">
          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl">
            <Tag className="w-7 h-7" />
          </div>
          <div>
            <p className="text-sm text-stone-500 font-medium uppercase tracking-wider">Total Activos</p>
            <p className="text-3xl font-bold text-stone-900">{totalAnimals}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex items-center space-x-5">
          <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl">
            <Scale className="w-7 h-7" />
          </div>
          <div>
            <p className="text-sm text-stone-500 font-medium uppercase tracking-wider">Peso Promedio</p>
            <p className="text-3xl font-bold text-stone-900">{avgWeight} kg</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex items-center space-x-5">
          <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl">
            <Activity className="w-7 h-7" />
          </div>
          <div>
            <p className="text-sm text-stone-500 font-medium uppercase tracking-wider">Categorías</p>
            <p className="text-3xl font-bold text-stone-900">
              {new Set(animals.filter(a => a.status === 'Activo').map(a => a.category)).size}
            </p>
          </div>
        </div>
      </div>

      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
          <input
            type="text"
            placeholder="Buscar por caravana, lote, categoría o raza..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
          />
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Nuevo Animal</span>
        </button>
        <button
          onClick={() => setIsBatchCreateModalOpen(true)}
          className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Nuevo Lote</span>
        </button>
        <button
          onClick={() => { setBatchActionType('rations'); setIsBatchModalOpen(true); }}
          className="flex items-center space-x-2 bg-stone-600 hover:bg-stone-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Scale className="w-5 h-5" />
          <span>Raciones</span>
        </button>
        <button
          onClick={() => { setBatchActionType('pesajes'); setIsBatchModalOpen(true); }}
          className="flex items-center space-x-2 bg-stone-600 hover:bg-stone-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <TrendingUp className="w-5 h-5" />
          <span>Pesajes</span>
        </button>
        <button
          onClick={() => { setBatchActionType('medicacion'); setIsBatchModalOpen(true); }}
          className="flex items-center space-x-2 bg-stone-600 hover:bg-stone-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Syringe className="w-5 h-5" />
          <span>Medicación</span>
        </button>
      </div>

      {selectedAnimals.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-center justify-between shadow-sm">
          <span className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {selectedAnimals.length} animales seleccionados
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setIsConfirmBatchDeleteOpen(true)}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-lg text-sm font-bold transition-colors shadow-sm"
            >
              Eliminar seleccionados
            </button>
            <button
              onClick={() => setSelectedAnimals([])}
              className="bg-stone-200 hover:bg-stone-300 text-stone-700 px-4 py-1.5 rounded-lg text-sm font-bold transition-colors"
            >
              Deshacer
            </button>
          </div>
        </div>
      )}

      {isBatchModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-stone-800 mb-4 capitalize">
              Registrar {batchActionType === 'rations' ? 'Raciones' : batchActionType === 'pesajes' ? 'Pesajes' : 'Medicación'}
            </h3>
            <div className="space-y-4">
              {!isConfirmationStep ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Buscar Animal (Caravana/ID)</label>
                    <input
                      type="text"
                      placeholder="Buscar..."
                      className="w-full p-2 border border-stone-300 rounded-lg"
                      onChange={e => {
                        const term = (e.target.value || '').toLowerCase();
                        const found = animals.find(a => (a.tagNumber || '').toLowerCase().includes(term));
                        if (found && !selectedAnimalsForAction.find(a => a.id === found.id)) {
                          setSelectedAnimalsForAction([...selectedAnimalsForAction, found]);
                        }
                      }}
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto border rounded-lg p-2">
                    {selectedAnimalsForAction.map(animal => (
                      <div key={animal.id} className="flex justify-between items-center p-1 border-b">
                        <span>{animal.tagNumber}</span>
                        <button onClick={() => setSelectedAnimalsForAction(selectedAnimalsForAction.filter(a => a.id !== animal.id))} className="text-red-500">X</button>
                      </div>
                    ))}
                  </div>

                  {batchActionType === 'rations' && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Ingredientes</h4>
                      {INGREDIENTS.map(ing => (
                        <div key={ing} className="flex items-center gap-2">
                          <span className="text-sm w-40">{ing}</span>
                          <input type="number" placeholder="kg" className="p-1 border rounded w-20" onChange={e => setBatchActionInputs(prev => ({ ...prev, [ing]: Number(e.target.value) }))} />
                        </div>
                      ))}
                    </div>
                  )}
                  {(batchActionType === 'pesajes' || batchActionType === 'medicacion') && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">{batchActionType === 'pesajes' ? 'Pesos' : 'Medicamentos'}</h4>
                      {selectedAnimalsForAction.map(animal => (
                        <div key={animal.id} className="flex items-center gap-2">
                          <span className="text-sm w-20">{animal.tagNumber}</span>
                          <input type={batchActionType === 'pesajes' ? 'number' : 'text'} placeholder={batchActionType === 'pesajes' ? 'kg' : 'Descripción'} className="p-1 border rounded flex-1" onChange={e => setBatchActionInputs(prev => ({ ...prev, [animal.id]: batchActionType === 'pesajes' ? Number(e.target.value) : e.target.value }))} />
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => { setIsBatchModalOpen(false); setBatchActionInputs({}); setSelectedAnimalsForAction([]); }} className="flex-1 bg-stone-200 text-stone-800 py-2 rounded-lg">Cancelar</button>
                    <button onClick={() => setIsConfirmationStep(true)} className="flex-1 bg-emerald-600 text-white py-2 rounded-lg">Siguiente</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-4 bg-stone-50 rounded-lg">
                    <h4 className="font-medium mb-2">Resumen</h4>
                    <pre className="text-xs overflow-x-auto">{JSON.stringify({ animals: selectedAnimalsForAction.map(a => a.tagNumber), inputs: batchActionInputs }, null, 2)}</pre>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setIsConfirmationStep(false)} className="flex-1 bg-stone-200 text-stone-800 py-2 rounded-lg">Atrás</button>
                    <button
                      onClick={async () => {
                        if (isSubmitting) return;
                        setIsSubmitting(true);
                        const batch = writeBatch(db);
                        selectedAnimalsForAction.forEach(animal => {
                          const animalRef = doc(db, `farms/${farmId}/animals`, animal.id);
                          if (batchActionType === 'rations') {
                            const ingredients = Object.entries(batchActionInputs).filter(([_, amount]) => (amount as number) > 0).map(([type, amount]) => ({ type, amount: amount as number }));
                            const totalAmount = ingredients.reduce((sum, ing) => sum + ing.amount, 0);
                            if (ingredients.length > 0) {
                              batch.update(animalRef, { events: [...(animal.events || []), { id: Date.now().toString(), date: new Date().toISOString().split('T')[0], type: 'Ración', ingredients, totalAmount }] });
                            }
                          } else if (batchActionType === 'medicacion') {
                            const description = batchActionInputs[animal.id];
                            if (description) {
                              batch.update(animalRef, { events: [...(animal.events || []), { id: Date.now().toString(), date: new Date().toISOString().split('T')[0], type: 'Medicación', description }] });
                            }
                          } else if (batchActionType === 'pesajes') {
                            const weight = batchActionInputs[animal.id];
                            if (weight) {
                              batch.update(animalRef, { 
                                weight,
                                category: updateCategory(animal.category, weight),
                                events: [...(animal.events || []), { id: Date.now().toString(), date: new Date().toISOString().split('T')[0], type: 'Variación de Peso', description: `Nuevo peso: ${weight} kg` }] 
                              });
                            }
                          }
                        });
                        await batch.commit();
                        setIsSubmitting(false);
                        setIsBatchModalOpen(false);
                        setBatchActionInputs({});
                        setSelectedAnimalsForAction([]);
                        setIsConfirmationStep(false);
                      }}
                      disabled={isSubmitting}
                      className={`flex-1 text-white py-2 rounded-lg ${isSubmitting ? 'bg-emerald-400' : 'bg-emerald-600'}`}
                    >
                      {isSubmitting ? 'Registrando...' : 'Confirmar Registro'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {isBatchCreateModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-stone-800 mb-4">Registrar Nuevo Lote</h3>
            <div className="space-y-4">
              <input type="text" placeholder="Nombre del Lote/Rodeo/Jaula" className="w-full p-2 border border-stone-300 rounded-lg" id="batch-name" />
              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Animales</h4>
                {batchAnimals.map((animal, index) => (
                  <div key={index} className="grid grid-cols-6 gap-2 mb-2 p-2 bg-stone-50 rounded-lg">
                    <input type="text" placeholder="Caravana" className="p-1 border rounded" value={animal.tagNumber || ''} onChange={e => { const newAnimals = [...batchAnimals]; newAnimals[index].tagNumber = e.target.value; setBatchAnimals(newAnimals); }} />
                    <select className="p-1 border rounded" value={animal.category || 'Ternero'} onChange={e => { const newAnimals = [...batchAnimals]; newAnimals[index].category = e.target.value; setBatchAnimals(newAnimals); }}>
                      {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                    <select className="p-1 border rounded" value={animal.breed || 'Angus'} onChange={e => { const newAnimals = [...batchAnimals]; newAnimals[index].breed = e.target.value; setBatchAnimals(newAnimals); }}>
                      {BREEDS.map(breed => <option key={breed} value={breed}>{breed}</option>)}
                    </select>
                    <input type="number" placeholder="Peso" className="p-1 border rounded" value={animal.weight || ''} onChange={e => { const newAnimals = [...batchAnimals]; newAnimals[index].weight = Number(e.target.value); setBatchAnimals(newAnimals); }} />
                    <input type="date" className="p-1 border rounded" value={animal.birthDate || ''} onChange={e => { const newAnimals = [...batchAnimals]; newAnimals[index].birthDate = e.target.value; setBatchAnimals(newAnimals); }} />
                    <select className="p-1 border rounded" value={animal.status || 'Activo'} onChange={e => { const newAnimals = [...batchAnimals]; newAnimals[index].status = e.target.value; setBatchAnimals(newAnimals); }}>
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                ))}
                <button onClick={() => setBatchAnimals([...batchAnimals, { tagNumber: '', category: 'Ternero', breed: 'Angus', weight: 0, birthDate: new Date().toISOString().split('T')[0], status: 'Activo' }])} className="text-emerald-600 font-medium text-sm">+ Agregar Animal</button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setIsBatchCreateModalOpen(false); setBatchAnimals([]); }} className="flex-1 bg-stone-200 text-stone-800 py-2 rounded-lg">Cancelar</button>
                <button
                  onClick={async () => {
                    const batchName = (document.getElementById('batch-name') as HTMLInputElement).value;
                    if (!batchName || batchAnimals.length === 0) return;
                    
                    const batch = writeBatch(db);
                    batchAnimals.forEach(animal => {
                      const animalRef = doc(collection(db, `farms/${farmId}/animals`));
                      batch.set(animalRef, {
                        ...animal,
                        category: updateCategory(animal.category || 'Ternero', animal.weight || 0),
                        batch: batchName,
                        createdAt: new Date().toISOString()
                      });
                    });
                    await batch.commit();
                    setIsBatchCreateModalOpen(false);
                    setBatchAnimals([]);
                  }}
                  className="flex-1 bg-emerald-600 text-white py-2 rounded-lg"
                >
                  Registrar Lote
                </button>
              </div>
            </div>
          </div>
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
                    checked={selectedAnimals.length === filteredAnimals.length && filteredAnimals.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedAnimals(filteredAnimals.map(a => a.id));
                      } else {
                        setSelectedAnimals([]);
                      }
                    }}
                  />
                </th>
                <th className="p-4 font-medium">Caravana</th>
                <th className="p-4 font-medium">Lote / Jaula</th>
                <th className="p-4 font-medium">Categoría</th>
                <th className="p-4 font-medium">Raza</th>
                <th className="p-4 font-medium">Peso (kg)</th>
                <th className="p-4 font-medium">Estado</th>
                <th className="p-4 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {filteredAnimals.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-stone-500">
                    No se encontraron animales.
                  </td>
                </tr>
              ) : (
                filteredAnimals.map((animal) => (
                  <tr key={animal.id} className="hover:bg-stone-50 transition-colors">
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={selectedAnimals.includes(animal.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedAnimals([...selectedAnimals, animal.id]);
                          } else {
                            setSelectedAnimals(selectedAnimals.filter(id => id !== animal.id));
                          }
                        }}
                      />
                    </td>
                    <td className="p-4 font-medium text-stone-800">{animal.tagNumber}</td>
                    <td className="p-4 text-stone-600">{animal.batch || '-'}</td>
                    <td className="p-4 text-stone-600">{animal.category}</td>
                    <td className="p-4 text-stone-600">{animal.breed}</td>
                    <td className="p-4 text-stone-600">{animal.weight}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                        ${animal.status === 'Activo' ? 'bg-emerald-100 text-emerald-800' : 
                          animal.status === 'Vendido' ? 'bg-blue-100 text-blue-800' : 
                          'bg-red-100 text-red-800'}`}>
                        {animal.status}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button
                        onClick={() => handleOpenModal(animal, 'view')}
                        className="p-2 text-stone-400 hover:text-emerald-600 transition-colors"
                        title="Ver Ficha"
                      >
                        <Activity className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleOpenModal(animal, 'edit')}
                        className="p-2 text-stone-400 hover:text-emerald-600 transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(animal.id)}
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
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-stone-900">
                    {editingAnimal ? `Animal: ${editingAnimal.tagNumber}` : 'Nuevo Animal'}
                  </h3>
                  <p className="text-sm text-stone-500">
                    {modalMode === 'view' ? 'Ficha técnica' : 'Edición de perfil'}
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
              <button
                onClick={() => setModalTab('history')}
                className={`px-6 py-3 text-sm font-bold transition-colors border-b-2 ${
                  modalTab === 'history' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-stone-400 hover:text-stone-600'
                }`}
              >
                Historial de Eventos
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-white">
              {modalTab === 'details' ? (
                <form id="animal-form" onSubmit={handleSubmit}>
                  <fieldset disabled={modalMode === 'view'} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-stone-700">Número de Caravana</label>
                      <input
                        type="text"
                        required
                        value={formData.tagNumber}
                        onChange={(e) => setFormData({ ...formData, tagNumber: e.target.value })}
                        className="w-full p-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all disabled:bg-stone-50 disabled:text-stone-500"
                        placeholder="Ej: AB-123"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-stone-700">Categoría</label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full p-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all disabled:bg-stone-50"
                      >
                        {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-stone-700">Raza</label>
                      <select
                        value={formData.breed}
                        onChange={(e) => setFormData({ ...formData, breed: e.target.value })}
                        className="w-full p-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all disabled:bg-stone-50"
                      >
                        {BREEDS.map(breed => <option key={breed} value={breed}>{breed}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-stone-700">Peso Actual (kg)</label>
                      <input
                        type="number"
                        required
                        value={formData.weight}
                        onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                        className="w-full p-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all disabled:bg-stone-50"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-stone-700">Fecha de Nacimiento / Ingreso</label>
                      <input
                        type="date"
                        required
                        value={formData.birthDate}
                        onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                        className="w-full p-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all disabled:bg-stone-50"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-stone-700">Estado</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="w-full p-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all disabled:bg-stone-50"
                      >
                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-stone-700">Lote / Rodeo / Jaula</label>
                      <input
                        type="text"
                        value={formData.batch}
                        onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
                        className="w-full p-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all disabled:bg-stone-50"
                        placeholder="Ej: Lote 1"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-bold text-stone-700">Notas / Observaciones</label>
                      <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        className="w-full p-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none h-24 resize-none transition-all disabled:bg-stone-50"
                        placeholder="Información adicional relevante..."
                      />
                    </div>
                  </fieldset>
                </form>
              ) : (
                <div className="space-y-6">
                  {modalMode === 'edit' && (
                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 shadow-sm">
                      <h4 className="text-sm font-bold text-emerald-800 mb-3 uppercase tracking-wider flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        Registrar Nuevo Evento
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        <input
                          type="date"
                          value={newEvent.date}
                          onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                          className="p-2.5 border border-stone-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                        />
                        <select
                          value={newEvent.type}
                          onChange={(e) => setNewEvent({ ...newEvent, type: e.target.value as UnifiedEvent['type'] })}
                          className="p-2.5 border border-stone-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-medium"
                        >
                          {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Descripción del evento..."
                            value={newEvent.description}
                            onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                            className="flex-1 p-2.5 border border-stone-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                          />
                          <button
                            type="button"
                            onClick={handleAddEvent}
                            className="bg-emerald-600 text-white p-2.5 rounded-xl hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100"
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
                      Línea de Tiempo
                    </h4>
                    {formData.events.length === 0 ? (
                      <div className="text-center py-12 text-stone-400 border-2 border-dashed border-stone-100 rounded-2xl">
                        <Activity className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p className="font-medium">No hay eventos registrados para este animal</p>
                      </div>
                    ) : (
                      <div className="relative border-l-2 border-stone-100 ml-3 space-y-6">
                        {formData.events.sort((a,b) => b.date.localeCompare(a.date)).map((event) => (
                          <div key={event.id} className="relative pl-6">
                            <div className="absolute left-[-9px] top-1 w-4 h-4 rounded-full bg-emerald-500 border-4 border-white shadow-sm ring-1 ring-emerald-500/20"></div>
                            <div className="bg-white p-4 rounded-2xl border border-stone-100 shadow-sm relative group hover:border-emerald-200 transition-colors">
                              <div className="flex justify-between items-start mb-1">
                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest leading-none bg-stone-50 px-2 py-1 rounded">
                                  {event.date}
                                </span>
                                {modalMode === 'edit' && (
                                  <button
                                    onClick={() => handleRemoveEvent(event.id)}
                                    className="text-stone-300 hover:text-red-500 transition-colors p-1"
                                    title="Eliminar evento"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-stone-800">{event.type}</span>
                                {event.totalAmount && (
                                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                    {event.totalAmount} kg totales
                                  </span>
                                )}
                              </div>
                              {event.description && (
                                <p className="text-sm text-stone-600 leading-relaxed font-medium">"{event.description}"</p>
                              )}
                              {event.ingredients && (
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                  {event.ingredients.map((ing, i) => (
                                    <span key={i} className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-stone-50 border border-stone-100 text-stone-500">
                                      {ing.type}: {ing.amount} kg
                                    </span>
                                  ))}
                                </div>
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
                {modalMode === 'view' ? 'Cerrar' : 'Cancelar'}
              </button>
              {modalMode === 'edit' && (
                <button
                  type="submit"
                  form="animal-form"
                  disabled={isSubmitting}
                  className="px-10 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Single Confirmation */}
      {isConfirmDeleteOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-stone-900 mb-2 text-center">Confirmar eliminación</h3>
            <p className="text-stone-600 mb-6 text-center">
              ¿Estás seguro de que deseas eliminar este animal? Esta acción eliminará permanentemente todos sus registros.
            </p>
            <div className="flex flex-col gap-2">
              <button 
                onClick={confirmDelete}
                className="w-full py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-100"
              >
                Sí, eliminar definitivamente
              </button>
              <button 
                onClick={() => setIsConfirmDeleteOpen(false)} 
                className="w-full py-2.5 text-stone-600 font-bold hover:bg-stone-100 rounded-xl transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Batch Confirmation */}
      {isConfirmBatchDeleteOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4 mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-stone-900 mb-2 text-center">Eliminar Selección</h3>
            <p className="text-stone-600 mb-6 text-center">
              Vas a eliminar <strong>{selectedAnimals.length}</strong> animales y todos sus históricos. ¿Deseas continuar?
            </p>
            <div className="flex flex-col gap-2">
              <button 
                onClick={confirmBatchDelete}
                disabled={isSubmitting}
                className="w-full py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-100 disabled:opacity-50"
              >
                {isSubmitting ? 'Eliminando...' : 'Eliminar seleccionados'}
              </button>
              <button 
                onClick={() => setIsConfirmBatchDeleteOpen(false)} 
                className="w-full py-2.5 text-stone-600 font-bold hover:bg-stone-100 rounded-xl transition-all"
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
