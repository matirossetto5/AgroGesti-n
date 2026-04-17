import React, { useState, useEffect } from 'react';
import { 
  collection, onSnapshot, addDoc, query, orderBy, deleteDoc, doc, Timestamp 
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError } from '../lib/errorHandlers';
import { 
  Sprout, Droplets, Target, Calendar, ClipboardCheck, Trash2, 
  ChevronRight, Filter, Plus, Activity, Info, TrendingUp, FlaskConical
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AgEvent {
  id: string;
  type: 'siembra' | 'aplicacion' | 'cosecha';
  date: any;
  lotId: string;
  lotName: string;
  crop: string;
  details: any;
}

interface Lot {
  id: string;
  name: string;
  area?: number;
}

export default function AgriculturaModule({ farmId }: { farmId: string }) {
  const [events, setEvents] = useState<AgEvent[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'historial' | 'nueva' | 'porLote'>('historial');
  const [eventType, setEventType] = useState<'siembra' | 'aplicacion' | 'cosecha'>('siembra');
  
  // Form States
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedLotId, setSelectedLotId] = useState('');
  const [crop, setCrop] = useState('');
  const [details, setDetails] = useState<any>({});
  const [isActionLoading, setIsActionLoading] = useState(false);

  useEffect(() => {
    if (!farmId) return;

    // Load Lots
    const lotsUnsubscribe = onSnapshot(collection(db, 'farms', farmId, 'lots'), (snapshot) => {
      const loadedLots: Lot[] = [];
      snapshot.forEach((doc) => {
        loadedLots.push({ id: doc.id, ...doc.data() } as Lot);
      });
      setLots(loadedLots);
    });

    // Load Events
    const q = query(collection(db, 'farms', farmId, 'ag_events'), orderBy('date', 'desc'));
    const eventsUnsubscribe = onSnapshot(q, (snapshot) => {
      const loadedEvents: AgEvent[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        loadedEvents.push({ 
          id: doc.id, 
          ...data,
          date: data.date instanceof Timestamp ? data.date.toDate() : new Date(data.date)
        } as AgEvent);
      });
      setEvents(loadedEvents);
    });

    return () => {
      lotsUnsubscribe();
      eventsUnsubscribe();
    };
  }, [farmId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const lot = lots.find(l => l.id === selectedLotId);
    
    setIsActionLoading(true);
    try {
      await addDoc(collection(db, 'farms', farmId, 'ag_events'), {
        type: eventType,
        date: Timestamp.fromDate(new Date(formDate)),
        lotId: selectedLotId,
        lotName: lot?.name || 'Desconocido',
        crop,
        details,
        createdAt: Timestamp.now()
      });
      
      setActiveSubTab('historial');
      setDetails({});
      setCrop('');
    } catch (error) {
      handleFirestoreError(error, 'create', `farms/${farmId}/ag_events`, auth);
    } finally {
      setIsActionLoading(false);
    }
  };

  const deleteEvent = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar este registro?')) {
      setIsActionLoading(true);
      try {
        await deleteDoc(doc(db, 'farms', farmId, 'ag_events', id));
      } catch (error) {
        handleFirestoreError(error, 'delete', `farms/${farmId}/ag_events/${id}`, auth);
      } finally {
        setIsActionLoading(false);
      }
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'siembra': return <Sprout className="w-5 h-5 text-emerald-600" />;
      case 'aplicacion': return <FlaskConical className="w-5 h-5 text-purple-600" />;
      case 'cosecha': return <TrendingUp className="w-5 h-5 text-amber-600" />;
      default: return <Activity className="w-5 h-5" />;
    }
  };

  const getEventLabel = (type: string) => {
    switch (type) {
      case 'siembra': return 'Siembra';
      case 'aplicacion': return 'Aplicación';
      case 'cosecha': return 'Cosecha';
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-stone-900 tracking-tight">Gestión Agrícola</h2>
          <p className="text-stone-500 text-sm">Trazabilidad completa de siembra, aplicaciones y rindes</p>
        </div>
        <div className="flex bg-stone-100 p-1 rounded-2xl overflow-x-auto scrollbar-hide">
          <button 
            onClick={() => setActiveSubTab('historial')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeSubTab === 'historial' ? 'bg-white text-emerald-700 shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}
          >
            General
          </button>
          <button 
            onClick={() => setActiveSubTab('porLote')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeSubTab === 'porLote' ? 'bg-white text-emerald-700 shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}
          >
            Por Lote
          </button>
          <button 
            onClick={() => setActiveSubTab('nueva')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeSubTab === 'nueva' ? 'bg-white text-emerald-700 shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}
          >
            Nueva Actividad
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeSubTab === 'historial' ? (
          <motion.div 
            key="historial"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {events.length === 0 ? (
              <div className="bg-white border-2 border-dashed border-stone-200 rounded-[2rem] p-12 text-center">
                <ClipboardCheck className="w-16 h-16 text-stone-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-stone-800">No hay registros aún</h3>
                <p className="text-stone-500 mb-6">Comienza registrando tu primera siembra o aplicación.</p>
                <button 
                  onClick={() => setActiveSubTab('nueva')}
                  className="bg-emerald-600 text-white font-bold px-6 py-3 rounded-2xl hover:bg-emerald-700 transition-all"
                >
                  Registrar Actividad
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {events.map(event => (
                  <div key={event.id} className="bg-white border border-stone-100 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-shadow group">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className={`p-4 rounded-2xl ${
                          event.type === 'siembra' ? 'bg-emerald-50' : 
                          event.type === 'aplicacion' ? 'bg-purple-50' : 'bg-amber-50'
                        }`}>
                          {getEventIcon(event.type)}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">{getEventLabel(event.type)}</p>
                          <h4 className="text-lg font-black text-stone-900">{event.crop} <span className="text-stone-400 font-normal">en</span> {event.lotName}</h4>
                          <div className="flex items-center gap-2 text-stone-500 text-sm mt-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {event.date.toLocaleDateString('es-AR')}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-[200px] border-l border-stone-100 pl-6 hidden md:block">
                        <div className="grid grid-cols-2 gap-4">
                          {event.type === 'siembra' && (
                            <>
                              <div>
                                <p className="text-[10px] uppercase font-bold text-stone-400">Variedad</p>
                                <p className="text-sm font-bold text-stone-700">{event.details.variety || '-'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase font-bold text-stone-400">Densidad</p>
                                <p className="text-sm font-bold text-stone-700">{event.details.density || '-'} pl/m2</p>
                              </div>
                            </>
                          )}
                          {event.type === 'aplicacion' && (
                            <>
                              <div>
                                <p className="text-[10px] uppercase font-bold text-stone-400">Producto</p>
                                <p className="text-sm font-bold text-stone-700">{event.details.product || '-'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase font-bold text-stone-400">Dosis</p>
                                <p className="text-sm font-bold text-stone-700">{event.details.dose || '-'} l/ha</p>
                              </div>
                            </>
                          )}
                          {event.type === 'cosecha' && (
                            <>
                              <div>
                                <p className="text-[10px] uppercase font-bold text-stone-400">Rinde</p>
                                <p className="text-sm font-bold text-emerald-600">{event.details.yield || '-'} qq/ha</p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase font-bold text-stone-400">Humedad</p>
                                <p className="text-sm font-bold text-stone-700">{event.details.moisture || '-'}%</p>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      <button 
                        onClick={() => deleteEvent(event.id)}
                        className="p-3 text-stone-300 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        ) : activeSubTab === 'porLote' ? (
          <motion.div 
            key="porLote"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-6"
          >
            {lots.map(lot => {
              const lotEvents = events.filter(e => e.lotId === lot.id);
              if (lotEvents.length === 0) return null;
              
              return (
                <div key={lot.id} className="bg-white border border-stone-200 rounded-[2.5rem] overflow-hidden shadow-sm">
                  <div className="bg-stone-50 px-8 py-4 border-b border-stone-200 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                        <Target className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <h3 className="font-black text-stone-800 text-lg">{lot.name}</h3>
                        <p className="text-xs text-stone-500 font-bold uppercase tracking-widest">{lot.area?.toFixed(1) || '?'} Hectáreas</p>
                      </div>
                    </div>
                    <div className="flex gap-4 text-center">
                      <div className="px-4 border-r border-stone-200">
                        <p className="text-[10px] text-stone-400 font-bold uppercase">Eventos</p>
                        <p className="text-lg font-black text-stone-700">{lotEvents.length}</p>
                      </div>
                      <div className="px-4">
                        <p className="text-[10px] text-stone-400 font-bold uppercase">Últ. Actividad</p>
                        <p className="text-lg font-black text-stone-700">{lotEvents[0].date.toLocaleDateString('es-AR')}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 md:p-8">
                    <div className="relative border-l-2 border-stone-100 ml-4 space-y-8 py-2">
                      {lotEvents.map((event, idx) => (
                        <div key={event.id} className="relative pl-8">
                          {/* Timeline dot */}
                          <div className={`absolute left-[-9px] top-0 w-4 h-4 rounded-full border-2 border-white shadow-sm ${
                            event.type === 'siembra' ? 'bg-emerald-500' : 
                            event.type === 'cosecha' ? 'bg-amber-500' : 'bg-purple-500'
                          }`} />
                          
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${
                                  event.type === 'siembra' ? 'bg-emerald-50 text-emerald-700' : 
                                  event.type === 'cosecha' ? 'bg-amber-50 text-amber-700' : 'bg-purple-50 text-purple-700'
                                }`}>
                                  {getEventLabel(event.type)}
                                </span>
                                <span className="text-xs text-stone-400 font-mono">{event.date.toLocaleDateString('es-AR')}</span>
                              </div>
                              <h4 className="text-lg font-black text-stone-900">{event.crop}</h4>
                            </div>
                            
                            <div className="flex flex-wrap gap-4 bg-stone-50 p-3 rounded-2xl border border-stone-100">
                              {event.type === 'siembra' && (
                                <>
                                  <div className="pr-4 border-r border-stone-200">
                                    <p className="text-[10px] text-stone-400 uppercase font-bold">Variedad</p>
                                    <p className="text-xs font-bold text-stone-700">{event.details.variety || '-'}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-stone-400 uppercase font-bold">Densidad</p>
                                    <p className="text-xs font-bold text-stone-700">{event.details.density || '-'} pl/m2</p>
                                  </div>
                                </>
                              )}
                              {event.type === 'cosecha' && (
                                <>
                                  <div className="pr-4 border-r border-stone-200">
                                    <p className="text-[10px] text-stone-400 uppercase font-bold">Rinde</p>
                                    <p className="text-xs font-bold text-emerald-600">{event.details.yield || '-'} qq/ha</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-stone-400 uppercase font-bold">Humedad</p>
                                    <p className="text-xs font-bold text-stone-700">{event.details.moisture || '-'}%</p>
                                  </div>
                                </>
                              )}
                              {event.type === 'aplicacion' && (
                                <>
                                  <div className="pr-4 border-r border-stone-200">
                                    <p className="text-[10px] text-stone-400 uppercase font-bold">Producto</p>
                                    <p className="text-xs font-bold text-purple-700">{event.details.product || '-'}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-stone-400 uppercase font-bold">Dosis</p>
                                    <p className="text-xs font-bold text-stone-700">{event.details.dose || '-'} l/ha</p>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                          
                          {idx < lotEvents.length - 1 && (
                            <div className="absolute left-[-1px] top-4 bottom-[-32px] w-[2px] bg-stone-100" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {new Set(events.map(e => e.lotId)).size === 0 && (
               <div className="bg-white border-2 border-dashed border-stone-200 rounded-[2rem] p-12 text-center">
                 <Target className="w-16 h-16 text-stone-300 mx-auto mb-4" />
                 <h3 className="text-xl font-bold text-stone-800">No hay datos por lote</h3>
                 <p className="text-stone-500">Registra actividades para ver el historial organizado por lote.</p>
               </div>
            )}
          </motion.div>
        ) : (
          <motion.div 
            key="nueva"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="bg-white border border-stone-200 rounded-[2.5rem] p-8 shadow-sm"
          >
            <div className="flex gap-4 mb-8 overflow-x-auto pb-2 scrollbar-hide">
              {[
                { id: 'siembra', icon: Sprout, label: 'Siembra', color: 'bg-emerald-600' },
                { id: 'aplicacion', icon: FlaskConical, label: 'Aplicación', color: 'bg-purple-600' },
                { id: 'cosecha', icon: TrendingUp, label: 'Cosecha', color: 'bg-amber-600' }
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => {
                    setEventType(t.id as any);
                    setDetails({});
                  }}
                  className={`flex items-center gap-3 px-6 py-4 rounded-2xl transition-all shrink-0 ${
                    eventType === t.id 
                    ? `${t.color} text-white shadow-lg` 
                    : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                  }`}
                >
                  <t.icon className="w-5 h-5" />
                  <span className="font-black text-sm uppercase tracking-wider">{t.label}</span>
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-2">Lote / Parcela</label>
                  <select 
                    required
                    value={selectedLotId}
                    onChange={e => setSelectedLotId(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Selecciona un lote...</option>
                    {lots.map(lot => (
                      <option key={lot.id} value={lot.id}>{lot.name} ({lot.area?.toFixed(1) || '?'} ha)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-2">Cultivo</label>
                  <input 
                    type="text"
                    required
                    placeholder="Ej: Soja de 1ra, Maíz, Trigo Pan"
                    value={crop}
                    onChange={e => setCrop(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-2">Fecha</label>
                  <input 
                    type="date"
                    required
                    value={formDate}
                    onChange={e => setFormDate(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Dynamic fields based on event type */}
                {eventType === 'siembra' && (
                  <>
                    <div>
                      <label className="block text-sm font-bold text-stone-700 mb-2">Variedad / Híbrido</label>
                      <input 
                        type="text"
                        value={details.variety || ''}
                        onChange={e => setDetails({...details, variety: e.target.value})}
                        className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-stone-700 mb-2">Densidad (pl/m2)</label>
                      <input 
                        type="number"
                        step="0.1"
                        value={details.density || ''}
                        onChange={e => setDetails({...details, density: e.target.value})}
                        className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </>
                )}

                {eventType === 'aplicacion' && (
                  <>
                    <div>
                      <label className="block text-sm font-bold text-stone-700 mb-2">Producto Comercial / Principio Activo</label>
                      <input 
                        type="text"
                        required
                        value={details.product || ''}
                        onChange={e => setDetails({...details, product: e.target.value})}
                        className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-stone-700 mb-2">Dosis (l/ha o kg/ha)</label>
                      <input 
                        type="number"
                        step="0.01"
                        required
                        value={details.dose || ''}
                        onChange={e => setDetails({...details, dose: e.target.value})}
                        className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-bold text-stone-700 mb-2">Objetivo (Plaga/Maleza/Enfermedad)</label>
                      <input 
                        type="text"
                        value={details.target || ''}
                        onChange={e => setDetails({...details, target: e.target.value})}
                        className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="Ej: Rama Negra, Isoca bolillera, etc."
                      />
                    </div>
                  </>
                )}

                {eventType === 'cosecha' && (
                  <>
                    <div>
                      <label className="block text-sm font-bold text-stone-700 mb-2">Rinde Obtenido (qq/ha)</label>
                      <input 
                        type="number"
                        step="0.1"
                        required
                        value={details.yield || ''}
                        onChange={e => setDetails({...details, yield: e.target.value})}
                        className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-stone-700 mb-2">Humedad (%)</label>
                      <input 
                        type="number"
                        step="0.1"
                        value={details.moisture || ''}
                        onChange={e => setDetails({...details, moisture: e.target.value})}
                        className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="pt-6 border-t border-stone-100 flex gap-4">
                <button 
                  type="button"
                  onClick={() => setActiveSubTab('historial')}
                  className="flex-1 bg-stone-100 text-stone-600 font-bold py-4 rounded-2xl hover:bg-stone-200 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isActionLoading}
                  className="flex-[2] bg-emerald-600 text-white font-black py-4 rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 uppercase tracking-widest disabled:opacity-50"
                >
                  {isActionLoading ? 'Guardando...' : 'Guardar Registro'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Board */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-stone-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-50 rounded-xl">
              <Sprout className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-xs font-bold text-stone-400 tracking-tighter uppercase">Siembras Campaña</p>
          </div>
          <p className="text-3xl font-black text-stone-900">{events.filter(e => e.type === 'siembra').length}</p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-stone-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-50 rounded-xl">
              <FlaskConical className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-xs font-bold text-stone-400 tracking-tighter uppercase">Pulverizaciones</p>
          </div>
          <p className="text-3xl font-black text-stone-900">{events.filter(e => e.type === 'aplicacion').length}</p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-stone-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-50 rounded-xl">
              <TrendingUp className="w-5 h-5 text-amber-600" />
            </div>
            <p className="text-xs font-bold text-stone-400 tracking-tighter uppercase">Cosechas</p>
          </div>
          <p className="text-3xl font-black text-stone-900">{events.filter(e => e.type === 'cosecha').length}</p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-stone-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-50 rounded-xl">
               <Info className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-xs font-bold text-stone-400 tracking-tighter uppercase">Lotes con Actividad</p>
          </div>
          <p className="text-3xl font-black text-stone-900">{new Set(events.map(e => e.lotId)).size}</p>
        </div>
      </div>
    </div>
  );
}
