/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
        display: ["Iowan Old Style", "Palatino Linotype", "Georgia", "serif"],
        mono: ["JetBrains Mono", "SFMono-Regular", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
}
