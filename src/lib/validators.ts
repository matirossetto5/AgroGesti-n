export interface ValidationError {
  field: string;
  message: string;
  type: 'error' | 'warning';
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export const herdValidators = {
  name: (value: string): ValidationError[] => {
    const errors: ValidationError[] = [];
    if (!value || value.trim().length === 0) {
      errors.push({ field: 'name', message: 'El nombre de la tropa es requerido', type: 'error' });
    }
    if (value.length > 100) {
      errors.push({ field: 'name', message: 'El nombre no puede exceder 100 caracteres', type: 'error' });
    }
    return errors;
  },

  quantity: (value: string | number): ValidationError[] => {
    const errors: ValidationError[] = [];
    const num = Number(value);

    if (!value || isNaN(num)) {
      errors.push({ field: 'quantity', message: 'La cantidad es requerida y debe ser un número', type: 'error' });
      return errors;
    }

    if (num < 1) {
      errors.push({ field: 'quantity', message: 'Mínimo 1 animal', type: 'error' });
    }

    if (num > 10000) {
      errors.push({ field: 'quantity', message: 'Máximo 10,000 animales', type: 'error' });
    }

    if (!Number.isInteger(num)) {
      errors.push({ field: 'quantity', message: 'La cantidad debe ser un número entero', type: 'error' });
    }

    return errors;
  },

  weightPerAnimal: (value: string | number): ValidationError[] => {
    const errors: ValidationError[] = [];
    const num = Number(value);

    if (!value || isNaN(num)) {
      errors.push({ field: 'weightPerAnimal', message: 'El peso es requerido y debe ser un número', type: 'error' });
      return errors;
    }

    if (num < 50) {
      errors.push({ field: 'weightPerAnimal', message: 'Peso mínimo: 50 kg', type: 'error' });
    }

    if (num > 1000) {
      errors.push({ field: 'weightPerAnimal', message: 'Peso máximo: 1,000 kg', type: 'error' });
    }

    return errors;
  },

  totalWeight: (quantity: number, weight: number): ValidationError[] => {
    const errors: ValidationError[] = [];
    const total = quantity * weight;

    if (total < 50) {
      errors.push({ field: 'totalWeight', message: 'Peso total muy bajo (mínimo 50 kg)', type: 'error' });
    }

    if (total > 10000000) {
      errors.push({ field: 'totalWeight', message: 'Peso total muy alto (máximo 10M kg)', type: 'error' });
    }

    return errors;
  }
};

export const dietValidators = {
  ingredientType: (value: string): ValidationError[] => {
    const errors: ValidationError[] = [];
    if (!value || value.trim().length === 0) {
      errors.push({ field: 'ingredientType', message: 'Tipo de insumo requerido', type: 'error' });
    }
    return errors;
  },

  ingredientKg: (value: string | number, quantity?: number): ValidationError[] => {
    const errors: ValidationError[] = [];
    const num = Number(value);

    if (!value || isNaN(num)) {
      errors.push({ field: 'ingredientKg', message: 'Cantidad en kg requerida', type: 'error' });
      return errors;
    }

    if (num <= 0) {
      errors.push({ field: 'ingredientKg', message: 'Debe ser mayor a 0 kg', type: 'error' });
    }

    if (num > 1000) {
      errors.push({ field: 'ingredientKg', message: 'Máximo 1,000 kg por día', type: 'error' });
    }

    // Advertencia si es muy poco
    if (num < 0.1) {
      errors.push({ field: 'ingredientKg', message: 'Cantidad muy baja (< 0.1 kg)', type: 'warning' });
    }

    return errors;
  },

  ingredientPrice: (value: string | number): ValidationError[] => {
    const errors: ValidationError[] = [];
    const num = Number(value);

    if (!value || isNaN(num)) {
      errors.push({ field: 'ingredientPrice', message: 'Precio requerido', type: 'error' });
      return errors;
    }

    if (num < 0) {
      errors.push({ field: 'ingredientPrice', message: 'El precio no puede ser negativo', type: 'error' });
    }

    if (num > 1000000) {
      errors.push({ field: 'ingredientPrice', message: 'Precio demasiado alto', type: 'error' });
    }

    return errors;
  },

  totalDietCost: (totalCost: number, quantity: number): ValidationError[] => {
    const errors: ValidationError[] = [];
    const costPerAnimal = totalCost / quantity;

    // Advertencia si costo es muy alto
    if (costPerAnimal > 500) {
      errors.push({
        field: 'dietCost',
        message: `Costo por animal muy alto: $${costPerAnimal.toFixed(2)}/día`,
        type: 'warning'
      });
    }

    // Advertencia si costo es muy bajo (posible error)
    if (totalCost > 0 && totalCost < 1) {
      errors.push({
        field: 'dietCost',
        message: 'Costo diario muy bajo - verificar precios',
        type: 'warning'
      });
    }

    return errors;
  },

  dietHasIngredients: (ingredients: any[]): ValidationError[] => {
    const errors: ValidationError[] = [];

    if (!ingredients || ingredients.length === 0) {
      errors.push({ field: 'diet', message: 'La dieta debe tener al menos un insumo', type: 'error' });
    }

    return errors;
  }
};

export const agriculturalValidators = {
  campaign: (value: string): ValidationError[] => {
    const errors: ValidationError[] = [];
    if (!value || value.trim().length === 0) {
      errors.push({ field: 'campaign', message: 'Nombre de campaña requerido', type: 'error' });
    }
    if (value.length > 50) {
      errors.push({ field: 'campaign', message: 'Campaña no puede exceder 50 caracteres', type: 'error' });
    }
    return errors;
  },

  year: (value: string | number): ValidationError[] => {
    const errors: ValidationError[] = [];
    const num = Number(value);
    const currentYear = new Date().getFullYear();

    if (!value || isNaN(num)) {
      errors.push({ field: 'year', message: 'Año requerido', type: 'error' });
      return errors;
    }

    if (num < 2000) {
      errors.push({ field: 'year', message: 'Año mínimo: 2000', type: 'error' });
    }

    if (num > currentYear + 5) {
      errors.push({ field: 'year', message: `Año máximo: ${currentYear + 5}`, type: 'error' });
    }

    return errors;
  },

  crop: (value: string): ValidationError[] => {
    const errors: ValidationError[] = [];
    if (!value || value.trim().length === 0) {
      errors.push({ field: 'crop', message: 'Cultivo requerido', type: 'error' });
    }
    return errors;
  },

  sowingDate: (value: string, harvestDate?: string): ValidationError[] => {
    const errors: ValidationError[] = [];

    if (!value) {
      errors.push({ field: 'sowingDate', message: 'Fecha de siembra requerida', type: 'error' });
      return errors;
    }

    const sowing = new Date(value);
    const today = new Date();

    if (sowing > today) {
      errors.push({ field: 'sowingDate', message: 'La fecha de siembra no puede ser futura', type: 'warning' });
    }

    if (harvestDate) {
      const harvest = new Date(harvestDate);
      if (harvest <= sowing) {
        errors.push({ field: 'sowingDate', message: 'Siembra debe ser antes de cosecha', type: 'error' });
      }

      // Calcular días entre siembra y cosecha
      const days = Math.floor((harvest.getTime() - sowing.getTime()) / (1000 * 60 * 60 * 24));
      if (days > 365) {
        errors.push({ field: 'sowingDate', message: 'Ciclo demasiado largo (> 365 días)', type: 'warning' });
      }
    }

    return errors;
  },

  yield: (value: string | number, crop?: string): ValidationError[] => {
    const errors: ValidationError[] = [];
    const num = Number(value);

    if (!value || isNaN(num)) {
      errors.push({ field: 'yield', message: 'Rinde requerido', type: 'error' });
      return errors;
    }

    if (num < 0) {
      errors.push({ field: 'yield', message: 'El rinde no puede ser negativo', type: 'error' });
    }

    // Rangos típicos por cultivo
    const typicalRanges: Record<string, [number, number]> = {
      'soja': [30, 70],
      'maíz': [80, 150],
      'trigo': [30, 80],
      'girasol': [30, 60]
    };

    const cropLower = crop?.toLowerCase() || '';
    for (const [cropType, [min, max]] of Object.entries(typicalRanges)) {
      if (cropLower.includes(cropType) && (num < min || num > max)) {
        errors.push({
          field: 'yield',
          message: `Rinde atípico para ${cropType} (típico: ${min}-${max} qq/ha)`,
          type: 'warning'
        });
      }
    }

    return errors;
  }
};

export function validateHerdForm(data: {
  name: string;
  quantity: string | number;
  weightPerAnimal: string | number;
  status: string;
}): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Validar cada campo
  const nameErrors = herdValidators.name(data.name);
  const quantityErrors = herdValidators.quantity(data.quantity);
  const weightErrors = herdValidators.weightPerAnimal(data.weightPerAnimal);

  // Separar errores y advertencias
  nameErrors.forEach(e => (e.type === 'error' ? errors : warnings).push(e));
  quantityErrors.forEach(e => (e.type === 'error' ? errors : warnings).push(e));
  weightErrors.forEach(e => (e.type === 'error' ? errors : warnings).push(e));

  // Validar peso total si no hay errores previos
  if (quantityErrors.filter(e => e.type === 'error').length === 0 &&
      weightErrors.filter(e => e.type === 'error').length === 0) {
    const totalErrors = herdValidators.totalWeight(Number(data.quantity), Number(data.weightPerAnimal));
    totalErrors.forEach(e => (e.type === 'error' ? errors : warnings).push(e));
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export function validateDietForm(data: {
  ingredients: any[];
  quantity: number;
}): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Validar que haya ingredientes
  const dietErrors = dietValidators.dietHasIngredients(data.ingredients);
  dietErrors.forEach(e => (e.type === 'error' ? errors : warnings).push(e));

  if (data.ingredients.length > 0) {
    // Validar cada ingrediente
    let totalCost = 0;
    data.ingredients.forEach((ing, idx) => {
      const typeErrors = dietValidators.ingredientType(ing.type);
      const kgErrors = dietValidators.ingredientKg(ing.kg);
      const priceErrors = dietValidators.ingredientPrice(ing.pricePerKg);

      typeErrors.forEach(e => (e.type === 'error' ? errors : warnings).push(e));
      kgErrors.forEach(e => (e.type === 'error' ? errors : warnings).push(e));
      priceErrors.forEach(e => (e.type === 'error' ? errors : warnings).push(e));

      totalCost += (ing.kg * ing.pricePerKg) || 0;
    });

    // Validar costo total
    const costErrors = dietValidators.totalDietCost(totalCost, data.quantity);
    costErrors.forEach(e => (e.type === 'error' ? errors : warnings).push(e));
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}
