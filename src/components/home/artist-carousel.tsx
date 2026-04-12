"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Artist {
  name: string;
  photo: string;
}

export function ArtistCarousel({ artists }: { artists: Artist[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    return () => el.removeEventListener("scroll", checkScroll);
  }, [checkScroll]);

  function scroll(dir: "left" | "right") {
    if (!scrollRef.current) return;
    const amount = dir === "left" ? -200 : 200;
    scrollRef.current.scrollBy({ left: amount, behavior: "smooth" });
    // Re-check after the smooth scroll settles
    setTimeout(checkScroll, 350);
  }

  return (
    <div className="artist-carousel">
      <button
        className="carousel-arrow carousel-arrow-left"
        aria-label="Précédent"
        onClick={() => scroll("left")}
        style={{
          opacity: canScrollLeft ? 1 : 0,
          pointerEvents: canScrollLeft ? "auto" : "none",
          transition: "opacity 0.2s ease",
        }}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="hero-vignettes" ref={scrollRef}>
        {artists.map((artist) => (
          <div key={artist.name} className="artist-vignette">
            <div className="artist-avatar">
              {artist.photo ? (
                <img
                  className="artist-photo"
                  src={artist.photo}
                  alt={artist.name}
                />
              ) : (
                <span className="artist-photo-placeholder">
                  {artist.name.charAt(0)}
                </span>
              )}
            </div>
            <span className="artist-name">{artist.name}</span>
          </div>
        ))}
      </div>

      <button
        className="carousel-arrow carousel-arrow-right"
        aria-label="Suivant"
        onClick={() => scroll("right")}
        style={{
          opacity: canScrollRight ? 1 : 0,
          pointerEvents: canScrollRight ? "auto" : "none",
          transition: "opacity 0.2s ease",
        }}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
