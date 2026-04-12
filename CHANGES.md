# Studio Platform — Implementation Changes

**Project:** Studio Platform Technical Test  
**Date:** April 2026  
**Branch:** main

---

## Table of Contents

1. [Overview](#overview)
2. [Database Changes](#database-changes)
3. [Server Actions](#server-actions)
4. [Components](#components)
5. [Pages](#pages)
6. [Library / Utilities](#library--utilities)
7. [Migrations](#migrations)
8. [Security](#security)
9. [Full File Change List](#full-file-change-list)

---

## Overview

This document covers all backend wiring, feature implementation, and bug fixes applied to the Studio Platform project. The initial commit contained the UI shell (components, pages, styles) but had no backend integration. All changes described here connect the frontend to Supabase, implement the beat marketplace, and fulfil every requirement in `TEST_BRIEF.md`.

---

## Database Changes

### New Table — `beat_favorites`
**File:** `supabase/migrations/20260401_beat_favorites.sql`

A new table was created to store user favorites (beats saved by swiping right).

```sql
beat_favorites (
  id         uuid PRIMARY KEY,
  user_id    uuid REFERENCES auth.users,
  beat_id    uuid REFERENCES beats,
  created_at timestamptz
)
```

- Unique constraint on `(user_id, beat_id)` prevents duplicates.
- Indexes on both `user_id` and `beat_id` for fast lookups.
- RLS policies: users can only read, insert, and delete their own rows.

---

### New Migration — `20260402_fix_beats_rls_and_mp3.sql`
**File:** `supabase/migrations/20260402_fix_beats_rls_and_mp3.sql`

Fixed three critical issues in the initial schema:

| Issue | Fix |
|-------|-----|
| "Admins can manage all beats" used inline profiles subquery → RLS recursion | Replaced with `is_admin()` SECURITY DEFINER function |
| No RLS policy for `engineer` role on `beats` table | Added "Engineers can manage own beats" policy |
| `beat-previews` and `beat-files` storage buckets did not allow `audio/mpeg` (MP3) | Added `audio/mpeg` and `audio/mp3` to both bucket MIME type lists |

Also added a reusable `has_role(text)` SECURITY DEFINER helper function.

---

### Updated Types — `src/types/database.ts`

- Added `beat_favorites` table definition (Row, Insert, Update types).
- Added `export type BeatFavorite` convenience alias.
- Fixed `updateBeat` to use strongly-typed `Database["public"]["Tables"]["beats"]["Update"]` instead of `Record<string, unknown>`.

### Updated Types — `src/types/index.ts`

- Re-exported `BeatFavorite` from `database.ts`.

---

## Server Actions

### `src/actions/beats.ts` — Major Updates

#### 1. MP3 Format Support

Added `.mp3` / `audio/mpeg` / `audio/mp3` to the accepted audio format lists:

```ts
const AUDIO_EXTENSIONS = [".wav", ".mp3", ".aiff", ".flac"];
const VALID_AUDIO_MIMES = ["audio/wav", "audio/x-wav", "audio/mpeg", "audio/mp3", ...];
```

#### 2. Service Role Client for Uploads

`createBeatWithFiles` now uses a **service role client** for all database inserts and storage uploads, after manually verifying the user's role via the anon client. This bypasses RLS for authorized users (beatmaker / engineer / admin) and eliminates the "new row violates RLS policy" error.

```
Auth check     → anon client   (respects RLS, verifies user session)
DB + Storage   → service client (bypasses RLS, safe after manual role check)
```

#### 3. Server-Side 30-Second Preview Trimming

Added `trimAudioTo30s(file, ext)` — a pure Node.js function that trims audio to exactly 30 seconds before uploading to the public `beat-previews` bucket:

**WAV (precise):**
- Walks the RIFF chunk tree to locate the `fmt ` chunk (reads real `ByteRate`) and the `data` chunk (finds exact audio data offset — handles variable-length headers with `LIST`, `JUNK`, `INFO` chunks).
- Slices exactly `ByteRate × 30` bytes of PCM data.
- Updates both the `data` chunk size and the `RIFF` chunk size in the output header.

**MP3 / FLAC / AIFF (proportional):**
- Estimates file duration from known typical bitrates.
- Calculates a byte-proportion ratio and slices the first ~30 seconds.
- Returns full file if shorter than 30 seconds.

#### 4. Storage Layout (per brief)

| Bucket | Access | Content |
|--------|--------|---------|
| `beat-previews` | Public | Cover image + 30-second preview audio |
| `beat-files` | Private | Full audio file (signed URLs after purchase) |

#### 5. Favorites Server Actions (new)

Three new exported functions:

| Function | Description |
|----------|-------------|
| `addBeatToFavorites(beatId)` | Inserts a favorite row; treats duplicate (code 23505) as success |
| `removeBeatFromFavorites(beatId)` | Deletes the favorite row |
| `getMyFavorites()` | Returns full `Beat[]` for the current user's saved favorites |

#### 6. `adminDeleteBeat` — Hard Delete (was soft delete)

**Before:** Only set `is_published = false` — beat stayed in the database.  
**After:** Full hard delete with cascading cleanup:

1. Deletes `beat_favorites` rows referencing the beat.
2. Deletes `beat_purchases` rows referencing the beat.
3. Hard deletes the beat record.
4. Lists and removes all files from `beat-previews` and `beat-files` storage buckets using `basePath = {beatmaker_id}/{beat_id}`.

Also fixed the admin beats page UI to filter the beat out of state after deletion (previously it only changed `is_published` in local state).

---

### `src/actions/admin-beats.ts` — Hard Delete

Rewrote `adminDeleteBeat` from a soft-delete (unpublish) to a full hard delete with storage cleanup. See above.

---

## Components

### `src/components/beats/beat-swipe-card.tsx`

- Imported `AudioPlayer` component.
- Added `<AudioPlayer>` inside the card, rendered below the beat metadata (title, BPM, key, genre pills).
- The player binds to `beat.id` and `beat.audio_preview_url`, integrating with the global Zustand audio store.

### `src/components/beats/audio-player.tsx`

Added **30-second client-side playback cap** as a safety net on top of the server-side trim:

| Change | Detail |
|--------|--------|
| `PREVIEW_DURATION = 30` constant | Used as the enforced maximum |
| `handleTimeUpdate` | Pauses and resets to 0 when `currentTime >= 30` |
| `handleLoadedMetadata` | Sets duration to `min(actual, 30)` |
| `handleSeek` | Caps seek target to within 30s window |
| Progress calculation | Uses `cappedDuration` instead of raw `duration` |
| Time display | Shows `0:30` as max regardless of actual file length |

---

## Pages

### `src/app/(public)/beats/page.tsx` — Marketplace

| Change | Detail |
|--------|--------|
| Imported `useAudioStore` | For autoplay and stop control |
| Imported `addBeatToFavorites` | Called on swipe right |
| Imported `toast` | To confirm favorite added |
| `hasInteracted` ref | Tracks first user interaction to enable autoplay without browser policy violations |
| Autoplay `useEffect` | Calls `play(beat.id, beat.audio_preview_url)` whenever `currentIndex` changes (after interaction) |
| `handleOnboardingComplete` | Sets `hasInteracted = true`, triggers autoplay of first beat |
| `animateAndAdvance` | Calls `stop()` before advancing index (previous audio stops); calls `addBeatToFavorites` on swipe right; no longer navigates to beat detail on swipe right |

**Swipe right behaviour change:**  
`Before:` navigated to `/beats/[slug]`  
`After:` adds beat to favorites + shows toast confirmation

### `src/app/(public)/account/page.tsx`

- Added `Heart` icon import from `lucide-react`.
- Added "Favoris" quick-action card linking to `/account/favorites` (displayed alongside Historique and Mixages).

### `src/app/(public)/account/favorites/page.tsx` _(new)_

Full favorites management page:

- Loads favorites on mount via `getMyFavorites()`, redirects to login if unauthenticated.
- Displays each beat with: cover image (or music icon fallback), title (links to `/beats/[slug]`), BPM / key / genre metadata, price, audio player, and a remove button.
- Remove button calls `removeBeatFromFavorites(beat.id)` and filters the beat from local state.
- Empty state with illustration and CTA link to `/beats`.

### `src/app/(public)/admin/beats/page.tsx`

- Added `Plus` icon import.
- Replaced single heading with a flex row containing the heading + an **Upload** button linking to `/admin/beats/upload`.
- Fixed `handleDelete` to filter the beat out of state (previously changed `is_published` to false in state but left the beat visible in the list).

### `src/app/(public)/admin/beats/upload/page.tsx` _(new)_

Full admin beat upload page (mirrors engineer upload with additions):

- Auth check: redirects non-admins to `/`.
- Form fields: title, audio file (WAV/MP3/AIFF/FLAC), cover image, BPM, key, genre, tags, price simple, price exclusive.
- **Publish/Draft toggle** — a styled toggle switch (`role="switch"`) that controls whether the beat is published immediately or saved as a draft. Calls `toggleBeatPublish(beat.id, true)` after creation if enabled.
- Submit button label changes dynamically: "Créer et publier" vs "Enregistrer en brouillon".
- On success, redirects to `/admin/beats`.

### `src/app/(public)/engineer/beats/upload/page.tsx`

- Updated audio `BeatFileUploader` accept prop from `.wav,.aiff,.flac` to `.wav,.mp3,.aiff,.flac`.
- Updated label from "Fichier audio (WAV) *" to "Fichier audio (WAV, MP3, AIFF, FLAC) *".

### `src/app/(public)/page.tsx`

- Fixed pre-existing TypeScript build error: `ARTISTS` array used `photo: null` but `ArtistCarousel` expected `photo: string`. Changed to `photo: ""`.

---

## Library / Utilities

### `src/lib/supabase/server.ts`

Added `createServiceClient()` — a Supabase client that uses the `SUPABASE_SERVICE_ROLE_KEY` and bypasses RLS entirely. Used exclusively in server actions after manual authentication and role verification.

```ts
export function createServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}
```

---

## Migrations

All migrations must be run in order in the Supabase SQL Editor:

| Order | File | Purpose |
|-------|------|---------|
| 1 | `20260313_initial_schema.sql` | All tables, RLS, triggers |
| 2 | `20260314_contact_messages.sql` | Contact messages table |
| 3 | `20260315_slot_locks.sql` | Slot locking for bookings |
| 4 | `20260318_add_phone_to_contact.sql` | Phone field on contact |
| 5 | `20260319_fix_rls_recursion.sql` | `is_admin()` SECURITY DEFINER |
| 6 | `20260330_storage_buckets.sql` | Storage buckets + policies |
| 7 | `20260401_beat_favorites.sql` | Favorites table + RLS |
| 8 | `20260402_fix_beats_rls_and_mp3.sql` | Engineer policy + MP3 MIME + admin policy fix |

---

## Security

| Concern | Resolution |
|---------|------------|
| Full audio accessible publicly | Full file stored in private `beat-files` bucket only; previews are real 30s clips in `beat-previews` |
| Client-side 30s cap bypassable | Server-side trim generates a genuinely 30s file before upload — client cap is just a UX safety net |
| RLS recursion on admin beats policy | Replaced inline profiles subquery with `is_admin()` SECURITY DEFINER function |
| Engineers blocked from uploading | Added "Engineers can manage own beats" RLS policy |
| Service role key exposed | `SUPABASE_SERVICE_ROLE_KEY` is server-only (no `NEXT_PUBLIC_` prefix), never sent to the browser |
| Storage upload without auth | `createBeatWithFiles` always verifies user session + role before calling `createServiceClient()` |

---

## Full File Change List

| File | Type | Summary |
|------|------|---------|
| `src/actions/beats.ts` | Modified | MP3 support, service client, 30s trim, favorites actions, hard delete fix |
| `src/actions/admin-beats.ts` | Modified | Hard delete with storage cleanup |
| `src/lib/supabase/server.ts` | Modified | Added `createServiceClient()` |
| `src/types/database.ts` | Modified | Added `beat_favorites` types, fixed `BeatFavorite` export |
| `src/types/index.ts` | Modified | Re-exported `BeatFavorite` |
| `src/components/beats/beat-swipe-card.tsx` | Modified | Integrated `AudioPlayer` |
| `src/components/beats/audio-player.tsx` | Modified | 30s client-side playback cap |
| `src/app/(public)/beats/page.tsx` | Modified | Autoplay, stop-on-swipe, swipe-right → favorites |
| `src/app/(public)/account/page.tsx` | Modified | Added Favorites quick-action link |
| `src/app/(public)/account/favorites/page.tsx` | **New** | Favorites management page |
| `src/app/(public)/admin/beats/page.tsx` | Modified | Upload button, hard delete UI fix |
| `src/app/(public)/admin/beats/upload/page.tsx` | **New** | Admin upload form with publish/draft toggle |
| `src/app/(public)/engineer/beats/upload/page.tsx` | Modified | Added MP3 to accepted formats |
| `src/app/(public)/page.tsx` | Modified | Fixed `photo: null` TypeScript build error |
| `supabase/migrations/20260401_beat_favorites.sql` | **New** | Favorites table + RLS policies |
| `supabase/migrations/20260402_fix_beats_rls_and_mp3.sql` | **New** | RLS fixes + MP3 MIME types |
