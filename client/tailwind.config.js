/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        app: {
          bg: "rgb(var(--app-bg) / <alpha-value>)",
          surface: "rgb(var(--app-surface) / <alpha-value>)",
          "surface-muted": "rgb(var(--app-surface-muted) / <alpha-value>)",
          border: "rgb(var(--app-border) / <alpha-value>)",
          text: "rgb(var(--app-text) / <alpha-value>)",
          "text-secondary": "rgb(var(--app-text-secondary) / <alpha-value>)",
          "text-muted": "rgb(var(--app-text-muted) / <alpha-value>)",
        },
      },
    },
  },
  plugins: [],
};
