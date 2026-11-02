"use client";

import { ChevronLeft, ChevronRight } from "@bop/icons";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useState } from "react";

import { COMPANY } from "@/config/company";

interface FeatureSlide {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  image: string;
}

// Honest brand imagery + qualitative descriptions of the operation — no
// invented metrics. Each slide describes what its (real) photo shows.
const SLIDES: FeatureSlide[] = [
  {
    id: "stp-ops",
    eyebrow: "Plant operations",
    title: "Sewage treatment, run from one place",
    description:
      "Round-the-clock treatment across the plants — operated, monitored, and reported from a single operations workspace.",
    image: "/images/stp-facility.jpg",
  },
  {
    id: "water-reuse",
    eyebrow: "Sustainability",
    title: "Water reuse and recycling",
    description:
      "Tertiary-treated water returned to industrial cooling and local networks, tracked end to end alongside the rest of operations.",
    image: "/images/stp-water-reuse.jpg",
  },
  {
    id: "plant-safety",
    eyebrow: "Plant safety",
    title: "Safe, monitored operations",
    description:
      "Telemetry, dosing checks, and shift protocols keep every plant running safely — with the records to prove it.",
    image: "/images/stp-aeration.jpg",
  },
];

/**
 * The scene beside the sign-in form: real plant photography, with the
 * headline sitting on the calm part of the frame.
 *
 * Slides advance only when someone asks for the next one. The previous
 * version rotated every six seconds and zoomed each photo in as it arrived —
 * motion that loops forever while a person is trying to type a password.
 */
export function LoginFeatureShowcase() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const activeSlide = SLIDES[currentSlide];

  return (
    <div className="relative flex h-full w-full flex-col justify-between overflow-hidden bg-overlay-scrim p-12">
      {/* Photograph + scrim, so the ink over it always clears contrast. */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSlide.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.26, ease: [0.165, 0.84, 0.44, 1] }}
          className="absolute inset-0 z-0"
        >
          <Image
            src={activeSlide.image}
            alt={activeSlide.title}
            fill
            priority={currentSlide === 0}
            sizes="(min-width: 1024px) 58vw, 100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-linear-to-t from-overlay-scrim via-overlay-scrim/70 to-overlay-scrim/30" />
        </motion.div>
      </AnimatePresence>

      <div className="relative z-10 flex items-center justify-between gap-4">
        <span className="font-mono text-xs text-overlay-ink-muted">
          {COMPANY.name} · {COMPANY.caption}
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentSlide((prev) => (prev - 1 + SLIDES.length) % SLIDES.length)}
            className="flex size-8 items-center justify-center rounded-md border border-overlay-ink/25 text-overlay-ink-muted transition-colors duration-(--duration-fast) hover:bg-overlay-ink/10 hover:text-overlay-ink focus-visible:ring-[3px] focus-visible:ring-overlay-ink/40 focus-visible:outline-none"
            aria-label="Previous slide"
          >
            <ChevronLeft aria-hidden className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setCurrentSlide((prev) => (prev + 1) % SLIDES.length)}
            className="flex size-8 items-center justify-center rounded-md border border-overlay-ink/25 text-overlay-ink-muted transition-colors duration-(--duration-fast) hover:bg-overlay-ink/10 hover:text-overlay-ink focus-visible:ring-[3px] focus-visible:ring-overlay-ink/40 focus-visible:outline-none"
            aria-label="Next slide"
          >
            <ChevronRight aria-hidden className="size-4" />
          </button>
        </div>
      </div>

      {/* The headline sits on the calm lower-middle of the frame. */}
      <div className="relative z-10 my-auto max-w-xl py-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSlide.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.165, 0.84, 0.44, 1] }}
            className="space-y-4"
          >
            <p className="font-mono text-xs text-overlay-ink-muted">{activeSlide.eyebrow}</p>

            <h2 className="font-display text-3xl font-semibold tracking-tight text-overlay-ink">
              {activeSlide.title}
            </h2>

            <p className="text-sm leading-relaxed text-overlay-ink-muted">
              {activeSlide.description}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="relative z-10 flex items-center justify-between gap-4 border-t border-overlay-ink/15 pt-6">
        <div className="flex items-center gap-2">
          {SLIDES.map((slide, idx) => (
            <button
              type="button"
              key={slide.id}
              onClick={() => setCurrentSlide(idx)}
              aria-current={currentSlide === idx ? "true" : undefined}
              className={`h-1 rounded-sm transition-[width,background-color] duration-(--duration-base) ease-out-quart ${
                currentSlide === idx
                  ? "w-6 bg-overlay-ink"
                  : "w-2 bg-overlay-ink/30 hover:bg-overlay-ink/60"
              }`}
              aria-label={`Show slide ${idx + 1}`}
            />
          ))}
        </div>

        <p className="font-mono text-xs text-overlay-ink-muted">Authorized access only</p>
      </div>
    </div>
  );
}
