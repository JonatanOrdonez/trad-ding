import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
      keyframes: {
        fadeSlideUp: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        toastIn: {
          from: {
            opacity: "0",
            transform: "translateY(8px) scale(0.97)",
          },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        toastOut: {
          from: { opacity: "1", transform: "translateY(0) scale(1)" },
          to: {
            opacity: "0",
            transform: "translateY(4px) scale(0.97)",
          },
        },
      },
      animation: {
        "fade-slide-up": "fadeSlideUp 0.22s ease-out forwards",
        "toast-in": "toastIn 0.22s cubic-bezier(0.4,0,0.2,1) forwards",
        "toast-out": "toastOut 0.18s cubic-bezier(0.4,0,1,1) forwards",
      },
    },
  },
  plugins: [],
};

export default config;
