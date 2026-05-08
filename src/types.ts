export interface TropaEvent {
  id: string;
  date: string;
  type: 'Pesaje' | 'Medicación' | 'Control Veterinario' | 'Traslado' | 'Baja' | 'Compra' | 'Otro';
  description?: string;
  weightPerAnimal?: number;
  quantity?: number;
}

export interface RegistroRacion {
  id: string;
  date: string;
  siloMaiz: number;
  maizPartido: number;
  concentradoProteico: number;
  precioSiloMaiz?: number;
  precioMaizPartido?: number;
  precioConcentrado?: number;
  notes?: string;
}

export interface Tropa {
  id: string;
  name: string;
  sex: 'Macho' | 'Hembra';
  quantity: number;
  entryDate: string;
  entryWeight: number;
  currentWeight: number;
  status: 'Recría' | 'Terminación';
  terminationStartDate?: string;
  events: TropaEvent[];
  raciones?: RegistroRacion[];
  notes?: string;
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
