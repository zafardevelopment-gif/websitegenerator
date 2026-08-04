"use client";

import * as React from "react";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import { optimizeImage } from "../media";

export interface GalleryImage {
  url: string;
  alt: string;
}

/**
 * Renders the gallery thumbnail grid and an enlarged click-to-open lightbox
 * (Escape to close, arrow keys / on-screen arrows to page between photos).
 */
export function GalleryGrid({
  images,
  businessName,
}: {
  images: GalleryImage[];
  businessName: string;
}) {
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);
  const spanFirst = images.length >= 5;

  React.useEffect(() => {
    if (openIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenIndex(null);
      if (e.key === "ArrowRight") setOpenIndex((i) => (i === null ? i : (i + 1) % images.length));
      if (e.key === "ArrowLeft") setOpenIndex((i) => (i === null ? i : (i - 1 + images.length) % images.length));
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [openIndex, images.length]);

  const current = openIndex !== null ? images[openIndex] : null;

  return (
    <>
      <div className="grid auto-rows-[13rem] grid-cols-2 gap-4 sm:auto-rows-[15rem] lg:grid-cols-4">
        {images.map((image, index) => (
          <button
            key={image.url + index}
            type="button"
            onClick={() => setOpenIndex(index)}
            aria-label={`View ${image.alt || `photo ${index + 1}`} enlarged`}
            className={clsx(
              "reveal zoomable edge group relative overflow-hidden rounded-[1.5rem] border border-hairline text-left",
              spanFirst && index === 0 && "col-span-2 row-span-2"
            )}
            style={{ animationDelay: `${index * 45}ms` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={optimizeImage(image.url, spanFirst && index === 0 ? 1200 : 700)}
              alt={image.alt || `${businessName} photo ${index + 1}`}
              loading="lazy"
              className="h-full w-full object-cover"
            />
            <span
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            />
          </button>
        ))}
      </div>

      {current && openIndex !== null && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          onClick={() => setOpenIndex(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`${businessName} photo ${openIndex + 1} of ${images.length}`}
        >
          <button
            type="button"
            onClick={() => setOpenIndex(null)}
            aria-label="Close"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
          >
            <X className="h-6 w-6" />
          </button>

          {images.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpenIndex((i) => (i === null ? i : (i - 1 + images.length) % images.length));
              }}
              aria-label="Previous photo"
              className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
            >
              <ChevronLeft className="h-7 w-7" />
            </button>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={optimizeImage(current.url, 1800)}
            alt={current.alt || businessName}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[88vh] max-w-[92vw] rounded-xl object-contain"
          />

          {images.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpenIndex((i) => (i === null ? i : (i + 1) % images.length));
              }}
              aria-label="Next photo"
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
            >
              <ChevronRight className="h-7 w-7" />
            </button>
          )}

          {images.length > 1 && (
            <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white/70">
              {openIndex + 1} / {images.length}
            </span>
          )}
        </div>
      )}
    </>
  );
}
