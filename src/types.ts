export interface HerdEvent {
  id: string;
  date: string;
  type: 'Medicación' | 'Pesaje' | 'Dieta' | 'Control Veterinario' | 'Otro';
  description?: string;
  dietDetails?: DietEvent;
}

export interface DietEvent {
  ingredients: DietIngredient[];
  totalCostPerDay: number;
  totalKgPerDay: number;
}

export interface DietIngredient {
  type: string;
  kg: number;
  pricePerKg: number;
  totalPrice: number;
}

export interface Herd {
  id: string;
  name: string;
  sex: 'Macho' | 'Hembra' | 'Mixto';
  quantity: number;
  weightPerAnimal: number;
  totalWeight: number;
  status: 'Recría' | 'Engorde';
  stage?: 'Iniciación' | 'Crecimiento' | 'Terminación';
  feedingPlan?: DietPlan;
  events: HerdEvent[];
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export interface DietPlan {
  id: string;
  herdId: string;
  name: string;
  ingredients: DietIngredient[];
  totalKgPerDay: number;
  totalCostPerDay: number;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignHarvest {
  id: string;
  campaign: string;
  year: number;
  lotId: string;
  lotName: string;
  crop: string;
  sowingDate: string;
  harvestDate?: string;
  area?: number;
  yield?: number;
  notes?: string;
}

export interface Lot {
  id: string;
  name: string;
  area?: number;
  campaigns?: CampaignHarvest[];
}
