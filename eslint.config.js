import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

// Selectors used to detect violations of the single-clock / single-AudioContext
// invariants documented in CLAUDE.md ("Single Source of Truth — Audio Clock").
// These rules are the load-bearing guardrail for the studio's playback engine —
// every regression we've seen has been a direct call slipping past the owner.
const TONE_TRANSPORT_START_STOP =
  "MemberExpression[object.object.name='Tone'][object.property.name='Transport'][property.name=/^(start|stop)$/]";
const NEW_AUDIO_CONTEXT = "NewExpression[callee.name='AudioContext']";
const NEW_WEBKIT_AUDIO_CONTEXT = "NewExpression[callee.name='webkitAudioContext']";

const audioInvariantRule = [
  'error',
  {
    selector: TONE_TRANSPORT_START_STOP,
    message:
      "Tone.Transport.start/stop is owned exclusively by TransportContext " +
      '(client/src/contexts/TransportContext.tsx). Route through useTransport() ' +
      'or the shared transportControl module — never call directly. ' +
      "See CLAUDE.md 'Single Source of Truth — Audio Clock'.",
  },
  {
    selector: NEW_AUDIO_CONTEXT,
    message:
      'Use getAudioContext() from client/src/lib/audioContext.ts. There must be ' +
      'exactly one AudioContext for the whole app. ' +
      "See CLAUDE.md 'Single Source of Truth — Audio Clock'.",
  },
  {
    selector: NEW_WEBKIT_AUDIO_CONTEXT,
    message:
      'Use getAudioContext() from client/src/lib/audioContext.ts — ' +
      'webkit-prefixed contexts must go through the singleton too.',
  },
];

export default [
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react': reactPlugin,
      'jsx-a11y': jsxA11y,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.es2021,
        ...globals.node,
      },
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-unused-vars': 'off',
      'jsx-a11y/click-events-have-key-events': 'warn',
      'jsx-a11y/no-static-element-interactions': 'warn',
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  // Audio-clock invariant — enforced as a hard error across the client.
  {
    files: ['client/src/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'no-restricted-syntax': audioInvariantRule,
    },
  },
  // Owner allowlist — these files are *expected* to call the underlying
  // primitives and must not trigger the rule.
  {
    files: [
      'client/src/contexts/TransportContext.tsx',
      'client/src/lib/audioContext.ts',
      'client/src/lib/transportControl.ts',
    ],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
  // Phase 2.2 cleanup queue — known existing violators of the audio-clock
  // invariant. Each entry must be removed from this list as part of the
  // Phase 2.2 cleanup (route the calls through useTransport() /
  // getAudioContext()). Do NOT add to this list — the whole point is that it
  // shrinks to zero. New violations should fail CI.
  {
    files: [
      'client/src/lib/advancedAudio.ts',
      'client/src/lib/audio.ts',
      'client/src/lib/audioEngine.ts',
      'client/src/lib/packAudioSynthesizer.ts',
      'client/src/lib/recordingEngine.ts',
      'client/src/lib/timelineRecorder.ts',
      'client/src/organism/input/AudioFileSource.ts',
      'client/src/organism/analysis/AudioAnalysisEngine.ts',
    ],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
  // Amnesty block: these directories were previously globally ignored, so
  // re-enabling lint would surface a flood of pre-existing warnings/errors.
  // Soft-launch lint here — only the audio-clock invariant is hard-enforced;
  // legacy issues stay as warnings or off and can be cleaned up incrementally.
  {
    files: [
      'client/src/lib/**/*.{ts,tsx,js,jsx}',
      'client/src/hooks/**/*.{ts,tsx,js,jsx}',
      'client/src/components/**/*.{ts,tsx,js,jsx}',
      'client/src/pages/**/*.{ts,tsx,js,jsx}',
      'client/src/organism/**/*.{ts,tsx,js,jsx}',
      'client/src/features/**/*.{ts,tsx,js,jsx}',
      'client/src/stores/**/*.{ts,tsx,js,jsx}',
      'server/**/*.{ts,tsx,js,jsx}',
      'shared/**/*.{ts,tsx,js,jsx}',
      'scripts/**/*.{ts,tsx,js,jsx}',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-undef': 'off',
      'no-prototype-builtins': 'off',
      'no-empty': 'off',
      'no-useless-escape': 'off',
      'no-cond-assign': 'off',
      'no-fallthrough': 'off',
      'no-case-declarations': 'off',
      'no-async-promise-executor': 'off',
      'no-control-regex': 'off',
      'no-irregular-whitespace': 'off',
      'no-misleading-character-class': 'off',
      'no-self-assign': 'off',
      'no-sparse-arrays': 'off',
      'no-constant-condition': 'off',
      'no-extra-boolean-cast': 'off',
      'no-redeclare': 'off',
      'no-inner-declarations': 'off',
      'no-func-assign': 'off',
      'no-import-assign': 'off',
      'no-unsafe-optional-chaining': 'off',
      'no-unreachable': 'off',
      'no-useless-catch': 'off',
      'getter-return': 'off',
      'react/no-unescaped-entities': 'off',
      'react/display-name': 'off',
      'react/prop-types': 'off',
      'react/jsx-key': 'warn',
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/exhaustive-deps': 'off',
      'jsx-a11y/click-events-have-key-events': 'off',
      'jsx-a11y/no-static-element-interactions': 'off',
      'jsx-a11y/no-noninteractive-element-interactions': 'off',
      'jsx-a11y/anchor-is-valid': 'off',
      'jsx-a11y/alt-text': 'off',
      'jsx-a11y/label-has-associated-control': 'off',
      'jsx-a11y/heading-has-content': 'off',
      'jsx-a11y/anchor-has-content': 'off',
      'jsx-a11y/no-autofocus': 'off',
      'jsx-a11y/iframe-has-title': 'off',
      'jsx-a11y/media-has-caption': 'off',
    },
  },
  {
    files: ['**/*.{test,spec}.{ts,tsx,js,jsx}', '**/__tests__/**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      globals: {
        ...globals.jest,
        ...globals.node,
      },
    },
  },
  {
    ignores: [
      'dist/**',
      '**/dist/**',
      'client/dist/**',
      'tests/**',
      'playwright-report/**',
      'test-results/**',
      'node_modules/**',
      '**/node_modules/**',
      'build/**',
      '*.config.js',
      '*.config.ts',
      'vite.config.*.ts',
      'objects/**',
      'music-plugin-manager/**',
      'external/**',
      'tools/**',
      'services/**',
      '.claude/**',
      '.windsurf/**',
      '.codacy/**',
      'push-fix.js',
      'esbuild.config.js',
    ],
  },
];
