// Nova design tokens + color utilities
export const C = {
  surface: "#05070D",
  surface2: "#111827",
  surface3: "#1F2937",
  onSurface: "#FFFFFF",
  onSurface2: "#D1D5DB",
  muted: "#9CA3AF",
  brand: "#4F46E5",
  brandBlue: "#3B82F6",
  brandPurple: "#8B5CF6",
  success: "#22C55E",
  warning: "#F59E0B",
  error: "#EF4444",
  border: "#1F2937",
  borderStrong: "#374151",
};

export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, "2xl": 32, "3xl": 48 };
export const R = { sm: 6, md: 12, lg: 20, pill: 999 };

// Relative luminance -> decide if a color is "dark"
export function isDarkColor(hex: string): boolean {
  if (!hex) return true;
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length < 6) return true;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum < 0.5;
}

// Text color that contrasts with a background
export function textOn(hex: string): string {
  return isDarkColor(hex) ? "#FFFFFF" : "#0B0B0F";
}

// Secondary/muted text on a background
export function mutedOn(hex: string): string {
  return isDarkColor(hex) ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.55)";
}

// A translucent card surface that works on any background
export function cardOn(hex: string): string {
  return isDarkColor(hex) ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)";
}

export const RINGTONES = ["discord", "cosmic", "pulse", "classic", "chime"];
