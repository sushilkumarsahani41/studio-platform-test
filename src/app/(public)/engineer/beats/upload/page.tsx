"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createBeatWithFiles } from "@/actions/beats";
import { BeatFileUploader } from "@/components/beats/beat-file-uploader";
import { toast } from "@/components/ui/toaster";

const GENRES = [
  "Trap", "Drill", "Afro", "R&B", "Pop", "Lo-fi",
  "Boom Bap", "Cloud", "Dancehall", "Reggaeton", "Autre",
];

const KEYS = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
  "Cm", "C#m", "Dm", "D#m", "Em", "Fm", "F#m", "Gm", "G#m", "Am", "A#m", "Bm",
];

export default function BeatUploadPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [bpm, setBpm] = useState(140);
  const [key, setKey] = useState("Cm");
  const [genre, setGenre] = useState("Trap");
  const [tags, setTags] = useState("");
  const [priceSimple, setPriceSimple] = useState(35);
  const [priceExclusive, setPriceExclusive] = useState(199);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = "Le titre est requis";
    if (!audioFile) newErrors.audio = "Le fichier audio est requis";
    if (!coverFile) newErrors.cover = "L'image de couverture est requise";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setPending(true);

    const formData = new FormData();
    formData.append("audio", audioFile!);
    formData.append("cover", coverFile!);
    formData.append(
      "metadata",
      JSON.stringify({
        title: title.trim(),
        bpm,
        key,
        genre,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        priceSimple,
        priceExclusive: priceExclusive > 0 ? priceExclusive : null,
      }),
    );

    const result = await createBeatWithFiles(formData);

    if (!result.success) {
      setErrors({ form: result.error });
      setPending(false);
      return;
    }

    toast({
      title: "Beat créé !",
      description: "Ton beat a été uploadé et enregistré en brouillon.",
      variant: "success",
    });

    router.push("/engineer/beats");
  }

  return (
    <div className="mx-auto max-w-[600px] px-4 py-12 md:px-6 md:py-20">
      <Link
        href="/engineer/beats"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Mes beats
      </Link>

      <h1 className="font-display text-2xl font-bold md:text-3xl">
        Upload un beat
      </h1>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        {/* Title */}
        <div>
          <label htmlFor="title" className="mb-1.5 block text-sm font-medium">
            Titre du beat *
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Midnight Flow"
            className="w-full rounded-lg border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted transition-colors focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
          {errors.title && (
            <p className="mt-1 text-sm text-error">{errors.title}</p>
          )}
        </div>

        {/* Audio file */}
        <BeatFileUploader
          label="Fichier audio (WAV, MP3, AIFF, FLAC) *"
          accept=".wav,.mp3,.aiff,.flac"
          maxSizeMb={200}
          file={audioFile}
          onFileChange={setAudioFile}
        />
        {errors.audio && <p className="-mt-3 text-sm text-error">{errors.audio}</p>}

        {/* Cover image */}
        <BeatFileUploader
          label="Image de couverture *"
          accept=".jpg,.jpeg,.png,.webp"
          maxSizeMb={10}
          file={coverFile}
          onFileChange={setCoverFile}
        />
        {errors.cover && <p className="-mt-3 text-sm text-error">{errors.cover}</p>}

        {/* BPM + Key */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="bpm" className="mb-1.5 block text-sm font-medium">
              BPM *
            </label>
            <input
              id="bpm"
              type="number"
              min={40}
              max={300}
              value={bpm}
              onChange={(e) => setBpm(parseInt(e.target.value) || 140)}
              className="w-full rounded-lg border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary transition-colors focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
          <div>
            <label htmlFor="key" className="mb-1.5 block text-sm font-medium">
              Tonalité *
            </label>
            <select
              id="key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="w-full rounded-lg border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary transition-colors focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              {KEYS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Genre */}
        <div>
          <label htmlFor="genre" className="mb-1.5 block text-sm font-medium">
            Genre *
          </label>
          <select
            id="genre"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            className="w-full rounded-lg border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary transition-colors focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          >
            {GENRES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        {/* Tags */}
        <div>
          <label htmlFor="tags" className="mb-1.5 block text-sm font-medium">
            Tags
          </label>
          <input
            id="tags"
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="dark, melodic, piano (séparés par des virgules)"
            className="w-full rounded-lg border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted transition-colors focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>

        {/* Pricing */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="priceSimple"
              className="mb-1.5 block text-sm font-medium"
            >
              Prix licence simple (€) *
            </label>
            <input
              id="priceSimple"
              type="number"
              min={1}
              value={priceSimple}
              onChange={(e) => setPriceSimple(parseInt(e.target.value) || 1)}
              className="w-full rounded-lg border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary transition-colors focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
          <div>
            <label
              htmlFor="priceExclusive"
              className="mb-1.5 block text-sm font-medium"
            >
              Prix licence exclusive (€)
            </label>
            <input
              id="priceExclusive"
              type="number"
              min={0}
              value={priceExclusive}
              onChange={(e) =>
                setPriceExclusive(parseInt(e.target.value) || 0)
              }
              className="w-full rounded-lg border border-border-subtle bg-bg-elevated px-4 py-2.5 text-sm text-text-primary transition-colors focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
            <p className="mt-1 text-xs text-text-muted">
              0 = pas de licence exclusive
            </p>
          </div>
        </div>

        {errors.form && <p className="text-sm text-error">{errors.form}</p>}

        {/* Submit */}
        <div className="flex gap-3">
          <Link
            href="/engineer/beats"
            className="flex-1 rounded-lg border border-border-default px-6 py-3 text-center text-sm font-medium text-text-primary transition-colors hover:bg-bg-hover"
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={pending}
            className="flex-1 rounded-lg bg-brand-gradient px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Création..." : "Enregistrer en brouillon"}
          </button>
        </div>
      </form>
    </div>
  );
}
