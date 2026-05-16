export interface User {
  id: string;
  password?: string;
  role: string;
  name: string;
}

export interface Part {
  id: string; // UUID
  material: string;
  part_no: string;
  location: string;
  zone: string;
  status: 'Not Counted' | 'Counted' | 'Verified';
  box_1: number | null;
  box_2: number | null;
  box_3: number | null;
  box_4: number | null;
  box_5: number | null;
  recount: number | null;
  last_updated: string;
  metadata?: Record<string, any>;
}
