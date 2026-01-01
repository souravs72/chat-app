module.exports = {
  // Frontend TypeScript/React files
  'frontend/**/*.{ts,tsx}': [
    'eslint --fix --max-warnings 10',
  ],
  
  // Frontend JavaScript files
  'frontend/**/*.{js,jsx}': [
    'eslint --fix --max-warnings 10',
  ],
  
  // Backend Node.js JavaScript files
  'backend/**/*.js': [
    'eslint --config .eslintrc.backend.cjs --fix --max-warnings 10',
  ],
  
  // JSON files - check formatting
  '**/*.json': [
    'prettier --write',
  ],
  
  // Markdown files
  '**/*.md': [
    'prettier --write',
  ],
  
  // YAML files (GitHub workflows, etc.)
  '**/*.{yml,yaml}': [
    'prettier --write',
  ],
};

