/**
 * Image delivery optimization. Cloudinary URLs get on-the-fly transforms
 * (auto format WebP/AVIF, auto quality, width cap); other URLs pass through.
 */
export function optimizeImage(url: string, width: number): string {
  if (!url) return url;
  const marker = "/upload/";
  const index = url.indexOf(marker);
  if (!url.includes("res.cloudinary.com") || index === -1) return url;
  // Skip if a transformation segment is already present.
  const after = url.slice(index + marker.length);
  if (/^[a-z]+_[^/]+\//.test(after) && !after.startsWith("v")) return url;
  return `${url.slice(0, index + marker.length)}f_auto,q_auto,c_limit,w_${width}/${after}`;
}
