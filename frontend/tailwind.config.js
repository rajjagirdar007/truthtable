// ✅ Correct
module.exports = {
    content: [
        "./src/**/*.{js,jsx,ts,tsx}", // Ensure Tailwind scans your components
      ],
      theme: {
        extend: {},
      },
    plugins: [
        require('@tailwindcss/postcss'),
        require('autoprefixer'),
        ]
  };
  