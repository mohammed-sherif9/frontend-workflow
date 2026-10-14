/**
 * Architecture rules for a feature-based Next.js app (frontend-workflow template).
 * Run: npx depcruise src   (script: "depcruise")
 * Adjust the paths if the project does not use src/.
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular dependencies make code hard to change and can break module loading.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'shared-is-independent',
      severity: 'error',
      comment: 'shared/ is feature-agnostic: it may not import features or app.',
      from: { path: '^src/shared/' },
      to: { path: '^src/(features|app)/' },
    },
    {
      name: 'features-do-not-import-app',
      severity: 'error',
      comment: 'Dependencies point inward: app -> features -> shared.',
      from: { path: '^src/features/' },
      to: { path: '^src/app/' },
    },
    {
      name: 'feature-public-api-only',
      severity: 'error',
      comment: 'Other code may only import a feature through features/<name>/index.ts.',
      from: { path: '^src/', pathNot: '^src/features/' },
      to: { path: '^src/features/[^/]+/.+', pathNot: '^src/features/[^/]+/index\\.(ts|tsx)$' },
    },
    {
      name: 'feature-to-feature-public-api-only',
      severity: 'error',
      comment: 'A feature may use another feature only through its index.ts.',
      from: { path: '^src/features/([^/]+)/' },
      to: {
        path: '^src/features/[^/]+/.+',
        pathNot: ['^src/features/$1/', '^src/features/[^/]+/index\\.(ts|tsx)$'],
      },
    },
    {
      name: 'server-code-stays-on-server',
      severity: 'error',
      comment: 'Client components must not import server-only modules.',
      from: { path: '\\.client\\.(ts|tsx)$|/components/' },
      to: { path: '/server/' },
    },
    {
      name: 'no-test-imports-in-production',
      severity: 'error',
      from: { pathNot: '\\.(test|spec)\\.(ts|tsx)$|__tests__|e2e/|test-utils' },
      to: { path: '\\.(test|spec)\\.(ts|tsx)$|__tests__|__mocks__|test-utils' },
    },
    {
      name: 'no-dev-deps-in-production',
      severity: 'error',
      from: { path: '^src/', pathNot: '\\.(test|spec)\\.(ts|tsx)$|__tests__|test-utils' },
      to: { dependencyTypes: ['npm-dev'], pathNot: ['node_modules/@types/'] },
    },
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      comment: 'Files nobody imports are usually dead code (Next.js route files are excluded).',
      from: {
        orphan: true,
        pathNot: [
          '(^|/)\\.[^/]+\\.(js|cjs|mjs|ts)$',
          '\\.d\\.ts$',
          '^src/app/',
          '(^|/)(middleware|instrumentation)\\.(ts|js)$',
          '\\.(test|spec)\\.(ts|tsx)$',
        ],
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '^(\\.next|out|build|coverage)/' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },
  },
};
