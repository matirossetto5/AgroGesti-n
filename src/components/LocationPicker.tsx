import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Maximize2, Minimize2, MapPin } from 'lucide-react';

// Fix for default marker icon in React-Leaflet with Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface LocationPickerProps {
  coordinates: string;
  onChange?: (coords: string) => void;
  readOnly?: boolean;
}

function LocationMarker({ position, setPosition, readOnly }: { position: L.LatLng | null, setPosition: (pos: L.LatLng) => void, readOnly?: boolean }) {
  const map = useMapEvents({
    click(e) {
      if (readOnly) return;
      setPosition(e.latlng);
      map.flyTo(e.latlng, map.getZoom());
    },
  });

  return position === null ? null : (
    <Marker position={position}></Marker>
  );
}

function MapUpdater({ position }: { position: L.LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo(position, map.getZoom(), { animate: true, duration: 0.5 });
    }
  }, [position, map]);
  return null;
}

function MapResizer({ isExpanded }: { isExpanded: boolean }) {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 300);
    return () => clearTimeout(timer);
  }, [isExpanded, map]);
  return null;
}

export default function LocationPicker({ coordinates, onChange, readOnly = false }: LocationPickerProps) {
  const [position, setPosition] = useState<L.LatLng | null>(null);
  const [tempPosition, setTempPosition] = useState<L.LatLng | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Parse initial or typed coordinates
  useEffect(() => {
    if (coordinates) {
      const parts = coordinates.split(',').map(p => parseFloat(p.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        const newPos = new L.LatLng(parts[0], parts[1]);
        setPosition(newPos);
        setTempPosition(newPos);
      }
    } else {
      setPosition(null);
      setTempPosition(null);
    }
  }, [coordinates]);

  const handleMapClick = (pos: L.LatLng) => {
    if (readOnly) return;
    setTempPosition(pos);
  };

  const handleSave = () => {
    if (tempPosition && onChange) {
      onChange(`${tempPosition.lat.toFixed(6)}, ${tempPosition.lng.toFixed(6)}`);
      setPosition(tempPosition);
      if (isExpanded) setIsExpanded(false);
    }
  };

  const hasUnsavedChanges = tempPosition && (!position || tempPosition.lat !== position.lat || tempPosition.lng !== position.lng);

  const defaultCenter: [number, number] = [-34.6037, -58.3816];

  const mapContent = (
    <>
      {/* Toolbar */}
      <div className="absolute top-3 right-3 z-[400] flex flex-col gap-2">
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); setIsExpanded(!isExpanded); }}
          className="bg-white p-2.5 rounded-lg shadow-md hover:bg-stone-50 text-stone-700 transition-colors border border-stone-200"
          title={isExpanded ? "Reducir mapa" : "Expandir mapa"}
        >
          {isExpanded ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
        </button>
      </div>

      {!readOnly && hasUnsavedChanges && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[400]">
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); handleSave(); }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-full shadow-xl font-medium flex items-center gap-2 transition-transform hover:scale-105 border-2 border-white"
          >
            <MapPin className="w-5 h-5" />
            Guardar coordenadas
          </button>
        </div>
      )}

      <MapContainer 
        center={tempPosition || position || defaultCenter} 
        zoom={tempPosition || position ? 13 : 5} 
        scrollWheelZoom={true} 
        style={{ height: '100%', width: '100%', zIndex: 0 }}
      >
        {/* OpenStreetMap + CartoDB Layer (Detailed Maps) */}
        <TileLayer
          attribution='&copy; OpenStreetMap contributors, &copy; CartoDB'
          url="https://{s}.basemaps.cartocdn.com/voyager/{z}/{x}/{y}{r}.png"
          maxZoom={20}
          subdomains={['a', 'b', 'c', 'd']}
        />
        <LocationMarker position={tempPosition || position} setPosition={handleMapClick} readOnly={readOnly} />
        <MapUpdater position={tempPosition || position} />
        <MapResizer isExpanded={isExpanded} />
      </MapContainer>
    </>
  );

  if (isExpanded) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-black/70 backdrop-blur-sm">
        <div className="w-full h-full max-w-6xl bg-white rounded-xl shadow-2xl overflow-hidden relative flex flex-col">
          <div className="p-4 bg-stone-900 text-white flex justify-between items-center">
            <h3 className="font-medium flex items-center gap-2">
              <MapPin className="w-5 h-5 text-emerald-400" />
              {readOnly ? 'Ubicación del campo' : 'Seleccionar ubicación'}
            </h3>
            <button 
              onClick={(e) => { e.preventDefault(); setIsExpanded(false); }} 
              className="text-stone-300 hover:text-white p-1"
            >
              <Minimize2 className="w-6 h-6" />
            </button>
          </div>
          <div className="flex-1 relative">
            {mapContent}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-96 w-full rounded-lg overflow-hidden border border-stone-300 relative z-0">
      {mapContent}
    </div>
  );
}
