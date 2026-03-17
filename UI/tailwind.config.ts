// frontend/tailwind.config.ts
import type { Config } from "tailwindcss";

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Основная синяя палитра (UI, кнопки, заголовки)
        primary: {
          50:  "#eff6ff",
          100: "#dbeafe",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          900: "#1e3a8a",
        },
        // Уровни риска
        risk: {
          low:      "#22c55e",  // зелёный
          medium:   "#eab308",  // жёлтый
          high:     "#f97316",  // оранжевый
          critical: "#ef4444",  // красный
        },
        // ПРОКУРОР — акцентный красный
        prosecutor: {
          DEFAULT: "#dc2626",
          light:   "#fee2e2",
          border:  "#fca5a5",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;