export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        "core-black": 'var(--color-core-black)',
        "rich-carbon": 'var(--color-rich-carbon)',
        "urban-smoke": 'var(--color-urban-smoke)',
        "pulse-ash": 'var(--color-pulse-ash)',
        "off-white": 'var(--color-off-white)',
        "neural-fog": 'var(--color-neural-fog)',
        "white-flash": 'var(--color-white-flash)',
        "electric-teal": 'var(--color-electric-teal)',
        infrared: 'var(--color-infrared)',
        success: 'var(--color-success)',
        danger: '#CB3500',
      },
      fontFamily: {
        sans: ["Roc Grotesk", "sans-serif"],
        mono: ["Azeret Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
