import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        app: {
          bg: "#0a0a0a",
          panel: "#111111",
          panelSoft: "#171717",
          border: "#27272a",
          text: "#f4f4f5",
          muted: "#a1a1aa",
          accent: "#6366f1",
          accentHover: "#4f46e5",
          danger: "#dc2626"
        }
      }
    }
  },
  plugins: []
};

export default config;