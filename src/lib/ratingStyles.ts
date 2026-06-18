export function ratingStyle(rating: number) {
  if (rating >= 95) {
    return {
      panel: "border-sky-400 bg-sky-100 text-sky-950",
      badge: "bg-sky-950 text-white",
      accent: "text-sky-950",
      muted: "text-sky-900",
    };
  }

  if (rating >= 90) {
    return {
      panel: "border-emerald-950 bg-emerald-950 text-white",
      badge: "bg-white text-emerald-950",
      accent: "text-white",
      muted: "text-emerald-100",
    };
  }

  if (rating >= 80) {
    return {
      panel: "border-emerald-700 bg-gradient-to-br from-emerald-100 to-emerald-800 text-neutral-950",
      badge: "bg-emerald-950 text-white",
      accent: "text-neutral-950",
      muted: "text-emerald-950",
    };
  }

  if (rating >= 70) {
    return {
      panel: "border-orange-500 bg-gradient-to-br from-orange-300 to-lime-200 text-neutral-950",
      badge: "bg-orange-950 text-white",
      accent: "text-neutral-950",
      muted: "text-orange-950",
    };
  }

  return {
    panel: "border-red-600 bg-gradient-to-br from-red-500 to-orange-300 text-neutral-950",
    badge: "bg-red-950 text-white",
    accent: "text-neutral-950",
    muted: "text-red-950",
  };
}
