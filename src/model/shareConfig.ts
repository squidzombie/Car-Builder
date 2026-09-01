// Share-link backend (M6, CLAUDE.md §9): Supabase storage holds card JSON
// + image assets; links are unlisted random ids. Fill these in from your
// Supabase project (Settings → API). The anon key is public by design.
//
// Setup (one-time, ~2 min):
//   1. supabase.com → New project
//   2. Storage → New bucket: name "cards", PUBLIC bucket ✓
//   3. Paste the Project URL and anon public key below
//   4. VIEWER_URL = wherever the web build is hosted (see ROADMAP)

export const SUPABASE_URL = ''
export const SUPABASE_ANON_KEY = ''
/** where the web viewer lives; share links are `${VIEWER_URL}/c/{id}` */
export const VIEWER_URL = ''

export const shareConfigured = (): boolean =>
  SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0
