import Link from "next/link";
import Image from "next/image";
import { Mic, Music, Headphones, Phone, Mail } from "lucide-react";
import { HomeContactForm } from "@/components/home/contact-form";
import { TeamSection } from "@/components/home/team-section";
import { ArtistCarousel } from "@/components/home/artist-carousel";

const ARTISTS = [
  { name: "Artist 1", photo: "" },
  { name: "Artist 2", photo: "" },
  { name: "Artist 3", photo: "" },
  { name: "Artist 4", photo: "" },
  { name: "Artist 5", photo: "" },
  { name: "Artist 6", photo: "" },
  { name: "Artist 7", photo: "" },
  { name: "Artist 8", photo: "" },
];

const STUDIOS = [
  { name: "Studio A", price: "from 20\u202F€/h", image: null },
  { name: "Studio B", price: "from 25\u202F€/h", image: null },
  { name: "Studio C", price: "from 30\u202F€/h", image: null },
];

export default function HomePage() {
  return (
    <div>
      {/* Hero Editorial */}
      <div className="relative overflow-hidden pb-8">
        {/* Cinematic BG */}
        <div className="pointer-events-none absolute top-0 left-0 right-0 h-[500px]" style={{
          background: "linear-gradient(180deg, rgba(139,92,246,0.2) 0%, rgba(217,70,239,0.1) 30%, transparent 100%)",
        }} />

        <div className="relative z-[2] px-6 md:mx-auto md:max-w-[1200px] md:px-12 md:pt-24 md:text-center">
          {/* Header with Logo — mobile only */}
          <div className="flex items-center justify-between pt-[52px] mb-12 md:hidden">
            <Link href="/" className="flex items-center">
              <Image src="/img/logo.png" alt="Studio Platform" width={160} height={32} className="h-8 w-auto object-contain" />
            </Link>
          </div>

          {/* Tagline Wheel */}
          <div className="tagline-wheel">
            <div className="tagline-wheel-track">
              <div className="tagline-item">Sors ton son.</div>
              <div className="tagline-item">Pose ta voix.</div>
              <div className="tagline-item">Trouve ton instru.</div>
              <div className="tagline-item">Sors ton son.</div>
              <div className="tagline-item">Pose ta voix.</div>
              <div className="tagline-item">Trouve ton instru.</div>
            </div>
          </div>

          {/* CTAs — constrained on desktop */}
          <div className="flex flex-col gap-3 w-full md:max-w-[360px] md:mx-auto">
            <Link href="/booking" className="hero-cta-primary">
              <Mic className="h-5 w-5" />
              <span>Booker une session</span>
            </Link>
            <Link href="/beats" className="hero-cta-secondary">
              <Music className="h-4 w-4" />
              <span>Écouter les prods</span>
            </Link>
            <Link href="/mixing" className="hero-cta-secondary">
              <Headphones className="h-4 w-4" />
              <span>Commander un mix</span>
            </Link>
          </div>

          {/* Artist carousel label */}
          <p className="mt-6 mb-2 text-[11px] font-semibold uppercase tracking-[2px] text-text-muted md:text-center">
            Ils sont passés par là
          </p>
        </div>

        {/* Artist Carousel */}
        <ArtistCarousel artists={ARTISTS} />
      </div>

      {/* Page Content */}
      <div className="px-4 md:mx-auto md:max-w-[1200px] md:px-12" style={{ paddingTop: 0 }}>
        {/* Studios Section */}
        <div className="mb-8">
          <h2 className="section-eyebrow">Les studios</h2>
          <div className="studio-scroll">
            {STUDIOS.map((studio) => (
              <Link key={studio.name} href="/booking" className="studio-card">
                <div className="studio-card-image">
                  {studio.image ? (
                    <img src={studio.image} alt={`Studio ${studio.name}`} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full" style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)" }} />
                  )}
                  <div className="studio-card-overlay">
                    <h4>{studio.name}</h4>
                    <span className="price">{studio.price}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Our story */}
        <div id="about" className="mb-8 scroll-mt-20">
          <h2 className="section-eyebrow">Our story</h2>
          <p className="text-sm text-text-secondary leading-[1.7]">
            Sample placeholder text for the studio story section. Replace with real content.
          </p>
          <p className="text-sm text-text-secondary leading-[1.7] mt-4">
            More sample placeholder text.
          </p>
        </div>

        {/* L'équipe */}
        <div className="mb-8">
          <h2 className="section-eyebrow">L&apos;équipe</h2>
          <TeamSection />
        </div>

        {/* Contact */}
        <div id="contact" className="pb-6 scroll-mt-20">
          <h2 className="section-eyebrow">Contact</h2>

          <div className="contact-desktop-grid">
            <div>
              <div className="rounded-xl border border-border-subtle bg-bg-elevated p-6 mb-4">
                <h4 className="font-display text-lg font-medium mb-2">Studio Platform</h4>
                <p className="text-sm text-text-secondary">Demo Address</p>
                <div className="my-4 border-t border-border-subtle" />
                <div className="flex items-center gap-3 text-sm text-text-secondary">
                  <Phone className="h-4 w-4 flex-shrink-0" />
                  00 00 00 00 00
                </div>
                <div className="flex items-center gap-3 text-sm text-text-secondary mt-2">
                  <Mail className="h-4 w-4 flex-shrink-0" />
                  contact@studioplatform.test
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-display text-xl font-semibold mb-4">Écris-nous</h3>
              <HomeContactForm />
            </div>
          </div>

          {/* Legal Links */}
          <div className="text-center mt-6">
            <div className="flex justify-center gap-4 flex-wrap">
              <Link href="/legal/notices" className="text-xs text-text-muted underline">Mentions légales</Link>
              <Link href="/legal/terms" className="text-xs text-text-muted underline">CGV</Link>
              <Link href="/legal/privacy" className="text-xs text-text-muted underline">Politique de confidentialité</Link>
            </div>
          </div>

          {/* Social Links */}
          <div className="text-center mt-6">
            <p className="text-xs text-text-muted mb-4">Retrouve-nous aussi sur</p>
            <div className="flex gap-3 justify-center">
              <a href="#" className="social-link" title="Instagram">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>
              </a>
              <a href="#" className="social-link" title="TikTok">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" /></svg>
              </a>
              <a href="#" className="social-link" title="YouTube">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19.13C5.12 19.56 12 19.56 12 19.56s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" /><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" /></svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
