"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Music } from "lucide-react";
import { getPublishedBeats, addBeatToFavorites, getMyFavoriteIds } from "@/actions/beats";
import { BeatSwipeCard } from "@/components/beats/beat-swipe-card";
import { BeatsOnboarding } from "@/components/beats/beats-onboarding";
import { MOCK_BEATS } from "@/lib/mock-beats";
import { useAudioStore } from "@/stores/audio-store";
import { toast } from "@/components/ui/toaster";
import { createClient } from "@/lib/supabase/client";
import type { Beat } from "@/types";

export default function BeatsPage() {
  const router = useRouter();
  const [beats, setBeats] = useState<Beat[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [isAuthed, setIsAuthed] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [exitDirection, setExitDirection] = useState<"left" | "right" | null>(null);
  const animatingRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const hasInteracted = useRef(false);
  const { play, stop } = useAudioStore();

  useEffect(() => {
    // Check localStorage after mount (avoids SSR/hydration mismatch)
    if (!localStorage.getItem("studio_beats_onboarded")) {
      setShowOnboarding(true);
    } else {
      // User already completed onboarding in a previous session
      hasInteracted.current = true;
    }

    async function load() {
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getUser();
      const authed = !!authData.user;
      setIsAuthed(authed);

      const beatsResult = await getPublishedBeats();
      if (beatsResult.success && beatsResult.data.length > 0) {
        setBeats(beatsResult.data);
      } else {
        setBeats(MOCK_BEATS);
      }

      if (authed) {
        const favsResult = await getMyFavoriteIds();
        if (favsResult.success && favsResult.data.length > 0) {
          setFavoriteIds(new Set(favsResult.data));
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  // Autoplay when the active beat changes (after user has interacted with the page)
  useEffect(() => {
    if (!hasInteracted.current || beats.length === 0 || currentIndex >= beats.length) return;
    const beat = beats[currentIndex];
    if (beat.audio_preview_url) {
      play(beat.id, beat.audio_preview_url);
    }
  }, [currentIndex, beats, play]);

  const handleOnboardingComplete = useCallback(() => {
    localStorage.setItem("studio_beats_onboarded", "true");
    hasInteracted.current = true;
    setShowOnboarding(false);
    // Autoplay the first beat after onboarding
    if (beats.length > 0 && beats[currentIndex]?.audio_preview_url) {
      play(beats[currentIndex].id, beats[currentIndex].audio_preview_url!);
    }
  }, [beats, currentIndex, play]);

  const animateAndAdvance = useCallback(
    (direction: "left" | "right") => {
      if (animatingRef.current) return;

      // Swipe right requires authentication — redirect instead of consuming the swipe
      if (direction === "right" && !isAuthed) {
        toast({
          title: "Connexion requise",
          description: "Connecte-toi pour ajouter des beats à tes favoris.",
          variant: "default",
        });
        router.push("/login?redirect=/beats");
        return;
      }

      hasInteracted.current = true;
      animatingRef.current = true;
      // Stop current audio — autoplay effect will start the next beat
      stop();
      setExitDirection(direction);

      // Add to favorites on swipe right (skip if already favorited)
      if (direction === "right" && beats[currentIndex]) {
        const beatId = beats[currentIndex].id;
        if (!favoriteIds.has(beatId)) {
          setFavoriteIds((prev) => new Set(prev).add(beatId));
          addBeatToFavorites(beatId).then((result) => {
            if (result.success) {
              toast({ title: "Ajouté aux favoris", variant: "success" });
            }
          });
        } else {
          toast({ title: "Déjà dans tes favoris", variant: "success" });
        }
      }

      setTimeout(() => {
        setCurrentIndex((i) => i + 1);
        setExitDirection(null);
        animatingRef.current = false;
      }, 400);
    },
    [stop, beats, currentIndex, favoriteIds, isAuthed, router],
  );

  const handleSwipeLeft = useCallback(() => {
    animateAndAdvance("left");
  }, [animateAndAdvance]);

  const handleSwipeRight = useCallback(() => {
    animateAndAdvance("right");
  }, [animateAndAdvance]);

  if (loading) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center">
        <div className="h-64 w-64 animate-pulse rounded-2xl bg-bg-surface" />
      </div>
    );
  }

  // Empty state
  if (beats.length === 0) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 text-center">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-bg-surface">
          <Music className="h-10 w-10 text-text-muted" />
        </div>
        <h1 className="font-display text-xl font-bold">
          Nouveaux beats bientôt disponibles !
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          Notre catalogue est en cours de préparation. Reviens vite.
        </p>
        <a
          href="/booking"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand-gradient px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Réserver une session
        </a>
      </div>
    );
  }

  // All beats swiped
  if (currentIndex >= beats.length) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 text-center">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-bg-surface">
          <Music className="h-10 w-10 text-text-muted" />
        </div>
        <h1 className="font-display text-xl font-bold">
          Tu as tout écouté !
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          Reviens bientôt pour découvrir de nouveaux beats.
        </p>
        <button
          type="button"
          onClick={() => setCurrentIndex(0)}
          className="mt-6 inline-flex items-center gap-2 rounded-lg border border-border-default px-6 py-3 text-sm font-medium text-text-primary transition-colors hover:bg-bg-hover"
        >
          Recommencer
        </button>
      </div>
    );
  }

  return (
    <>
      {showOnboarding && (
        <BeatsOnboarding onComplete={handleOnboardingComplete} />
      )}

      <div className="beat-swipe-screen">
        {/* Counter — top right */}
        <div
          className="absolute left-0 right-0 top-0 z-10 flex items-center justify-end"
          style={{ padding: "var(--space-4, 16px)" }}
        >
          <span className="font-mono text-xs text-text-muted">
            {currentIndex + 1} / {beats.length}
          </span>
        </div>

        {/* Swipe hint */}
        <div className="swipe-hint">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Swipe pour découvrir
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>

        {/* Card stack */}
        <div className="beat-card-container">
          <div className="relative" style={{ width: "100%", maxWidth: 340, height: 420 }}>
            <BeatSwipeCard
              key={beats[currentIndex].id}
              beat={beats[currentIndex]}
              isTop={true}
              exitDirection={exitDirection}
              onSwipeLeft={handleSwipeLeft}
              onSwipeRight={handleSwipeRight}
            />
          </div>
        </div>

        {/* Action buttons — prototype style */}
        <div className="swipe-actions">
          {/* Skip */}
          <button
            type="button"
            onClick={handleSwipeLeft}
            className="swipe-btn swipe-btn-skip"
            aria-label="Passer cette prod"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {/* Like */}
          <button
            type="button"
            onClick={handleSwipeRight}
            className={`swipe-btn swipe-btn-like${
              beats[currentIndex] && favoriteIds.has(beats[currentIndex].id) ? " is-active" : ""
            }`}
            aria-label="Ajouter aux favoris"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}
