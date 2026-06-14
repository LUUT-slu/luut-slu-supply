import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import { cn } from "@/lib/utils";
import storefrontHeroMobile from "@/assets/storefront-hero-mobile.webp";
import storefrontHeroDesktop from "@/assets/storefront-hero-desktop.webp";
import { useSiteSettings, DEFAULT_HERO } from "@/hooks/useSiteSettings";

interface Slide {
  image: string;
  imageDesktop?: string;
  heading: string;
  subheading?: string;
  cta: string;
  link: string;
}

const FALLBACK_SLIDES: Slide[] = [
  { image: storefrontHeroMobile, imageDesktop: storefrontHeroDesktop, heading: "LUUT SLU — Streetwear Marketplace in Saint Lucia", subheading: "Premium streetwear, delivered island-wide", cta: "Shop Outfits", link: "/shop" },
  { image: storefrontHeroMobile, imageDesktop: storefrontHeroDesktop, heading: "NEW DROPS WEEKLY", subheading: "Be first on the freshest styles", cta: "New Arrivals", link: "/shop?filter=new" },
  { image: storefrontHeroMobile, imageDesktop: storefrontHeroDesktop, heading: "BEST SELLERS", subheading: "Trending across Saint Lucia", cta: "Shop Best Sellers", link: "/shop?filter=best" },
];

export function HeroSlider() {
  const { data: settings } = useSiteSettings();
  const hero = settings?.homepageLayout?.hero || DEFAULT_HERO;

  const slides: Slide[] = [
    {
      image: hero.imageUrl || storefrontHeroMobile,
      imageDesktop: hero.imageUrl || storefrontHeroDesktop,
      heading: hero.heading || "LUUT SLU — Streetwear Marketplace in Saint Lucia",
      subheading: hero.subheading || "Premium streetwear, delivered island-wide",
      cta: hero.buttonText || "Shop Outfits",
      link: hero.buttonLink || "/shop",
    },
    ...FALLBACK_SLIDES.slice(1),
  ];

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "start" });
  const [selectedIndex, setSelectedIndex] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
    onSelect();
    const id = window.setInterval(() => {
      if (emblaApi.canScrollNext()) emblaApi.scrollNext();
      else emblaApi.scrollTo(0);
    }, 5000);
    return () => {
      window.clearInterval(id);
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  return (
    <section className="relative w-full overflow-hidden bg-background">
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex">
          {slides.map((slide, i) => (
            <div key={i} className="relative min-w-0 flex-[0_0_100%]">
              <div className="relative aspect-[4/5] w-full sm:aspect-[16/9] md:aspect-[21/9] md:min-h-[85vh] lg:min-h-[90vh]">
                <picture>
                  <source media="(min-width: 768px)" srcSet={slide.imageDesktop || slide.image} />
                  <img
                    src={slide.image}
                    alt={slide.heading}
                    className="absolute inset-0 h-full w-full object-cover"
                    loading={i === 0 ? "eager" : "lazy"}
                    fetchPriority={i === 0 ? "high" : "auto"}
                    decoding="async"
                  />
                </picture>
                <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/80" />
                <div className="absolute inset-x-0 bottom-0 flex flex-col items-center px-6 pb-14 text-center md:pb-20">
                  <h1 className="font-display text-3xl font-bold tracking-wide text-white drop-shadow-lg sm:text-4xl md:text-5xl lg:text-6xl">
                    {slide.heading}
                  </h1>
                  {slide.subheading && (
                    <p className="mt-2 max-w-md text-sm text-white/80 sm:text-base md:max-w-xl md:text-lg">{slide.subheading}</p>
                  )}
                  <Link
                    to={slide.link}
                    className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-95 md:px-8 md:py-4 md:text-base"
                  >
                    {slide.cta}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pagination dots */}
      <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
        {slides.map((_, i) => (
          <button
            key={i}
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => emblaApi?.scrollTo(i)}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === selectedIndex ? "w-6 bg-primary" : "w-1.5 bg-white/50"
            )}
          />
        ))}
      </div>
    </section>
  );
}
