import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "#070812",
        panel: "#111727",
        brass: "#c8a762",
        storm: "#5bd7ff",
        ember: "#ff5d4d"
      },
      boxShadow: {
        glow: "0 0 32px rgba(91, 215, 255, 0.22)"
      }
    }
  },
  plugins: []
};

export default config;
