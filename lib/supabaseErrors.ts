/** PostgREST / Supabase errors when migrations were never applied */
export function isSchemaNotReadyMessage(message: string): boolean {
  return (
    /PGRST205|PGRST202|schema cache|Could not find the table|Could not find the function/i.test(message)
  );
}

export function friendlySchemaError(): string {
  return 'Supabase has no tables yet. Open SQL Editor and run the full script in supabase/APPLY_ALL.sql (see README).';
}
