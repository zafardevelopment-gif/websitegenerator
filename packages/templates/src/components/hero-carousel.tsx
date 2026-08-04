"use client";

import * as React from "react";
import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { optimizeImage } from "../media";

const ROTATE_MS = 6000;

export interface CarouselImage {
  url: string;
  alt: string;
}

/**
 * Absolutely-positioned rotating image stack — drop inside any
 * `position: relative` container with defined dimensions (full-bleed hero,
 * or an aspect-ratio card). Auto-rotates through every image and offers
 * manual prev/next + dot navigation once there's more than one photo.
 */
export function HeroCarousel({
  images,
  fallbackAlt,
  scrim = true,
}: {
  images: CarouselImage[];
  fallbackAlt: string;
  scrim?: boolean;
}) {
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    if (images.length <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % images.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [images.length]);

  if (images.length === 0) return null;

  return (
    <>
      {images.map((image, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={image.url + i}
          src={optimizeImage(image.url, 2000)}
          alt={image.alt || fallbackAlt}
          fetchPriority={i === 0 ? "high" : "low"}
          className={clsx(
            "absolute inset-0 -z-20 h-full w-full object-cover transition-opacity duration-[1200ms] ease-in-out",
            i === index ? "opacity-100" : "opacity-0"
          )}
        />
      ))}
      {scrim && <span aria-hidden className="scrim absolute inset-0 -z-10" />}

      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => setIndex((i) => (i - 1 + images.length) % images.length)}
            aria-label="Previous photo"
            className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/20 bg-white/10 p-2 text-white backdrop-blur transition hover:bg-white/20"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setIndex((i) => (i + 1) % images.length)}
            aria-label="Next photo"
            className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/20 bg-white/10 p-2 text-white backdrop-blur transition hover:bg-white/20"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 gap-2">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Go to photo ${i + 1}`}
                className={clsx(
                  "h-1.5 rounded-full transition-all",
                  i === index ? "w-6 bg-white" : "w-1.5 bg-white/40"
                )}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}
