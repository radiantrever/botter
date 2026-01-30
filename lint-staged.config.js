module.exports = {
  'src/**/*.{js,jsx,ts,tsx}': [
    'eslint --fix',
    'prettier --write',
    'git add'
  ],
  '*.{js,jsx,ts,tsx,json,css,md}': [
    'prettier --write',
    'git add'
  ]
};