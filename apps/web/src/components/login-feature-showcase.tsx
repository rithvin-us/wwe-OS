"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, ChevronRight, Droplets, ShieldCheck, Factory, Award } from "@bop/icons";

interface FeatureSlide {
  id: string;
  badge: string;
  title: string;
  description: string;
  image: string;
  icon: typeof Droplets;
  metrics: { label: string; value: string }[];
}

const SLIDES: FeatureSlide[] = [
  {
    id: "stp-ops",
    badge: "STP Plant Operations",
    title: "50+ Million Liters Processed Daily",
    description:
      "Maintaining 100% environmental compliance across our sewage treatment plants through round-the-clock operator vigilance.",
    image: "/images/stp-facility.jpg",
    icon: Factory,
    metrics: [
      { label: "Daily Wastewater Treated", value: "50 MLD" },
      { label: "Effluent Standard Compliance", value: "100%" },
    ],
  },
  {
    id: "water-reuse",
    badge: "Environmental Achievement",
    title: "88% Recycled Water Utilization",
    description:
      "Closing the loop by returning tertiary-treated water back to industrial cooling towers and local green belts.",
    image: "/images/stp-water-reuse.jpg",
    icon: Droplets,
    metrics: [
      { label: "Recycled Water Reused", value: "88%" },
      { label: "Solar-Powered Energy", value: "25%" },
    ],
  },
  {
    id: "scada-safety",
    badge: "Operational Safety",
    title: "1,200+ Days Zero Safety Incidents",
    description:
      "Real-time SCADA telemetry, automated chemical dosing checks, and strict plant safety protocols for all shift engineers.",
    image: "/images/stp-aeration.jpg",
    icon: ShieldCheck,
    metrics: [
      { label: "Safe Work Days", value: "1,200+" },
      { label: "SCADA Monitoring", value: "24 / 7" },
    ],
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
      className="relative flex h-full w-full flex-col justify-between overflow-hidden bg-slate-950 p-8 lg:p-12 text-white"
      onMouseEnter={() => setIsAutoPlaying(false)}
      onMouseLeave={() => setIsAutoPlaying(true)}
    >
      {/* Background Image Carousel with Overlay Scrim */}
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
            className="h-full w-full object-cover object-center filter brightness-[0.75]"
          />
          {/* Gradient Scrim for Contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-slate-950/40" />
        </motion.div>
      </AnimatePresence>

      {/* Top Header Badge & Employee Navigation */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-slate-900/80 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-md shadow-md">
          <Award className="size-3.5 text-cyan-400" />
          <span>STP Employee Operations Portal</span>
        </div>

        {/* Manual Carousel Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCurrentSlide((prev) => (prev - 1 + SLIDES.length) % SLIDES.length)}
            className="flex size-8 items-center justify-center rounded-full border border-white/20 bg-slate-900/60 text-slate-300 transition hover:bg-slate-800 hover:text-white active:scale-95"
            aria-label="Previous Slide"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            onClick={() => setCurrentSlide((prev) => (prev + 1) % SLIDES.length)}
            className="flex size-8 items-center justify-center rounded-full border border-white/20 bg-slate-900/60 text-slate-300 transition hover:bg-slate-800 hover:text-white active:scale-95"
            aria-label="Next Slide"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {/* Main Content & Achievement Display */}
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
            <div className="inline-flex items-center gap-2 rounded-md bg-cyan-500/20 border border-cyan-400/30 px-3 py-1 text-xs font-semibold text-cyan-300 backdrop-blur-md">
              <IconComponent className="size-4" />
              <span>{activeSlide.badge}</span>
            </div>

            <h2 className="font-display text-3xl font-bold tracking-tight text-white lg:text-4xl drop-shadow-md">
              {activeSlide.title}
            </h2>

            <p className="max-w-lg text-sm leading-relaxed text-slate-200 lg:text-base drop-shadow-xs">
              {activeSlide.description}
            </p>

            {/* Practical Operational Achievements */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              {activeSlide.metrics.map((m, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-white/15 bg-slate-900/70 p-4 backdrop-blur-md shadow-lg"
                >
                  <p className="font-display text-xl font-bold text-cyan-400">{m.value}</p>
                  <p className="text-xs font-medium text-slate-300 mt-0.5">{m.label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer Indicators & Employee Notice */}
      <div className="relative z-10 flex items-center justify-between border-t border-white/15 pt-5">
        <div className="flex items-center gap-2">
          {SLIDES.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSlide(idx)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                currentSlide === idx ? "w-7 bg-cyan-400" : "w-2 bg-white/30 hover:bg-white/60"
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>

        <p className="text-xs text-slate-300 font-medium">Authorized Employee Access Only</p>
      </div>
    </div>
  );
}
