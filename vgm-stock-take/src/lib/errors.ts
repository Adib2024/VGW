// Readable message from anything thrown or returned as an error (Error
// instances, Supabase/PostgREST error objects, strings).
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message);
  return err == null ? '' : String(err);
}
