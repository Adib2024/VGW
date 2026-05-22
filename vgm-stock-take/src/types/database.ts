export interface User {
  id: string;
  password?: string;
  role: string;
  name: string;
}

export interface Part {
  id: string | number;
  status: 'Not Counted' | 'Counted' | 'Verified';
  batch_id?: string;
  verify_by?: string;
  metadata?: Record<string, any>;
  [key: string]: any; // Allow dynamic columns from CSV upload (e.g., material, rack, location, boxes, recounts, remarks)
}
