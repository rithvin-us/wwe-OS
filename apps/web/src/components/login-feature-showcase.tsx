"use client";

import { ChevronLeft, ChevronRight, Droplets, Factory, ShieldCheck } from "@bop/icons";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

import { COMPANY } from "@/config/company";

interface FeatureSlide {
  id: string;
  badge: string;
  title: string;
  description: string;
  image: string;
  icon: typeof Droplets;
}

// Honest brand imagery + qualitative descriptions of the operation — no
// invented metrics. Each slide describes what its (real) photo shows.
const SLIDES: FeatureSlide[] = [
  {
    id: "stp-ops",
    badge: "Plant operations",
    title: "Sewage treatment, run from one place",
    description:
      "Round-the-clock treatment across the plants — operated, monitored, and reported from a single operations workspace.",
    image: "/images/stp-facility.jpg",
    icon: Factory,
  },
  {
    id: "water-reuse",
    badge: "Sustainability",
    title: "Water reuse and recycling",
    description:
      "Tertiary-treated water returned to industrial cooling and local networks, tracked end to end alongside the rest of operations.",
    image: "/images/stp-water-reuse.jpg",
    icon: Droplets,
  },
  {
    id: "plant-safety",
    badge: "Plant safety",
    title: "Safe, monitored operations",
    description:
      "Telemetry, dosing checks, and shift protocols keep every plant running safely — with the records to prove it.",
    image: "/images/stp-aeration.jpg",
    icon: ShieldCheck,
  },
];

export function LoginFeatureShowcase() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    if (!isAutoPlaying) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const activeSlide = SLIDES[currentSlide];
  const IconComponent = activeSlide.icon;

  return (
    <div
      className="relative flex h-full w-full flex-col justify-between overflow-hidden bg-neutral-950 p-8 lg:p-12 text-white"
      onMouseEnter={() => setIsAutoPlaying(false)}
      onMouseLeave={() => setIsAutoPlaying(true)}
    >
      {/* Background image carousel with an overlay scrim for text contrast. */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSlide.id}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="absolute inset-0 z-0"
        >
          <img
            src={activeSlide.image}
            alt={activeSlide.title}
            className="h-full w-full object-cover object-center brightness-[0.75]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/60 to-neutral-950/40" />
        </motion.div>
      </AnimatePresence>

      {/* Brand badge & carousel controls */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/40 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-md shadow-md">
          <span>{COMPANY.name} · Operations</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCurrentSlide((prev) => (prev - 1 + SLIDES.length) % SLIDES.length)}
            className="flex size-8 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white/80 transition hover:bg-black/60 hover:text-white active:scale-95"
            aria-label="Previous slide"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setCurrentSlide((prev) => (prev + 1) % SLIDES.length)}
            className="flex size-8 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white/80 transition hover:bg-black/60 hover:text-white active:scale-95"
            aria-label="Next slide"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {/* Slide content */}
      <div className="relative z-10 my-auto py-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSlide.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="space-y-5"
          >
            <div className="inline-flex items-center gap-2 rounded-md border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
              <IconComponent className="size-4" />
              <span>{activeSlide.badge}</span>
            </div>

            <h2 className="font-display text-3xl font-bold tracking-tight text-white lg:text-4xl drop-shadow-md">
              {activeSlide.title}
            </h2>

            <p className="max-w-lg text-sm leading-relaxed text-white/85 lg:text-base drop-shadow-xs">
              {activeSlide.description}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer indicators */}
      <div className="relative z-10 flex items-center justify-between border-t border-white/15 pt-5">
        <div className="flex items-center gap-2">
          {SLIDES.map((slide, idx) => (
            <button
              type="button"
              key={slide.id}
              onClick={() => setCurrentSlide(idx)}
              className={`h-1.5 rounded-full transition duration-(--duration-slow) ease-out-quart ${
                currentSlide === idx ? "w-7 bg-white" : "w-2 bg-white/30 hover:bg-white/60"
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>

        <p className="text-xs text-white/70 font-medium">Authorized access only</p>
      </div>
    </div>
  );
}
