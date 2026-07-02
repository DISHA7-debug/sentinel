/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sentinel: {
          bg: "#0F1115",
          surface: "#161920",
          "surface-raised": "#1C1F28",
          border: "#2A2D35",
          "border-subtle": "#22252D",
          primary: "#3B82F6",
          "primary-muted": "#2563EB",
          success: "#22C55E",
          warning: "#F59E0B",
          critical: "#EF4444",
          muted: "#9CA3AF",
          "muted-dark": "#6B7280",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        hindi: ["Noto Sans Devanagari", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(255,255,255,0.04) inset",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "meter-fill": "meterFill 0.6s ease-out forwards",
      },
      keyframes: {
        meterFill: {
          "0%": { strokeDashoffset: "283" },
        },
      },
    },
  },
  plugins: [],
};
