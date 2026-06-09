// tailwind.config.js
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#1E293B", // sidebar dark navy/gray
        accent: "#2563EB",  // blue button
        background: "#F1F5F9", // page background
        textDark: "#0F172A", // main text
        textLight: "#FFFFFF", // text on dark backgrounds
        borderLight: "#E2E8F0", // table & input borders
      },
    },
  },
  plugins: [],
};
