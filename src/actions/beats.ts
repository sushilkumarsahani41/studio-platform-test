"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { ActionResponse } from "@/types";
import type { Database, Beat, BeatPurchase, LicenseType } from "@/types";
import { createCheckoutSession } from "@/lib/stripe";

export async function getPublishedBeats(): Promise<ActionResponse<Beat[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("beats")
    .select("*")
    .eq("is_published", true)
    .eq("is_exclusive_sold", false)
    .order("created_at", { ascending: false })
    .returns<Beat[]>();

  if (error) return { success: false, error: error.message };
  return { success: true, data: data ?? [] };
}

export async function getBeatBySlug(
  slug: string,
): Promise<ActionResponse<Beat>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("beats")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .single<Beat>();

  if (error || !data) return { success: false, error: "Beat introuvable" };
  return { success: true, data };
}

export async function incrementPlayCount(beatId: string): Promise<void> {
  const supabase = await createClient();
  // Fetch current count and increment
  const { data } = await supabase
    .from("beats")
    .select("play_count")
    .eq("id", beatId)
    .single<{ play_count: number }>();

  if (data) {
    await supabase
      .from("beats")
      .update({ play_count: data.play_count + 1 })
      .eq("id", beatId);
  }
}

export async function purchaseBeat(
  beatId: string,
  licenseType: LicenseType,
): Promise<ActionResponse<{ checkoutUrl: string }>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Connexion requise pour acheter" };
  }

  // Get beat details
  const { data: beat } = await supabase
    .from("beats")
    .select("*")
    .eq("id", beatId)
    .eq("is_published", true)
    .single<Beat>();

  if (!beat) {
    return { success: false, error: "Beat introuvable" };
  }

  if (beat.is_exclusive_sold) {
    return { success: false, error: "Ce beat a déjà été vendu en licence exclusive" };
  }

  // Determine price
  const price =
    licenseType === "exclusive" && beat.price_exclusive
      ? beat.price_exclusive
      : beat.price_simple;

  // Create purchase record (pending)
  const { data: purchase, error } = await supabase
    .from("beat_purchases")
    .insert({
      user_id: user.id,
      beat_id: beatId,
      license_type: licenseType,
      price_paid: price,
    })
    .select()
    .single<BeatPurchase>();

  if (error || !purchase) {
    return { success: false, error: "Erreur lors de la création de l'achat" };
  }

  // If exclusive, mark beat as sold
  if (licenseType === "exclusive") {
    await supabase
      .from("beats")
      .update({ is_exclusive_sold: true })
      .eq("id", beatId);
  }

  // Create Stripe checkout (mock)
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const session = await createCheckoutSession({
    amount: price,
    description: `${beat.title} — Licence ${licenseType === "exclusive" ? "Exclusive" : "Simple"}`,
    successUrl: `${origin}/beats/purchase/confirmation?purchase_id=${purchase.id}`,
    cancelUrl: `${origin}/beats/${beat.slug}`,
    metadata: {
      purchase_id: purchase.id,
      beat_id: beatId,
      license_type: licenseType,
    },
  });

  // TODO: Send receipt email via Resend

  return { success: true, data: { checkoutUrl: session.url } };
}

export async function getPurchaseById(
  purchaseId: string,
): Promise<ActionResponse<BeatPurchase & { beat_title: string; beat_slug: string }>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Non connecté" };
  }

  const { data: purchase } = await supabase
    .from("beat_purchases")
    .select("*")
    .eq("id", purchaseId)
    .eq("user_id", user.id)
    .single<BeatPurchase>();

  if (!purchase) {
    return { success: false, error: "Achat introuvable" };
  }

  const { data: beat } = await supabase
    .from("beats")
    .select("title, slug")
    .eq("id", purchase.beat_id)
    .single<{ title: string; slug: string }>();

  return {
    success: true,
    data: {
      ...purchase,
      beat_title: beat?.title ?? "Beat",
      beat_slug: beat?.slug ?? "",
    },
  };
}

// ── Beat download ──

export async function getBeatDownloadUrl(
  beatId: string,
): Promise<ActionResponse<{ url: string }>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non connecté" };

  // Verify purchase exists with confirmed payment
  const { data: purchase } = await supabase
    .from("beat_purchases")
    .select("id, stripe_payment_intent_id")
    .eq("beat_id", beatId)
    .eq("user_id", user.id)
    .not("stripe_payment_intent_id", "is", null)
    .limit(1)
    .maybeSingle();

  if (!purchase) {
    return { success: false, error: "Achat non trouvé" };
  }

  // Get beat's storage path
  const { data: beat } = await supabase
    .from("beats")
    .select("audio_full_url")
    .eq("id", beatId)
    .single<{ audio_full_url: string | null }>();

  if (!beat?.audio_full_url) {
    return { success: false, error: "Fichier audio introuvable" };
  }

  // Generate signed URL (15 minutes)
  const { data: signedUrl, error } = await supabase.storage
    .from("beat-files")
    .createSignedUrl(beat.audio_full_url, 900);

  if (error || !signedUrl) {
    return { success: false, error: "Impossible de générer le lien de téléchargement" };
  }

  return { success: true, data: { url: signedUrl.signedUrl } };
}

// ── Beatmaker management ──

export async function getMyBeats(): Promise<ActionResponse<Beat[]>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non connecté" };

  const { data, error } = await supabase
    .from("beats")
    .select("*")
    .eq("beatmaker_id", user.id)
    .order("created_at", { ascending: false })
    .returns<Beat[]>();

  if (error) return { success: false, error: error.message };
  return { success: true, data: data ?? [] };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function createBeat(input: {
  title: string;
  bpm: number;
  key: string;
  genre: string;
  tags: string[];
  priceSimple: number;
  priceExclusive: number | null;
}): Promise<ActionResponse<Beat>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non connecté" };

  if (!input.title.trim()) return { success: false, error: "Le titre est requis" };
  if (input.priceSimple < 1) return { success: false, error: "Le prix simple doit être positif" };

  const slug = slugify(input.title) + "-" + Date.now().toString(36);

  const { data, error } = await supabase
    .from("beats")
    .insert({
      beatmaker_id: user.id,
      title: input.title.trim(),
      slug,
      bpm: input.bpm,
      key: input.key,
      genre: input.genre,
      tags: input.tags,
      price_simple: input.priceSimple,
      price_exclusive: input.priceExclusive,
      is_published: false,
      is_exclusive_sold: false,
    })
    .select()
    .single<Beat>();

  if (error || !data) return { success: false, error: error?.message ?? "Erreur" };
  return { success: true, data };
}

const PREVIEW_SECONDS = 30;

/**
 * Trim audio file to ~30 seconds for the public preview.
 * WAV: precise binary slice (header + 30s of PCM data).
 * MP3/FLAC/AIFF: proportional byte slice (approximate but safe — never exposes full track).
 */
async function trimAudioTo30s(file: File, ext: string): Promise<Buffer> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (ext === ".wav") {
    // WAV files can have variable-length headers with extra chunks (LIST, JUNK, etc.)
    // We must walk the RIFF chunks to find the exact start of the 'data' chunk
    // and read the byte rate from the 'fmt ' chunk.

    let byteRate = 0;
    let dataChunkOffset = -1;
    let dataChunkSize = 0;

    // Start after RIFF header (12 bytes: "RIFF", size, "WAVE")
    let offset = 12;
    while (offset < buffer.length - 8) {
      const chunkId = buffer.toString("ascii", offset, offset + 4);
      const chunkSize = buffer.readUInt32LE(offset + 4);

      if (chunkId === "fmt ") {
        // fmt chunk data layout: AudioFormat(2), NumChannels(2), SampleRate(4), ByteRate(4)...
        // ByteRate is at offset+8 (chunk data start) + 8 = offset+16
        byteRate = buffer.readUInt32LE(offset + 8 + 8);
      } else if (chunkId === "data") {
        dataChunkOffset = offset + 8; // audio data starts here
        dataChunkSize = chunkSize;
        break;
      }

      // Move to next chunk (chunk data + padding byte if odd size)
      offset += 8 + chunkSize + (chunkSize % 2);
    }

    if (dataChunkOffset === -1 || byteRate === 0) {
      // Couldn't parse — return full file
      return buffer;
    }

    const previewBytes = byteRate * PREVIEW_SECONDS;
    const trimmedDataSize = Math.min(previewBytes, dataChunkSize);
    const outputSize = dataChunkOffset + trimmedDataSize;

    const trimmed = Buffer.alloc(outputSize);
    // Copy everything up to (but not including) the data chunk content
    buffer.copy(trimmed, 0, 0, dataChunkOffset);
    // Copy the trimmed audio data
    buffer.copy(trimmed, dataChunkOffset, dataChunkOffset, dataChunkOffset + trimmedDataSize);

    // Update data chunk size
    trimmed.writeUInt32LE(trimmedDataSize, dataChunkOffset - 4);
    // Update RIFF chunk size (total file size - 8)
    trimmed.writeUInt32LE(outputSize - 8, 4);

    return trimmed;
  }

  // For compressed formats: estimate duration from bitrate and slice proportionally
  // This gives an approximate 30s clip from the start of the file
  const fileSizeBytes = buffer.length;
  // Assume typical bitrates: MP3 ~192-320kbps, FLAC ~800-1400kbps, AIFF ~1411kbps
  // We estimate total duration and take the first 30s proportion
  const estimatedBitrate = ext === ".mp3" ? 256000 : ext === ".flac" ? 1000000 : 1411000; // bits/sec
  const estimatedByterate = estimatedBitrate / 8;
  const estimatedDuration = fileSizeBytes / estimatedByterate;

  if (estimatedDuration <= PREVIEW_SECONDS) {
    // File is shorter than 30s, return as-is
    return buffer;
  }

  const ratio = PREVIEW_SECONDS / estimatedDuration;
  const previewEndByte = Math.ceil(fileSizeBytes * ratio);
  return Buffer.from(buffer.buffer, buffer.byteOffset, previewEndByte);
}

const AUDIO_EXTENSIONS = [".wav", ".mp3", ".aiff", ".flac"];
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const MAX_AUDIO_SIZE = 200 * 1024 * 1024; // 200MB
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

const VALID_AUDIO_MIMES = ["audio/wav", "audio/x-wav", "audio/mpeg", "audio/mp3", "audio/aiff", "audio/x-aiff", "audio/flac"];
const VALID_IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"];

function getExtension(filename: string): string {
  const parts = filename.split(".");
  if (parts.length < 2) return "";
  return "." + parts.pop()!.toLowerCase();
}

export async function createBeatWithFiles(
  formData: FormData,
): Promise<ActionResponse<Beat>> {
  // Use anon client for auth check
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non connecté" };

  // Use service role client for DB/storage (bypasses RLS after manual auth check)
  const serviceClient = createServiceClient();

  // Verify user has beatmaker/engineer/admin role
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string }>();

  if (!profile || !["beatmaker", "engineer", "admin"].includes(profile.role)) {
    return { success: false, error: "Rôle non autorisé pour uploader des beats" };
  }

  // Extract files and metadata
  const audioFile = formData.get("audio") as File | null;
  const coverFile = formData.get("cover") as File | null;
  const metadataRaw = formData.get("metadata") as string | null;

  if (!audioFile || !coverFile || !metadataRaw) {
    return { success: false, error: "Fichiers audio, image et métadonnées requis" };
  }

  // Validate files (extension + MIME type)
  const audioExt = getExtension(audioFile.name);
  if (!audioExt || !AUDIO_EXTENSIONS.includes(audioExt)) {
    return { success: false, error: `Format audio non supporté : ${audioExt || "inconnu"}` };
  }
  if (!VALID_AUDIO_MIMES.includes(audioFile.type)) {
    return { success: false, error: `Type MIME audio non supporté : ${audioFile.type}` };
  }
  if (audioFile.size > MAX_AUDIO_SIZE) {
    return { success: false, error: "Fichier audio trop volumineux (max 200 Mo)" };
  }

  const coverExt = getExtension(coverFile.name);
  if (!coverExt || !IMAGE_EXTENSIONS.includes(coverExt)) {
    return { success: false, error: `Format image non supporté : ${coverExt || "inconnu"}` };
  }
  if (!VALID_IMAGE_MIMES.includes(coverFile.type)) {
    return { success: false, error: `Type MIME image non supporté : ${coverFile.type}` };
  }
  if (coverFile.size > MAX_IMAGE_SIZE) {
    return { success: false, error: "Image trop volumineuse (max 10 Mo)" };
  }

  // Parse & validate metadata
  let metadata: {
    title: string;
    bpm: number;
    key: string;
    genre: string;
    tags: string[];
    priceSimple: number;
    priceExclusive: number | null;
  };
  try {
    metadata = JSON.parse(metadataRaw);
  } catch {
    return { success: false, error: "Métadonnées invalides" };
  }

  if (!metadata.title?.trim()) return { success: false, error: "Le titre est requis" };
  if (metadata.priceSimple < 1) return { success: false, error: "Le prix simple doit être positif" };

  const slug = slugify(metadata.title) + "-" + Date.now().toString(36);

  // Step 1: Insert beat record
  const { data: beat, error: insertError } = await serviceClient
    .from("beats")
    .insert({
      beatmaker_id: user.id,
      title: metadata.title.trim(),
      slug,
      bpm: metadata.bpm,
      key: metadata.key,
      genre: metadata.genre,
      tags: metadata.tags,
      price_simple: metadata.priceSimple,
      price_exclusive: metadata.priceExclusive,
      is_published: false,
      is_exclusive_sold: false,
    })
    .select()
    .single<Beat>();

  if (insertError || !beat) {
    return { success: false, error: insertError?.message ?? "Erreur création beat" };
  }

  const basePath = `${user.id}/${beat.id}`;

  try {
    // Step 2: Upload cover image to beat-previews
    const coverPath = `${basePath}/cover${coverExt}`;
    const { error: coverErr } = await serviceClient.storage
      .from("beat-previews")
      .upload(coverPath, coverFile, { upsert: true });
    if (coverErr) throw new Error(`Cover upload: ${coverErr.message}`);

    // Step 3: Upload full audio to beat-files (private)
    const audioPath = `${basePath}/audio${audioExt}`;
    const { error: audioErr } = await serviceClient.storage
      .from("beat-files")
      .upload(audioPath, audioFile, { upsert: true });
    if (audioErr) throw new Error(`Audio upload: ${audioErr.message}`);

    // Step 4: Generate 30s preview and upload to beat-previews (public)
    const previewBuffer = await trimAudioTo30s(audioFile, audioExt);
    const previewPath = `${basePath}/preview${audioExt}`;
    const { error: previewErr } = await serviceClient.storage
      .from("beat-previews")
      .upload(previewPath, previewBuffer, {
        upsert: true,
        contentType: audioFile.type,
      });
    if (previewErr) throw new Error(`Preview upload: ${previewErr.message}`);

    // Step 5: Get public URLs
    const { data: coverUrl } = serviceClient.storage
      .from("beat-previews")
      .getPublicUrl(coverPath);
    const { data: previewUrl } = serviceClient.storage
      .from("beat-previews")
      .getPublicUrl(previewPath);

    // Step 6: Update beat record with URLs
    const { data: updatedBeat, error: updateErr } = await serviceClient
      .from("beats")
      .update({
        cover_image_url: coverUrl.publicUrl,
        audio_preview_url: previewUrl.publicUrl,
        audio_full_url: audioPath, // Store path for signed URL generation
      })
      .eq("id", beat.id)
      .select()
      .single<Beat>();

    if (updateErr || !updatedBeat) {
      throw new Error(updateErr?.message ?? "Erreur mise à jour beat");
    }

    return { success: true, data: updatedBeat };
  } catch (err) {
    // Cleanup on failure: delete beat record and any uploaded files
    try {
      await serviceClient.from("beats").delete().eq("id", beat.id);
      await serviceClient.storage.from("beat-previews").remove([
        `${basePath}/cover${coverExt}`,
        `${basePath}/preview${audioExt}`,
      ]);
      await serviceClient.storage.from("beat-files").remove([
        `${basePath}/audio${audioExt}`,
      ]);
    } catch (cleanupErr) {
      console.error("[createBeatWithFiles] Cleanup failed for beat", beat.id, cleanupErr);
    }

    const message = err instanceof Error ? err.message : "Erreur upload";
    return { success: false, error: message };
  }
}

export async function updateBeat(
  beatId: string,
  input: {
    title?: string;
    bpm?: number;
    key?: string;
    genre?: string;
    tags?: string[];
    priceSimple?: number;
    priceExclusive?: number | null;
  },
): Promise<ActionResponse<Beat>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non connecté" };

  const updateData: Database["public"]["Tables"]["beats"]["Update"] = {};
  if (input.title !== undefined) updateData.title = input.title.trim();
  if (input.bpm !== undefined) updateData.bpm = input.bpm;
  if (input.key !== undefined) updateData.key = input.key;
  if (input.genre !== undefined) updateData.genre = input.genre;
  if (input.tags !== undefined) updateData.tags = input.tags;
  if (input.priceSimple !== undefined) updateData.price_simple = input.priceSimple;
  if (input.priceExclusive !== undefined) updateData.price_exclusive = input.priceExclusive;

  const { data, error } = await supabase
    .from("beats")
    .update(updateData)
    .eq("id", beatId)
    .eq("beatmaker_id", user.id)
    .select()
    .single<Beat>();

  if (error || !data) return { success: false, error: error?.message ?? "Erreur" };
  return { success: true, data };
}

export async function toggleBeatPublish(
  beatId: string,
  publish: boolean,
): Promise<ActionResponse> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non connecté" };

  const { error } = await supabase
    .from("beats")
    .update({ is_published: publish })
    .eq("id", beatId)
    .eq("beatmaker_id", user.id);

  if (error) return { success: false, error: error.message };
  return { success: true, data: undefined };
}

// ── Beatmaker sales tracking ──

export interface BeatSale {
  id: string;
  beat_title: string;
  license_type: LicenseType;
  price_paid: number;
  created_at: string;
  buyer_name: string; // anonymized
}

export interface BeatmakerSalesData {
  totalSold: number;
  totalRevenue: number;
  salesByBeat: { title: string; count: number; revenue: number }[];
  recentSales: BeatSale[];
}

export async function getBeatmakerSales(): Promise<ActionResponse<BeatmakerSalesData>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non connecté" };

  // Get all beats by this beatmaker
  const { data: myBeats } = await supabase
    .from("beats")
    .select("id, title")
    .eq("beatmaker_id", user.id)
    .returns<{ id: string; title: string }[]>();

  if (!myBeats || myBeats.length === 0) {
    return {
      success: true,
      data: { totalSold: 0, totalRevenue: 0, salesByBeat: [], recentSales: [] },
    };
  }

  const beatIds = myBeats.map((b) => b.id);
  const beatTitleMap = new Map(myBeats.map((b) => [b.id, b.title]));

  // Get all purchases for these beats
  const { data: purchases } = await supabase
    .from("beat_purchases")
    .select("id, beat_id, license_type, price_paid, created_at, user_id")
    .in("beat_id", beatIds)
    .order("created_at", { ascending: false })
    .returns<{
      id: string;
      beat_id: string;
      license_type: LicenseType;
      price_paid: number;
      created_at: string;
      user_id: string;
    }[]>();

  const sales = purchases ?? [];

  // Summary
  const totalSold = sales.length;
  const totalRevenue = sales.reduce((sum, s) => sum + s.price_paid, 0);

  // Sales by beat
  const byBeat = new Map<string, { count: number; revenue: number }>();
  for (const sale of sales) {
    const existing = byBeat.get(sale.beat_id) ?? { count: 0, revenue: 0 };
    byBeat.set(sale.beat_id, {
      count: existing.count + 1,
      revenue: existing.revenue + sale.price_paid,
    });
  }
  const salesByBeat = Array.from(byBeat.entries()).map(([beatId, data]) => ({
    title: beatTitleMap.get(beatId) ?? "Beat",
    count: data.count,
    revenue: data.revenue,
  }));

  // Recent sales (anonymized buyer)
  const recentSales: BeatSale[] = sales.slice(0, 20).map((s) => ({
    id: s.id,
    beat_title: beatTitleMap.get(s.beat_id) ?? "Beat",
    license_type: s.license_type,
    price_paid: s.price_paid,
    created_at: s.created_at,
    buyer_name: `Client ${s.user_id.slice(0, 4)}***`,
  }));

  return { success: true, data: { totalSold, totalRevenue, salesByBeat, recentSales } };
}

// ── Favorites ──

export async function addBeatToFavorites(
  beatId: string,
): Promise<ActionResponse> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Connexion requise" };

  const { error } = await supabase
    .from("beat_favorites")
    .insert({ user_id: user.id, beat_id: beatId });

  if (error) {
    // Unique constraint violation = already favorited, treat as success
    if (error.code === "23505") return { success: true, data: undefined };
    return { success: false, error: error.message };
  }
  return { success: true, data: undefined };
}

export async function removeBeatFromFavorites(
  beatId: string,
): Promise<ActionResponse> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Connexion requise" };

  const { error } = await supabase
    .from("beat_favorites")
    .delete()
    .eq("user_id", user.id)
    .eq("beat_id", beatId);

  if (error) return { success: false, error: error.message };
  return { success: true, data: undefined };
}

export async function getMyFavoriteIds(): Promise<ActionResponse<string[]>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: true, data: [] };

  const { data, error } = await supabase
    .from("beat_favorites")
    .select("beat_id")
    .eq("user_id", user.id);

  if (error) return { success: true, data: [] };
  return { success: true, data: (data ?? []).map((r) => r.beat_id) };
}

export async function getMyFavorites(): Promise<ActionResponse<Beat[]>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Connexion requise" };

  const { data: favorites, error } = await supabase
    .from("beat_favorites")
    .select("beat_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return { success: false, error: error.message };
  if (!favorites || favorites.length === 0) return { success: true, data: [] };

  const beatIds = favorites.map((f) => f.beat_id);
  const { data: beats, error: beatsError } = await supabase
    .from("beats")
    .select("*")
    .in("id", beatIds)
    .returns<Beat[]>();

  if (beatsError) return { success: false, error: beatsError.message };
  return { success: true, data: beats ?? [] };
}
