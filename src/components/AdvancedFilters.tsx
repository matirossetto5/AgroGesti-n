import React from 'react';
import { ChevronDown, X } from 'lucide-react';

interface AdvancedFiltersProps {
  isOpen: boolean;
  onToggle: () => void;
  filters: {
    status: string[];
    weightRange: [number, number];
    sex: string[];
    dateRange: [string, string];
  };
  onFiltersChange: (filters: any) => void;
  onReset: () => void;
}

export function AdvancedFilters({
  isOpen,
  onToggle,
  filters,
  onFiltersChange,
  onReset
}: AdvancedFiltersProps) {
  const STATUSES = ['Recría', 'Engorde'];
  const SEXES = ['Macho', 'Hembra', 'Mixto'];

  const handleStatusToggle = (status: string) => {
    const newStatuses = filters.status.includes(status)
      ? filters.status.filter(s => s !== status)
      : [...filters.status, status];
    onFiltersChange({ ...filters, status: newStatuses });
  };

  const handleSexToggle = (sex: string) => {
    const newSexes = filters.sex.includes(sex)
      ? filters.sex.filter(s => s !== sex)
      : [...filters.sex, sex];
    onFiltersChange({ ...filters, sex: newSexes });
  };

  const hasActiveFilters =
    filters.status.length > 0 ||
    filters.sex.length > 0 ||
    filters.weightRange[0] !== 50 ||
    filters.weightRange[1] !== 1000 ||
    filters.dateRange[0] !== '' ||
    filters.dateRange[1] !== '';

  return (
    <div className="space-y-4">
      {/* Filter Toggle Button */}
      <button
        onClick={onToggle}
        className="flex items-center gap-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-lg transition-colors"
      >
        <span>🔽 Filtros Avanzados</span>
        {hasActiveFilters && (
          <span className="ml-2 px-2 py-0.5 bg-emerald-500 text-white text-xs rounded-full font-bold">
            Activo
          </span>
        )}
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Filter Panel */}
      {isOpen && (
        <div className="p-6 bg-white rounded-xl border border-stone-200 shadow-sm space-y-6">
          {/* Estado Filter */}
          <div>
            <label className="block text-sm font-bold text-stone-700 mb-3">Estado</label>
            <div className="flex gap-3 flex-wrap">
              {STATUSES.map(status => (
                <button
                  key={status}
                  onClick={() => handleStatusToggle(status)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    filters.status.includes(status)
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                      : 'bg-stone-100 text-stone-700 border border-stone-200 hover:bg-stone-200'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* Sexo Filter */}
          <div>
            <label className="block text-sm font-bold text-stone-700 mb-3">Sexo</label>
            <div className="flex gap-3 flex-wrap">
              {SEXES.map(sex => (
                <button
                  key={sex}
                  onClick={() => handleSexToggle(sex)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    filters.sex.includes(sex)
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                      : 'bg-stone-100 text-stone-700 border border-stone-200 hover:bg-stone-200'
                  }`}
                >
                  {sex}
                </button>
              ))}
            </div>
          </div>

          {/* Weight Range Filter */}
          <div>
            <label className="block text-sm font-bold text-stone-700 mb-3">
              Rango de Peso: {filters.weightRange[0]} - {filters.weightRange[1]} kg
            </label>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-stone-600">Peso Mínimo</label>
                <input
                  type="range"
                  min="50"
                  max="1000"
                  value={filters.weightRange[0]}
                  onChange={(e) =>
                    onFiltersChange({
                      ...filters,
                      weightRange: [Number(e.target.value), filters.weightRange[1]]
                    })
                  }
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-xs text-stone-600">Peso Máximo</label>
                <input
                  type="range"
                  min="50"
                  max="1000"
                  value={filters.weightRange[1]}
                  onChange={(e) =>
                    onFiltersChange({
                      ...filters,
                      weightRange: [filters.weightRange[0], Number(e.target.value)]
                    })
                  }
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Date Range Filter */}
          <div>
            <label className="block text-sm font-bold text-stone-700 mb-3">Rango de Fechas</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-stone-600">Desde</label>
                <input
                  type="date"
                  value={filters.dateRange[0]}
                  onChange={(e) =>
                    onFiltersChange({
                      ...filters,
                      dateRange: [e.target.value, filters.dateRange[1]]
                    })
                  }
                  className="w-full p-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-stone-600">Hasta</label>
                <input
                  type="date"
                  value={filters.dateRange[1]}
                  onChange={(e) =>
                    onFiltersChange({
                      ...filters,
                      dateRange: [filters.dateRange[0], e.target.value]
                    })
                  }
                  className="w-full p-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Reset Button */}
          {hasActiveFilters && (
            <button
              onClick={onReset}
              className="w-full px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-700 font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" />
              Limpiar Filtros
            </button>
          )}
        </div>
      )}
    </div>
  );
}
