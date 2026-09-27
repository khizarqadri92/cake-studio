/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Backed by CSS variables (see index.css) so these swap value
        // automatically when the `dark` class is applied to <html> -
        // no per-component dark: variants needed for base surfaces/text.
        flour: "rgb(var(--color-flour) / <alpha-value>)",
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        hairline: "rgb(var(--color-hairline) / <alpha-value>)",

        // Backed by CSS variables too (see index.css / theme/palettes.ts) -
        // switching the selected palette updates these everywhere at once.
        plum: {
          DEFAULT: "rgb(var(--color-plum) / <alpha-value>)",
          light: "rgb(var(--color-plum-light) / <alpha-value>)",
          dark: "rgb(var(--color-plum-dark) / <alpha-value>)",
        },
        honey: "rgb(var(--color-honey) / <alpha-value>)",
        // Light text/fill on plum surfaces. Fixed on purpose: "flour" turns dark
        // in dark mode (it's the page background), but text on plum must stay light.
        cream: "#FBF6EF",
        // Secondary text that still passes 4.5:1 on flour and surface
        muted: "rgb(var(--color-muted) / <alpha-value>)",
        sage: "#6B8F5C", // success/active - stays constant across every palette
      },
      fontFamily: {
        display: ["Fraunces", "serif"],
        sans: ["Manrope", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
