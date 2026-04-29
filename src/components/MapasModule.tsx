import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Polygon, useMap, Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import { collection, onSnapshot, addDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError } from '../lib/errorHandlers';
import { Layers, Trash2, Info, X, MapPin, Edit2, Check } from 'lucide-react';

interface Lot {
  id: string;
  name: string;
  cultivo: string;
  color: string;
  path: { lat: number; lng: number }[];
  area?: number;
}

interface MapasModuleProps {
  farmId: string;
  coordinates?: string;
}

// Helper to calculate area in hectares (approximate for spherical)
function calculateAreaHa(path: { lat: number, lng: number }[]): number {
  if (path.length < 3) return 0;
  const radius = 6378137; // Earth radius
  let area = 0;
  for (let i = 0; i < path.length; i++) {
    const j = (i + 1) % path.length;
    const p1 = path[i];
    const p2 = path[j];
    area += (p2.lng - p1.lng) * Math.PI / 180 * (2 + Math.sin(p1.lat * Math.PI / 180) + Math.sin(p2.lat * Math.PI / 180));
  }
  area = Math.abs(area * radius * radius / 2.0);
  return area / 10000;
}

function GeomanHandler({ 
  onPolygonComplete, 
  onPolygonEdit,
  isEditActive
}: { 
  onPolygonComplete: (path: { lat: number; lng: number }[], area: number) => void;
  onPolygonEdit?: (id: string, path: { lat: number; lng: number }[], area: number) => void;
  isEditActive?: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (isEditActive) {
      map.pm.enableGlobalEditMode();
    } else {
      map.pm.disableGlobalEditMode();
    }
  }, [map, isEditActive]);

  useEffect(() => {
    const controlsConfig = {
      position: 'topleft',
      drawMarker: false,
      drawCircle: false,
      drawPolyline: false,
      drawRectangle: false,
      drawCircleMarker: false,
      drawText: false,
      cutPolygon: false,
      rotateMode: false,
      dragMode: false,
      editMode: true,
      removalMode: false,
    };

    map.pm.addControls(controlsConfig as any);

    const handleCreate = (e: any) => {
      const { layer } = e;
      if (layer instanceof L.Polygon) {
        const latlngs = layer.getLatLngs()[0];
        if (Array.isArray(latlngs)) {
          const path = (latlngs as L.LatLng[]).map(ll => ({ lat: ll.lat, lng: ll.lng }));
          const area = calculateAreaHa(path);
          onPolygonComplete(path, area);
        }
        map.removeLayer(layer);
      }
    };

    const handleEdit = (e: any) => {
      const { layer } = e;
      const layerId = (layer.options as any).id;
      if (layer instanceof L.Polygon && layerId) {
        const latlngs = layer.getLatLngs()[0];
        if (Array.isArray(latlngs)) {
          const path = (latlngs as L.LatLng[]).map(ll => ({ lat: ll.lat, lng: ll.lng }));
          const area = calculateAreaHa(path);
          onPolygonEdit?.(layerId, path, area);
        }
      }
    };

    map.on('pm:create', handleCreate);
    map.on('pm:edit', handleEdit);

    return () => {
      map.pm.removeControls();
      map.off('pm:create', handleCreate);
      map.off('pm:edit', handleEdit);
    };
  }, [map, onPolygonComplete, onPolygonEdit]);

  return null;
}

// Component to handle auto-centering of the map
function MapAutoCenter({ center, lots }: { center: [number, number], lots: Lot[] }) {
  const map = useMap();
  useEffect(() => {
    if (lots.length > 0) {
      const bounds = L.latLngBounds(lots.flatMap(lot => lot.path.map(p => [p.lat, p.lng] as [number, number])));
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    } else {
      map.setView(center, 14);
    }
  }, [lots, center, map]);
  return null;
}

export default function MapasModule({ farmId, coordinates }: MapasModuleProps) {
  const [lots, setLots] = useState<Lot[]>([]);
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null);
  const [isAddingLot, setIsAddingLot] = useState(false);
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [isGeometryEditActive, setIsGeometryEditActive] = useState(false);
  
  const [newLotPath, setNewLotPath] = useState<{ lat: number; lng: number }[] | null>(null);
  const [newLotArea, setNewLotArea] = useState<number>(0);
  const [newLotName, setNewLotName] = useState('');
  const [newLotCultivo, setNewLotCultivo] = useState('');
  const [newLotColor, setNewLotColor] = useState('#10b981');
  const [isActionLoading, setIsActionLoading] = useState(false);

  const defaultCenter: [number, number] = useMemo(() => {
    if (coordinates) {
      const parts = coordinates.split(',').map(p => parseFloat(p.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return [parts[0], parts[1]];
      }
    }
    return [-34.6037, -58.3816];
  }, [coordinates]);

  useEffect(() => {
    if (!farmId) return;
    const q = collection(db, 'farms', farmId, 'lots');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedLots: Lot[] = [];
      snapshot.forEach((doc) => {
        loadedLots.push({ id: doc.id, ...doc.data() } as Lot);
      });
      setLots(loadedLots);
    });
    return () => unsubscribe();
  }, [farmId]);

  const onPolygonComplete = (path: { lat: number, lng: number }[], area: number) => {
    setNewLotPath(path);
    setNewLotArea(area);
    setIsAddingLot(true);
  };

  const saveLot = async () => {
    if (!newLotName || !newLotPath) return;

    setIsActionLoading(true);
    try {
      if (selectedLot && isEditingMetadata) {
        // Update existing lot
        await updateDoc(doc(db, 'farms', farmId, 'lots', selectedLot.id), {
          name: newLotName,
          cultivo: newLotCultivo,
          color: newLotColor,
          path: newLotPath,
          area: newLotArea
        });
        setIsEditingMetadata(false);
        setSelectedLot(null);
      } else {
        // Add new lot
        await addDoc(collection(db, 'farms', farmId, 'lots'), {
          name: newLotName,
          cultivo: newLotCultivo,
          color: newLotColor,
          path: newLotPath,
          area: newLotArea
        });
      }

      setNewLotName('');
      setNewLotCultivo('');
      setNewLotPath(null);
      setIsAddingLot(false);
    } catch (error: any) {
      handleFirestoreError(error, selectedLot && isEditingMetadata ? 'update' : 'create', `farms/${farmId}/lots`, auth);
    } finally {
      setIsActionLoading(false);
    }
  };

  const onPolygonEdit = async (lotId: string, path: { lat: number, lng: number }[], area: number) => {
    try {
      await updateDoc(doc(db, 'farms', farmId, 'lots', lotId), {
        path,
        area
      });
    } catch (error) {
      handleFirestoreError(error, 'update', `farms/${farmId}/lots/${lotId}`, auth);
    }
  };

  const startEditing = (lot: Lot) => {
    setNewLotName(lot.name);
    setNewLotCultivo(lot.cultivo);
    setNewLotColor(lot.color);
    setNewLotPath(lot.path);
    setNewLotArea(lot.area || 0);
    setIsEditingMetadata(true);
    setIsAddingLot(true); // Reuse the form
  };

  const deleteLot = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este lote? Esta acción no se puede deshacer.')) return;
    
    setIsActionLoading(true);
    try {
      await deleteDoc(doc(db, 'farms', farmId, 'lots', id));
      setSelectedLot(null);
    } catch (error) {
      handleFirestoreError(error, 'delete', `farms/${id}/lots/${id}`, auth);
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-stone-900 tracking-tight">Potreros y Lotes</h2>
          <p className="text-stone-500 text-sm">Delimitación satelital y gestión de superficie</p>
        </div>
        {!isAddingLot && (
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-stone-200 shadow-sm">
             <Info className="w-4 h-4 text-emerald-600" />
             <span className="text-xs font-bold text-stone-600 uppercase tracking-widest">
               Usa el panel de dibujo para crear lotes
             </span>
          </div>
        )}
      </div>

      <div className="relative group">
        <div className="bg-stone-200 rounded-[2.5rem] p-1 shadow-inner overflow-hidden h-[600px] border border-stone-300">
          <MapContainer 
            center={defaultCenter} 
            zoom={14} 
            style={{ height: '100%', width: '100%' }}
            className="rounded-[2.4rem] z-0"
          >
            <TileLayer
              attribution='&copy; OpenStreetMap contributors, &copy; CartoDB'
              url="https://{s}.basemaps.cartocdn.com/voyager/{z}/{x}/{y}{r}.png"
              maxZoom={20}
              subdomains={['a', 'b', 'c', 'd']}
            />
            <GeomanHandler 
              onPolygonComplete={onPolygonComplete} 
              onPolygonEdit={onPolygonEdit}
              isEditActive={isGeometryEditActive}
            />
            <MapAutoCenter center={defaultCenter} lots={lots} />

            {lots.map(lot => (
              <Polygon
                key={lot.id}
                positions={lot.path as any}
                pathOptions={{
                  fillColor: lot.color,
                  fillOpacity: 0.4,
                  color: lot.color,
                  weight: 2,
                  id: lot.id
                } as any}
                eventHandlers={{
                  click: () => !isAddingLot && setSelectedLot(lot)
                }}
              >
                <Tooltip sticky permanent={false}>
                  <div className="text-xs font-bold">
                    {lot.name} ({lot.area?.toFixed(1)} ha)
                  </div>
                </Tooltip>
              </Polygon>
            ))}
          </MapContainer>
        </div>

        {/* Floating Lot Info Panel */}
        {selectedLot && (
          <div className="absolute top-6 right-6 z-[400] w-72 bg-white rounded-3xl shadow-2xl border border-stone-100 p-6 animate-in slide-in-from-right duration-300">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 rounded-2xl bg-stone-50">
                <Layers className="w-6 h-6" style={{ color: selectedLot.color }} />
              </div>
              <button 
                onClick={() => setSelectedLot(null)}
                className="p-2 hover:bg-stone-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-stone-400" />
              </button>
            </div>
            <h3 className="text-xl font-black text-stone-900 mb-1">{selectedLot.name}</h3>
            <div className="space-y-2 mb-6">
              <p className="text-stone-500 text-sm">Cultivo: <span className="font-bold text-stone-800">{selectedLot.cultivo || 'Sin rotación'}</span></p>
              {selectedLot.area && (
                <p className="text-stone-500 text-sm">Superficie: <span className="font-bold text-emerald-600 text-lg">{selectedLot.area.toFixed(2)} ha</span></p>
              )}
            </div>
            
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => startEditing(selectedLot)}
                  className="flex items-center justify-center gap-2 bg-stone-900 text-white font-bold py-3 rounded-2xl hover:bg-stone-800 transition-all shadow-sm text-sm"
                >
                  <Edit2 className="w-4 h-4" /> Datos
                </button>
                <button 
                  onClick={() => {
                    setIsGeometryEditActive(!isGeometryEditActive);
                    if (!isGeometryEditActive) setSelectedLot(null);
                  }}
                  className={`flex items-center justify-center gap-2 font-bold py-3 rounded-2xl transition-all shadow-sm text-sm ${isGeometryEditActive ? 'bg-emerald-600 text-white animate-pulse' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                >
                  <MapPin className="w-4 h-4" /> Forma
                </button>
              </div>
              <button 
                onClick={() => deleteLot(selectedLot.id)}
                className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 font-bold py-3 rounded-2xl hover:bg-red-100 transition-all shadow-sm text-sm"
              >
                <Trash2 className="w-4 h-4" /> Eliminar Lote
              </button>
            </div>
          </div>
        )}

        {/* Geometry Edit Help Overlay */}
        {isGeometryEditActive && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[400] bg-emerald-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-bounce">
            <Info className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-widest">
              Arrastra los puntos blancos para ajustar límites
            </span>
            <button 
              onClick={() => setIsGeometryEditActive(false)}
              className="ml-2 bg-white/20 hover:bg-white/40 p-1 rounded-full transition-colors"
            >
              <Check className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Adding / Editing Lot Panel */}
        {isAddingLot && (
          <div className="absolute inset-x-0 bottom-6 px-6 z-[400] flex justify-center">
            <div className={`max-w-xl w-full bg-white rounded-[2.5rem] shadow-2xl border-4 ${isEditingMetadata ? 'border-stone-900' : 'border-emerald-500'} p-8 animate-in slide-in-from-bottom duration-300`}>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-black text-stone-900 leading-tight">
                    {isEditingMetadata ? 'Editar Información' : 'Identificar Lote'}
                  </h3>
                  <p className="text-stone-500 text-sm">
                    {isEditingMetadata ? `Modificando ${selectedLot?.name}` : `Superficie detectada: ${newLotArea.toFixed(2)} ha`}
                  </p>
                </div>
                <button 
                  onClick={() => {
                    setIsAddingLot(false);
                    setIsEditingMetadata(false);
                    setNewLotName('');
                    setNewLotCultivo('');
                  }}
                  className="p-2 hover:bg-stone-100 rounded-full"
                >
                  <X className="w-5 h-5 text-stone-400" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-stone-400 uppercase ml-1">Nombre</span>
                  <input 
                    type="text" 
                    placeholder="Ej: Bajos 4" 
                    value={newLotName}
                    onChange={e => setNewLotName(e.target.value)}
                    className="w-full p-4 border-2 border-stone-100 bg-stone-50 rounded-2xl focus:border-emerald-500 outline-none transition-all font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-stone-400 uppercase ml-1">Rotación / Cultivo</span>
                  <input 
                    type="text" 
                    placeholder="Ej: Soja de 1ra" 
                    value={newLotCultivo}
                    onChange={e => setNewLotCultivo(e.target.value)}
                    className="w-full p-4 border-2 border-stone-100 bg-stone-50 rounded-2xl focus:border-emerald-500 outline-none transition-all font-bold"
                  />
                </div>
                <div className="flex items-center gap-4 md:col-span-2 bg-stone-50 p-4 rounded-2xl border-2 border-stone-100">
                  <span className="text-xs font-black text-stone-400 uppercase">Color en mapa:</span>
                  <div className="flex gap-3">
                    {['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#064e3b'].map(c => (
                      <button 
                        key={c}
                        onClick={() => setNewLotColor(c)}
                        className={`w-10 h-10 rounded-xl transition-all ${newLotColor === c ? 'scale-125 shadow-lg border-2 border-white ring-2 ring-stone-900' : 'opacity-60 grayscale-[0.5]'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <button 
                onClick={saveLot}
                disabled={!newLotName || isActionLoading}
                className={`w-full ${isEditingMetadata ? 'bg-stone-900' : 'bg-emerald-600'} text-white font-black py-5 rounded-3xl hover:opacity-90 transition-all shadow-xl disabled:opacity-30 uppercase tracking-widest text-sm flex items-center justify-center gap-2`}
              >
                {isActionLoading ? 'Cargando...' : (
                  <>
                    {isEditingMetadata ? <Check className="w-5 h-5" /> : null}
                    {isEditingMetadata ? 'Actualizar Información' : 'Guardar Lote e Inventario'}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stats Summary Overlay */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-stone-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Layers className="w-24 h-24" />
          </div>
          <p className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-1">Potreros Activos</p>
          <p className="text-3xl font-black text-stone-900">{lots.length}</p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-stone-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <MapPin className="w-24 h-24" />
          </div>
          <p className="text-[10px] font-black text-emerald-600/50 uppercase tracking-[0.2em] mb-1">Superficie Mapeada</p>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-black text-stone-900">
              {lots.reduce((sum, lot) => sum + (lot.area || 0), 0).toFixed(1)}
            </p>
            <span className="text-sm font-bold text-stone-400">hectáreas</span>
          </div>
        </div>
        <div className="bg-stone-900 p-6 rounded-[2rem] shadow-xl relative overflow-hidden ring-4 ring-stone-200">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Info className="w-24 h-24 text-emerald-400" />
          </div>
          <p className="text-[10px] font-black text-stone-500 uppercase tracking-[0.2em] mb-1">Estado Satelital</p>
          <p className="text-lg font-bold text-white flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            Vínculo Activo
          </p>
          <p className="text-[10px] text-stone-500 font-medium mt-1">Imágenes híbridas nivel 14</p>
        </div>
      </div>
    </div>
  );
}
