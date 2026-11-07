module.exports = {
  root: true,
  parser: '@babel/eslint-parser',
  parserOptions: {
    requireConfigFile: false,
    babelOptions: {
      presets: ['@babel/preset-typescript'],
    },
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['import'],
  env: {
    es2022: true,
    node: true,
  },
  settings: {
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: './tsconfig.json',
      },
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx', '.d.ts'],
      },
    },
  },
  rules: {
    'import/no-restricted-paths': [
      'error',
      {
        basePath: __dirname,
        zones: [
          // 1. Domain: imports NOTHING from any other package in packages/
          {
            target: './packages/domain',
            from: './packages/contracts',
            message: 'Domain cannot depend on @opspilot/contracts.',
          },
          {
            target: './packages/domain',
            from: './packages/security',
            message: 'Domain cannot depend on @opspilot/security.',
          },
          {
            target: './packages/domain',
            from: './packages/application',
            message: 'Domain cannot depend on @opspilot/application.',
          },
          {
            target: './packages/domain',
            from: './packages/database',
            message: 'Domain cannot depend on @opspilot/database.',
          },
          {
            target: './packages/domain',
            from: './packages/deployment-providers',
            message: 'Domain cannot depend on @opspilot/deployment-providers.',
          },

          // 2. Contracts: can only depend on domain
          {
            target: './packages/contracts',
            from: './packages/security',
            message: 'Contracts cannot depend on @opspilot/security.',
          },
          {
            target: './packages/contracts',
            from: './packages/application',
            message: 'Contracts cannot depend on @opspilot/application.',
          },
          {
            target: './packages/contracts',
            from: './packages/database',
            message: 'Contracts cannot depend on @opspilot/database.',
          },
          {
            target: './packages/contracts',
            from: './packages/deployment-providers',
            message: 'Contracts cannot depend on @opspilot/deployment-providers.',
          },

          // 3. Security: can only depend on domain
          {
            target: './packages/security',
            from: './packages/contracts',
            message: 'Security cannot depend on @opspilot/contracts.',
          },
          {
            target: './packages/security',
            from: './packages/application',
            message: 'Security cannot depend on @opspilot/application.',
          },
          {
            target: './packages/security',
            from: './packages/database',
            message: 'Security cannot depend on @opspilot/database.',
          },
          {
            target: './packages/security',
            from: './packages/deployment-providers',
            message: 'Security cannot depend on @opspilot/deployment-providers.',
          },

          // 4. Application: imports only domain, contracts, and security (no adapters)
          {
            target: './packages/application',
            from: './packages/database',
            message: 'Application layer cannot depend on @opspilot/database adapter.',
          },
          {
            target: './packages/application',
            from: './packages/deployment-providers',
            message: 'Application layer cannot depend on @opspilot/deployment-providers adapter.',
          },

          // 5. Database: cannot depend on application or deployment-providers
          {
            target: './packages/database',
            from: './packages/application',
            message: 'Database package cannot depend on @opspilot/application.',
          },
          {
            target: './packages/database',
            from: './packages/deployment-providers',
            message: 'Database package cannot depend on @opspilot/deployment-providers.',
          },

          // 6. Deployment-providers: cannot depend on application or database
          {
            target: './packages/deployment-providers',
            from: './packages/application',
            message: 'Deployment-providers package cannot depend on @opspilot/application.',
          },
          {
            target: './packages/deployment-providers',
            from: './packages/database',
            message: 'Deployment-providers package cannot depend on @opspilot/database.',
          },
        ],
      },
    ],
  },
};
