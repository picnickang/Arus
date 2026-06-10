import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import unusedImports from 'eslint-plugin-unused-imports';
import sonarjs from 'eslint-plugin-sonarjs';

export default [
  js.configs.recommended,
  {
    ignores: [
      '**/client/src/lib/formatters.ts',
      '**/client/tests/**',
      '**/client/public/service-worker.js',
      '**/public/service-worker.js',
      '**/test-standalone.js',
      '**/package-config.js',
      'scripts/**/*.cjs',
      'scripts/**/*.js',
      'scripts/codemods/**',
      'src-tauri/**',
      'ios/**',
      '**/dist/**',
      '**/node_modules/**',
      '**/build/**',
      '**/.replit/**',
      '**/.local/**',
      '**/.agents/**',
      '**/attached_assets/**',
      'reports/**',
      'tools/**',
      'server/index.js',
      'server/index.mjs',
      'server/index-wrapper*.cjs',
      'server/index-wrapper*.js',
      'shared/schema.js',
      'shared/schema-runtime.js',
      'scripts/*.mjs',
      'vite.config.ts',
      'tailwind.config.ts',
      'postcss.config.js',
      'drizzle.config.ts',
      'shared/schema.ts',
    ]
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react': react,
      'react-hooks': reactHooks,
      'unused-imports': unusedImports,
      'sonarjs': sonarjs
    },
    settings: {
      react: {
        version: 'detect'
      }
    },
    rules: {
      // Unused imports auto-removal (S1128)
      'unused-imports/no-unused-imports': 'error',
      
      // SonarCloud S2681 - Require curly braces for all control statements
      'curly': ['error', 'all'],
      
      // SonarCloud S7763 - Unnecessary double negations (partial fix)
      // Note: Many === true/false comparisons are intentional for nullable booleans
      'no-extra-boolean-cast': 'error',
      
      // SonarCloud S7735 - Use template literals instead of string concatenation
      'prefer-template': 'error',
      
      // SonarCloud S7781 - Use object shorthand syntax
      'object-shorthand': ['error', 'always'],
      
      // SonarCloud S1854 - No unused expressions
      'no-unused-expressions': 'error',
      
      // SonarCloud S7764 - Use logical assignment operators (||=, &&=, ??=)
      'logical-assignment-operators': ['error', 'always'],
      
      // SonarCloud S1116/S2486 - No empty statements or catch blocks without comments
      // Note: Empty catch blocks should contain at least a comment explaining why
      'no-empty': ['warn', { allowEmptyCatch: false }],
      
      // SonarCloud S7778 - Consistent function expression style (prefer arrow functions)
      'func-style': ['error', 'declaration', { allowArrowFunctions: true }],
      
      // SonarCloud S6598 - Prefer arrow callback functions
      'prefer-arrow-callback': ['error', { allowNamedFunctions: true }],
      
      // SonarCloud S6606 - Use === instead of == 
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      
      // SonarCloud S3358 - No nested ternaries (makes code hard to read)
      'no-nested-ternary': 'warn',
      
      // SonarCloud S7772/S6582 - Prefer optional chaining (?.) over && chains
      // Note: Requires type-aware linting - will be enabled in Phase 2
      // '@typescript-eslint/prefer-optional-chain': 'warn',
      
      // SonarCloud S7763 - Prefer strict boolean expressions (avoid == true, != false)
      '@typescript-eslint/strict-boolean-expressions': 'off', // Too strict for existing codebase
      
      // SonarCloud S4325 - Avoid unnecessary type assertions
      '@typescript-eslint/no-unnecessary-type-assertion': 'off', // Requires type-checking
      
      // ============ SONARJS PLUGIN RULES ============
      // S1488 - Prefer immediate return
      'sonarjs/prefer-immediate-return': 'warn',
      // S1940 - Boolean checks should not be inverted
      'sonarjs/no-inverted-boolean-check': 'warn',
      // S3626 - Jump statements should not be redundant
      'sonarjs/no-redundant-jump': 'warn',
      // S2737 - Catch clauses should do more than rethrow
      'sonarjs/no-useless-catch': 'error',
      // S1871 - Branches should not have identical implementations
      'sonarjs/no-duplicated-branches': 'warn',
      // S3923 - All branches should not have the same implementation
      'sonarjs/no-all-duplicated-branches': 'warn',
      // S1764 - Identical expressions should not be used on both sides of operators
      'sonarjs/no-identical-expressions': 'error',
      // S4144 - Functions should not have identical implementations
      'sonarjs/no-identical-functions': 'warn',
      // S1862 - Related "if/else if" statements should not have the same condition
      'sonarjs/no-identical-conditions': 'error',
      // S2757 - "=+" should not be used instead of "+="
      'sonarjs/non-existent-operator': 'error',
      // S3972 - Conditionals should start on new lines
      'sonarjs/no-same-line-conditional': 'warn',
      // S1066 - Collapsible "if" statements should be merged
      'sonarjs/no-collapsible-if': 'warn',
      // S1125 - Boolean literals should not be redundant
      'sonarjs/no-redundant-boolean': 'warn',
      // S1126 - Return of boolean expression should not be wrapped
      'sonarjs/prefer-single-boolean-return': 'warn',
      // S4030 - Collection should not be empty immediately after a check
      'sonarjs/no-collection-size-mischeck': 'error',
      // S4327 - "this" should only be assigned to "self" when needed
      'sonarjs/no-gratuitous-expressions': 'warn',
      // S2870 - "delete" should not be used on arrays
      'sonarjs/no-element-overwrite': 'warn',
      // S4143 - Collection elements should not be replaced unconditionally
      'sonarjs/no-use-of-empty-return-value': 'error',
      
      // ============ ADDITIONAL AUTO-FIXABLE RULES ============
      // S3626 - No else return
      'no-else-return': ['warn', { allowElseIf: false }],
      // S4322 - No return await
      'no-return-await': 'warn',
      // S1481 - Prefer const (already warn, upgrading to error for auto-fix)
      // S1155 - No useless escape
      'no-useless-escape': 'warn',
      // S3776 - Max lines per function (already set)
      // S125 - Spaced comment for commented code detection
      'spaced-comment': ['warn', 'always', { exceptions: ['-', '+', '*'] }],
      
      // TypeScript rules
      'no-unused-vars': 'off', // Use TypeScript's version
      'no-undef': 'off', // TypeScript handles this
      'no-redeclare': 'off', // TypeScript overload signatures intentionally redeclare names.
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_|^error$|^err$|^e$',
        ignoreRestSiblings: true
      }],
      '@typescript-eslint/no-explicit-any': 'error',
      'prefer-const': 'warn',

      // ============ HYGIENE ADDITIONS (Block A) ============
      // Prefer @ts-expect-error over @ts-ignore. @ts-expect-error fails lint
      // once the underlying error is fixed, signalling the suppression can be
      // removed. @ts-ignore doesn't.
      '@typescript-eslint/ban-ts-comment': ['warn', {
        'ts-ignore': 'allow-with-description',
        'ts-expect-error': 'allow-with-description',
        'ts-nocheck': true,
        'ts-check': false,
        minimumDescriptionLength: 10,
      }],

      // ============ ASYNC-AWAIT CONSISTENCY (Block D) ============
      // Throwing inside `new Promise((resolve, reject) => { ... })` constructors
      // can lose the rejection — this catches the common shape where the
      // executor itself is `async`.
      'no-async-promise-executor': 'error',
      // Catches the class of bug where `await` inside a loop mutates shared
      // state and a concurrent iteration clobbers it. Occasional false
      // positives but high signal when right.
      'require-atomic-updates': 'warn',
      
      // React rules
      'react/prop-types': 'off',
      'react/jsx-no-undef': 'error',
      'react/jsx-uses-react': 'off',
      'react/react-in-jsx-scope': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      
      // Console usage
      'no-console': ['warn', {
        allow: ['warn', 'error', 'info']
      }],
      
      // Code complexity rules
      'max-lines-per-function': ['warn', {
        max: 300,
        skipBlankLines: true,
        skipComments: true
      }],
      'complexity': ['warn', 20],
      'max-depth': ['warn', 4],
      'max-nested-callbacks': ['warn', 3],
      
      // Encourage centralized formatters (warnings to guide, not block)
      'no-restricted-syntax': [
        'warn',
        {
          selector: 'CallExpression[callee.property.name="toLocaleString"]',
          message: 'Consider using formatters from @/lib/formatters instead of toLocaleString(). Available: formatCurrency, formatNumber, formatPercent, formatHours, formatCompactNumber, formatDecimal, formatDate, formatDays'
        },
        {
          selector: 'NewExpression[callee.object.name="Intl"][callee.property.name="NumberFormat"]',
          message: 'Consider using formatters from @/lib/formatters instead of new Intl.NumberFormat(). Available: formatCurrency, formatNumber, formatPercent, formatHours, formatCompactNumber, formatDecimal'
        },
        {
          selector: 'CallExpression[callee.object.name="Intl"][callee.property.name="NumberFormat"]',
          message: 'Consider using formatters from @/lib/formatters instead of Intl.NumberFormat(). Available: formatCurrency, formatNumber, formatPercent, formatHours, formatCompactNumber, formatDecimal'
        },
        {
          selector: 'NewExpression[callee.object.name="Intl"][callee.property.name="DateTimeFormat"]',
          message: 'Consider using formatDate from @/lib/formatters instead of new Intl.DateTimeFormat()'
        },
        {
          selector: 'CallExpression[callee.object.name="Intl"][callee.property.name="DateTimeFormat"]',
          message: 'Consider using formatDate from @/lib/formatters instead of Intl.DateTimeFormat()'
        },
        // ============ HYGIENE ADDITION (Block A) ============
        // After the catch-underscore codemod has run, this prevents new code
        // from re-introducing the pattern. Use bare `catch { }` (ES2019) for
        // intentionally-discarded errors, or handle the error explicitly.
        {
          selector: "CatchClause[param.type='Identifier'][param.name=/^_/]",
          message: 'Underscore-prefixed catch bindings (catch (_error)) suggest unused errors. Use bare `catch { }` or handle the error explicitly.'
        },
        // Polling: numeric refetchInterval literals poll hidden tabs and
        // scatter magic numbers. Use pollingInterval(POLL_INTERVALS.X) from
        // @/lib/polling (visibility-gated, centralized values).
        {
          selector: 'Property[key.name="refetchInterval"] > Literal[value=/^[0-9]+$/]',
          message: 'Use refetchInterval: pollingInterval(POLL_INTERVALS.X) from @/lib/polling instead of a numeric literal — it pauses polling while the tab is hidden.'
        },
        // Query keys: template literals defeat hierarchical cache
        // invalidation. Use a key factory (see crewKeys in
        // client/src/features/crew/hooks/useCrew.ts).
        {
          selector: 'Property[key.name="queryKey"] > ArrayExpression TemplateLiteral',
          message: 'Template literals inside queryKey break prefix-based invalidation. Use array segments via a key factory (model: crewKeys in features/crew/hooks/useCrew.ts).'
        }
      ]
    }
  },
  {
    files: ['**/*.tsx'],
    rules: {
      'max-lines-per-function': ['warn', {
        max: 400,
        skipBlankLines: true,
        skipComments: true
      }]
    }
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module'
    }
  },
  {
    files: ['scripts/**/*.mjs', 'scripts/**/*.ts'],
    languageOptions: {
      globals: {
        AbortController: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        clearTimeout: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
      },
    },
  },
  {
    files: ['tests/load/**/*.mjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
      },
    },
  },
  {
    files: ['tests/load/**/*.js'],
    languageOptions: {
      globals: {
        __ENV: 'readonly',
        __VU: 'readonly',
        console: 'readonly',
      },
    },
  },
  // Stage 3 & 4: Backend/server paths - allow console.log for operational logging
  {
    files: ['server/**/*.ts', 'server/**/*.tsx'],
    rules: {
      'no-console': 'off',
      // Allow common Express middleware patterns (req/res/next often unused in middleware signatures)
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_|^req$|^res$|^next$',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_|^error$|^err$|^e$',
        ignoreRestSiblings: true
      }]
    }
  },
  // Test files - allow common test utilities that are imported for setup
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_|^afterEach$|^beforeEach$|^afterAll$|^beforeAll$|^describe$|^it$|^expect$|^jest$',
        caughtErrorsIgnorePattern: '^_|^error$|^err$|^e$',
        ignoreRestSiblings: true
      }]
    }
  },
  // Shared schema files - allow unused imports for re-exports
  {
    files: ['shared/schema/**/*.ts', 'shared/sqlite-schema/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_|^table$|^sql$|^index$|^unique$|^real$|^text$|^integer$|^boolean$|^timestamp$|^pgTable$|^varchar$|^json$|^jsonb$',
        caughtErrorsIgnorePattern: '^_'
      }]
    }
  },
  // ============ HYGIENE ADDITIONS (Block B) — DB layer rules ============
  // Repository methods are the API surface between the service layer and the
  // DB. Explicit return types make schema drift loud at definition time.
  // Console restriction is tighter than the server-wide config because the
  // DB layer should always go through the structured logger.
  {
    files: ['server/db/**/*.ts', 'server/domains/*/repository.ts', 'server/repositories/**/*.ts'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': ['warn', {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
        allowHigherOrderFunctions: true,
        allowDirectConstAssertionInArrowFunctions: true,
      }],
      'no-console': ['warn', {
        allow: ['warn', 'error'],
      }],
    }
  },
  // Task #164 — ZERO-tolerance `any` for the type-debt-burned-down globs.
  // shared/, server/db/, server/lib/ are now `any`-free; pin it with `error`
  // so regressions fail lint instead of merging quietly.
  {
    files: ['shared/**/*.ts', 'server/db/**/*.ts', 'server/lib/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    }
  },
  // Phase 2: Type-aware linting for client code only (to avoid perf issues)
  // Enables rules that require TypeScript type information
  {
    files: ['client/src/**/*.ts', 'client/src/**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.eslint.json',
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    rules: {
      // S7772/S6582 - Prefer optional chaining (?.) over && chains
      '@typescript-eslint/prefer-optional-chain': 'warn',
      // S4325 - Avoid unnecessary type assertions
      '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
      // S6544 - Prefer nullish coalescing (??) over || for nullable values
      '@typescript-eslint/prefer-nullish-coalescing': ['warn', {
        ignoreConditionalTests: true,
        ignoreMixedLogicalExpressions: true
      }]
    }
  }
];
