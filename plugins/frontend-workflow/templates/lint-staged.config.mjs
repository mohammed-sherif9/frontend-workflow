/** Runs on staged files at every commit (via .husky/pre-commit). */
export default {
  '*.{ts,tsx,js,jsx,mjs,cjs}': ['eslint --fix --max-warnings 0', 'prettier --write'],
  '*.{json,md,mdx,css,scss,yml,yaml}': ['prettier --write'],
};
