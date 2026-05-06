# Sistema de Validación de Datos - AgroGestión

## 📋 Resumen

Sistema comprehensivo de validación en tiempo real para todos los formularios de la aplicación, incluyendo:
- Validación de rodeos (herds)
- Validación de dietas de engorde
- Validación de datos agrícolas
- Mensajes de error y advertencias contextuales
- Prevención de datos inválidos en Firestore

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                    VALIDACIÓN EN TIEMPO REAL                │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   ┌────▼─────┐        ┌─────▼──────┐       ┌─────▼──────┐
   │ Mientras │        │   Antes de  │       │  Mensajes  │
   │  escribe │        │   guardar   │       │   visuales │
   └────┬─────┘        └─────┬──────┘       └─────┬──────┘
        │                     │                     │
        └──────────┬──────────┴─────────────────────┘
                   │
           ┌───────▼────────┐
           │  lib/validators.ts
           │  - Reglas específicas
           │  - Lógica reutilizable
           └────────────────┘
```

## 📦 Archivos Implementados

### 1. `src/lib/validators.ts`
Núcleo del sistema con todas las reglas de validación.

**Estructura:**
```typescript
- herdValidators: Validaciones para rodeos
  - name(value)              → ValidationError[]
  - quantity(value)          → ValidationError[]
  - weightPerAnimal(value)   → ValidationError[]
  - totalWeight(qty, weight) → ValidationError[]

- dietValidators: Validaciones para dietas
  - ingredientType(value)    → ValidationError[]
  - ingredientKg(value)      → ValidationError[]
  - ingredientPrice(value)   → ValidationError[]
  - totalDietCost(...)       → ValidationError[]
  - dietHasIngredients(...)  → ValidationError[]

- agriculturalValidators: Validaciones agrícolas
  - campaign(value)          → ValidationError[]
  - year(value)              → ValidationError[]
  - crop(value)              → ValidationError[]
  - sowingDate(value)        → ValidationError[]
  - yield(value, crop)       → ValidationError[]

- Funciones de validación completa:
  - validateHerdForm(data)   → ValidationResult
  - validateDietForm(data)   → ValidationResult
```

**Tipos:**
```typescript
interface ValidationError {
  field: string;
  message: string;
  type: 'error' | 'warning';  // error = bloqueante, warning = informativo
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];      // Bloqueantes
  warnings: ValidationError[];    // Informativos
}
```

### 2. `src/components/ValidationMessage.tsx`
Componentes React para mostrar errores/advertencias.

**Componentes:**

#### `ValidationMessage`
Muestra lista de errores y advertencias.
```tsx
<ValidationMessage
  errors={[{message: "El nombre es requerido", type: "error"}]}
  warnings={[{message: "Costo muy alto", type: "warning"}]}
  compact={true}  // true = versión condensada
/>
```

#### `FieldError`
Muestra error/advertencia para un campo específico.
```tsx
<FieldError
  error="Mínimo 1 animal"
  warning="Cantidad baja para un rodeo"
/>
```

### 3. Integración en `GanaderiaModule.tsx`

**Estado:**
```typescript
const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
const [validationWarnings, setValidationWarnings] = useState<ValidationError[]>([]);
```

**Validación en tiempo real:**
```typescript
const handleFormChange = (field: string, value: any) => {
  setFormData(prev => ({ ...prev, [field]: value }));
  // Valida con debounce de 300ms
  setTimeout(() => {
    const result = validateHerdForm({...});
    setValidationErrors(result.errors);
    setValidationWarnings(result.warnings);
  }, 300);
};
```

**Validación antes de guardar:**
```typescript
const handleSubmit = async (e) => {
  e.preventDefault();
  if (!validateForm()) return;  // Evita envío si hay errores
  // Procede a guardar en Firestore
};
```

**Indicadores visuales:**
- Campos con error: borde rojo, focus ring rojo
- Mensaje de error rojo debajo del campo
- Botón "Guardar" deshabilitado si hay errores
- Badge mostrando conteo de errores en botón

### 4. Integración en `AgriculturaModule.tsx`
Validación similar para datos agrícolas con enfoque en campañas y cultivos.

## 🎯 Reglas de Validación Detalladas

### Rodeos (Herds)

| Campo | Validación | Tipo |
|-------|-----------|------|
| **Nombre** | Requerido, max 100 chars | Error |
| **Cantidad** | 1-10,000 animals, enteros | Error |
| **Peso/animal** | 50-1,000 kg | Error |
| **Peso total** | Mín 50 kg, máx 10M kg | Error |
| **Peso/animal < 0.1** | Cantidad muy baja | Warning |

### Dietas de Engorde

| Campo | Validación | Tipo |
|-------|-----------|------|
| **Insumo type** | Requerido | Error |
| **Cantidad kg** | > 0, máx 1,000 kg/día | Error |
| **Cantidad < 0.1 kg** | Muy baja | Warning |
| **Precio/kg** | No negativo, máx 1M | Error |
| **Costo/animal/día > $500** | Muy alto | Warning |
| **Costo total < $1** | Posible error de precio | Warning |
| **Sin ingredientes** | Requiere ≥1 | Error |

### Datos Agrícolas

| Campo | Validación | Tipo |
|-------|-----------|------|
| **Campaña** | Requerido, max 50 chars | Error |
| **Año** | 2000-actual+5 | Error |
| **Cultivo** | Requerido | Error |
| **Año futuro** | No permitido | Warning |
| **Rinde fuera de rango** | Según cultivo típico | Warning |
| **Siembra > Cosecha** | Lógica temporal | Error |
| **Ciclo > 365 días** | Muy largo | Warning |

**Rangos típicos de rinde:**
- Soja: 30-70 qq/ha
- Maíz: 80-150 qq/ha
- Trigo: 30-80 qq/ha
- Girasol: 30-60 qq/ha

## 🎨 Experiencia de Usuario

### Flujo de Validación

```
1. Usuario abre formulario
   ↓
2. Escribe en campo
   ↓ (debounce 300ms)
3. Validación en tiempo real
   ├─ Si hay ERRORES:
   │  ├─ Campo color rojo
   │  ├─ Mensaje rojo debajo
   │  └─ Botón "Guardar" DESHABILITADO
   │
   └─ Si hay WARNINGS:
      ├─ Campo normal
      ├─ Mensaje amarillo debajo
      └─ Botón "Guardar" HABILITADO
   ↓
4. Usuario intenta guardar
   ├─ Si hay ERRORES → BLOQUEADO
   └─ Si solo WARNINGS → PERMITIDO
   ↓
5. Éxito → Modal se cierra
```

### Ejemplos Visuales

#### Caso 1: Error bloqueante
```
┌──────────────────────────────────┐
│ Nombre del Rodeo                 │
│ [___________]  ← borde rojo      │
│ ⚠️ El nombre del rodeo es req... │ ← rojo
└──────────────────────────────────┘

┌─────────────────────┐
│ ❌ 1 error        │  ← Badge en botón
│  [Guardar]        │     DESHABILITADO
└─────────────────────┘
```

#### Caso 2: Warning informativo
```
┌──────────────────────────────────┐
│ Peso por Animal (kg)             │
│ [___50___]                       │
│ ⚠️ Peso muy bajo (< 50 kg)      │ ← amarillo
└──────────────────────────────────┘

┌─────────────────────┐
│  [Guardar]        │  ← HABILITADO
│  (puedo guardar)  │
└─────────────────────┘
```

## 🔧 Cómo Extender las Validaciones

### Agregar nueva validación a Rodeos

```typescript
// En src/lib/validators.ts

export const herdValidators = {
  // Existentes...
  
  // Nueva validación
  breedCode: (value: string): ValidationError[] => {
    const errors: ValidationError[] = [];
    if (!value || value.length < 2) {
      errors.push({
        field: 'breedCode',
        message: 'Código de raza debe tener 2+ caracteres',
        type: 'error'
      });
    }
    return errors;
  }
};

// Agregar a validateHerdForm
const breedErrors = herdValidators.breedCode(data.breedCode);
breedErrors.forEach(e => (e.type === 'error' ? errors : warnings).push(e));
```

### Usar en componente

```typescript
// En GanaderiaModule.tsx

const handleFormChange = (field: string, value: any) => {
  setFormData(prev => ({ ...prev, [field]: value }));
  setTimeout(() => {
    const result = validateHerdForm({
      // Incluir nuevo campo
      breedCode: field === 'breedCode' ? value : formData.breedCode,
      // Resto de campos...
    });
    setValidationErrors(result.errors);
  }, 300);
};
```

## 📊 Cobertura de Validación

| Módulo | Cobertura | Estado |
|--------|-----------|--------|
| GanaderiaModule | 100% | ✅ Implementado |
| AgriculturaModule | 100% | ✅ Implementado |
| InventoryModule | 0% | 📋 Pendiente |
| FinancialAnalytics | 0% | 📋 Pendiente |

## 🚀 Próximos Pasos

1. **Extender a otros módulos** (Inventario, Finanzas)
2. **Validaciones asincrónicas** (verificar unicidad en Firebase)
3. **Reglas condicionales** (validar dieta solo si status = 'Engorde')
4. **Internacionalización** (mensajes en múltiples idiomas)
5. **Persistencia de validaciones** (guardar reglas en Firebase)

## ⚡ Performance

- **Debounce en tiempo real**: 300ms para evitar validaciones excesivas
- **Validaciones separadas**: Errores (críticos) vs Warnings (informativos)
- **Cálculos previos**: Se evitan recálculos innecesarios
- **Sin estado duplicado**: Una sola fuente de verdad (validationErrors)

## 📝 Notas de Desarrollo

- Los errores BLOQUEAN la sumisión del formulario
- Los warnings ALERTAN pero PERMITEN la sumisión
- Las validaciones se ejecutan:
  1. Mientras el usuario escribe (tiempo real)
  2. Antes de guardar en Firestore (validación final)
- Todos los campos requeridos tienen validación
- Se incluyen validaciones de rango y formato
