export interface Palette {
  id: string;
  label: string;
  plum: string;       // primary accent
  plumLight: string;
  plumDark: string;
  honey: string;       // secondary accent
}

// "sage" (success green) intentionally stays constant across every palette -
// it carries a semantic meaning (active/success) that shouldn't change with
// someone's color preference.
export const PALETTES: Palette[] = [
  { id: "plum", label: "Bakery Plum", plum: "#7A2E3D", plumLight: "#9A4A5B", plumDark: "#5C2130", honey: "#C99A3E" },
  { id: "ocean", label: "Ocean Teal", plum: "#1F6F78", plumLight: "#2F8B94", plumDark: "#154F55", honey: "#D9A441" },
  { id: "forest", label: "Forest Green", plum: "#2F5233", plumLight: "#47714D", plumDark: "#1E3620", honey: "#C9A227" },
  { id: "berry", label: "Berry", plum: "#8E2A5B", plumLight: "#B04A7C", plumDark: "#641D40", honey: "#D9A441" },
  { id: "slate", label: "Slate Blue", plum: "#3A4A5C", plumLight: "#55697E", plumDark: "#26323F", honey: "#C97C4A" },
];

export const DEFAULT_PALETTE_ID = "plum";

export function getPalette(id: string | null | undefined): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}
