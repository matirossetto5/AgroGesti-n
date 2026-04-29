export interface InventoryItem {
  id: string;
  name: string;
  category: 'semillas' | 'fertilizantes' | 'medicinas' | 'otros';
  quantity: number;
  unit: string;
  minThreshold: number;
  maxThreshold: number;
  lastUpdated: string;
  expirationDate?: string;
  supplier?: string;
  cost?: number;
}

export interface InventoryAlert {
  itemId: string;
  itemName: string;
  type: 'low' | 'expired' | 'overstock';
  message: string;
  severity: 'low' | 'medium' | 'high';
}

export interface InventoryMovement {
  id: string;
  itemId: string;
  type: 'entrada' | 'salida' | 'ajuste';
  quantity: number;
  date: string;
  reason: string;
  cost?: number;
}

export const inventoryService = {
  validateInventoryLevel(item: InventoryItem): InventoryAlert | null {
    if (item.quantity <= item.minThreshold) {
      return {
        itemId: item.id,
        itemName: item.name,
        type: 'low',
        message: `Stock bajo: ${item.name} (${item.quantity}/${item.minThreshold} ${item.unit})`,
        severity: item.quantity === 0 ? 'high' : 'medium'
      };
    }

    if (item.quantity >= item.maxThreshold * 1.1) {
      return {
        itemId: item.id,
        itemName: item.name,
        type: 'overstock',
        message: `Exceso de stock: ${item.name} (${item.quantity} ${item.unit})`,
        severity: 'low'
      };
    }

    if (item.expirationDate) {
      const expDate = new Date(item.expirationDate);
      const today = new Date();
      const daysUntilExpiry = Math.floor((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntilExpiry <= 0) {
        return {
          itemId: item.id,
          itemName: item.name,
          type: 'expired',
          message: `${item.name} ha expirado`,
          severity: 'high'
        };
      }

      if (daysUntilExpiry <= 7) {
        return {
          itemId: item.id,
          itemName: item.name,
          type: 'expired',
          message: `${item.name} vence en ${daysUntilExpiry} días`,
          severity: 'medium'
        };
      }
    }

    return null;
  },

  calculateReorderAmount(item: InventoryItem, dailyUsage: number = 1): number {
    const leadTime = 7; // Assume 7 days lead time
    const safetyStock = item.minThreshold;
    return (dailyUsage * leadTime) + safetyStock - item.quantity;
  },

  estimateInventoryCost(items: InventoryItem[]): number {
    return items.reduce((total, item) => {
      const itemCost = item.cost || 0;
      return total + (itemCost * item.quantity);
    }, 0);
  },

  getInventoryTurnover(movements: InventoryMovement[], costOfGoods: number, avgInventory: number): number {
    if (avgInventory === 0) return 0;
    return costOfGoods / avgInventory;
  },

  getCategoryTotals(items: InventoryItem[]): Record<string, number> {
    const totals: Record<string, number> = {
      semillas: 0,
      fertilizantes: 0,
      medicinas: 0,
      otros: 0
    };

    items.forEach(item => {
      totals[item.category] += item.quantity;
    });

    return totals;
  },

  recordMovement(
    itemId: string,
    type: 'entrada' | 'salida' | 'ajuste',
    quantity: number,
    reason: string,
    cost?: number
  ): InventoryMovement {
    return {
      id: Math.random().toString(36).substr(2, 9),
      itemId,
      type,
      quantity,
      date: new Date().toISOString(),
      reason,
      cost
    };
  },

  calculateItemMetrics(item: InventoryItem, movements: InventoryMovement[]) {
    const itemMovements = movements.filter(m => m.itemId === item.id);
    const totalUsed = itemMovements
      .filter(m => m.type === 'salida')
      .reduce((sum, m) => sum + m.quantity, 0);

    const lastMovement = itemMovements.sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0];

    return {
      daysInStock: lastMovement
        ? Math.floor((new Date().getTime() - new Date(lastMovement.date).getTime()) / (1000 * 60 * 60 * 24))
        : 0,
      totalUsed,
      avgDailyUsage: totalUsed > 0 ? totalUsed / 30 : 0
    };
  }
};
