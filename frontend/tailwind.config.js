/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",

    // Or if using `src` directory:
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    colors: {
      'msg': '#1D1D1D',
      'time': '#9A9A9A',
      'name': '#C7D4E7',
      'text': '#0d080b',
      'text2': '#FFFFFF',
      'background': '#faf6f8',
      'primary': '#b18bb0',
      'secondary': '#a1a1aa',
      'accent': '#b69d8b',
      'heading': '#000000',
      'joinbutton': '#3b82f6',
      'joinbutton2': '#1e40af',
      'chat2': '#E8EBFA',  // #e7f3fa (blue)   //  #eef6fb (light blue)
      'chat': '#F5F5F5',
      'background2': '#f9f9f9',
      'chatbutton': '#98DED9',
      'top': '#E7E4EC',
      'chatbg': '#FFFFFF',
      'delete': '#e3dede',
      'div': '#f2f4ff',
      'hover': '#888888',
      'delete': '#fa0c0c',
    },
    extend: {},
  },

  plugins: [],
}
