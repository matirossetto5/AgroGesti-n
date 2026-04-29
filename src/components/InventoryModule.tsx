import React, { useState } from 'react';
import { Plus, Trash2, Edit, AlertCircle } from 'lucide-react';
import { inventoryService, InventoryItem } from '../services';

interface InventoryModuleProps {
  farmId: string;
}

export default function InventoryModule({ farmId }: InventoryModuleProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [newItem, setNewItem] = useState({
    name: '',
    category: 'semillas' as const,
    quantity: '',
    unit: '',
    minThreshold: '',
    maxThreshold: '',
    expirationDate: ''
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  const alerts = items
    .map(item => inventoryService.validateInventoryLevel(item))
    .filter((alert): alert is any => alert !== null);

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name || !newItem.quantity || !newItem.unit) return;

    const item: InventoryItem = {
      id: Math.random().toString(36).substr(2, 9),
      name: newItem.name,
      category: newItem.category,
      quantity: Number(newItem.quantity),
      unit: newItem.unit,
      minThreshold: Number(newItem.minThreshold) || 10,
      maxThreshold: Number(newItem.maxThreshold) || 100,
      lastUpdated: new Date().toISOString(),
      expirationDate: newItem.expirationDate || undefined
    };

    setItems([...items, item]);
    setNewItem({
      name: '',
      category: 'semillas',
      quantity: '',
      unit: '',
      minThreshold: '',
      maxThreshold: '',
      expirationDate: ''
    });
  };

  const handleDeleteItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const categoryLabels = {
    semillas: '🌱 Semillas',
    fertilizantes: '🥗 Fertilizantes',
    medicinas: '💊 Medicinas',
    otros: '📦 Otros'
  };

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold text-stone-900 flex items-center gap-2 border-b pb-4">
        <span>📦 Gestión de Inventario</span>
      </h3>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-amber-800 font-semibold mb-2">
            <AlertCircle className="w-5 h-5" />
            Alertas de Inventario ({alerts.length})
          </div>
          {alerts.map((alert, idx) => (
            <div key={idx} className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm font-medium text-amber-900">{alert.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* Add Item Form */}
      <div className="bg-stone-50 rounded-xl border border-stone-200 p-4">
        <h4 className="font-semibold text-stone-800 mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Agregar Producto
        </h4>

        <form onSubmit={handleAddItem} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Nombre del producto"
              value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              className="px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              required
            />
            <select
              value={newItem.category}
              onChange={(e) => setNewItem({ ...newItem, category: e.target.value as any })}
              className="px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
            >
              <option value="semillas">Semillas</option>
              <option value="fertilizantes">Fertilizantes</option>
              <option value="medicinas">Medicinas</option>
              <option value="otros">Otros</option>
            </select>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <input
              type="number"
              placeholder="Cantidad"
              value={newItem.quantity}
              onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
              className="px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              required
            />
            <input
              type="text"
              placeholder="Unidad (kg, L, etc)"
              value={newItem.unit}
              onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
              className="px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              required
            />
            <input
              type="number"
              placeholder="Mín. Umbral"
              value={newItem.minThreshold}
              onChange={(e) => setNewItem({ ...newItem, minThreshold: e.target.value })}
              className="px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
            <input
              type="number"
              placeholder="Máx. Umbral"
              value={newItem.maxThreshold}
              onChange={(e) => setNewItem({ ...newItem, maxThreshold: e.target.value })}
              className="px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          <input
            type="date"
            placeholder="Fecha de vencimiento"
            value={newItem.expirationDate}
            onChange={(e) => setNewItem({ ...newItem, expirationDate: e.target.value })}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
          />

          <button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-3 rounded-lg transition-colors"
          >
            Agregar Producto
          </button>
        </form>
      </div>

      {/* Items List */}
      {items.length === 0 ? (
        <div className="text-center py-12 text-stone-500 bg-stone-50 rounded-lg border border-dashed border-stone-300">
          <p>No hay productos en el inventario</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => {
            const alert = alerts.find(a => a.itemId === item.id);
            return (
              <div
                key={item.id}
                className={`p-4 rounded-lg border flex justify-between items-start ${
                  alert ? 'bg-amber-50 border-amber-200' : 'bg-white border-stone-200'
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-start gap-2">
                    <span className="text-xl">{categoryLabels[item.category].split(' ')[0]}</span>
                    <div>
                      <p className="font-semibold text-stone-900">{item.name}</p>
                      <p className="text-xs text-stone-500">
                        {categoryLabels[item.category]} • {item.quantity} {item.unit}
                      </p>
                      {item.expirationDate && (
                        <p className="text-xs text-stone-500 mt-1">
                          Vence: {new Date(item.expirationDate).toLocaleDateString('es-AR')}
                        </p>
                      )}
                    </div>
                  </div>
                  {alert && (
                    <p className="text-xs text-amber-700 font-medium mt-2">⚠️ {alert.message}</p>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteItem(item.id)}
                  className="text-stone-400 hover:text-red-600 p-2"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
