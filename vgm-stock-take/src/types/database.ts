// Zone tables are generated from each uploaded spreadsheet's own headers
// (Admin → Parts upload), so their columns - material, rack, location,
// boxes, recounts, remarks... - differ per zone and aren't known at compile
// time. This is the one deliberate escape hatch for those dynamic values.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DynamicValue = any;

export interface Part {
  id: string | number;
  status: 'Not Counted' | 'Counted' | 'Verified';
  batch_id?: string;
  verify_by?: string;
  // Added by sql/008_activity_tracking.sql
  updated_at?: string | null;
  updated_by?: string | null;
  // Set client-side when rows from several zone tables are combined
  _table?: string;
  metadata?: Record<string, DynamicValue>;
  [key: string]: DynamicValue;
}
