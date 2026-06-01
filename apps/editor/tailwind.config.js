/** @type {import('tailwindcss').Config} */

// Semantic color tokens backed by CSS variables (see src/index.css). Using the
// `rgb(var(--token) / <alpha-value>)` form keeps Tailwind opacity modifiers
// (e.g. bg-surface/90) working. Theme switching is a single class on <html>.
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    '../../packages/ui-runtime/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: token('surface'),
          muted: token('surface-muted'),
          subtle: token('surface-subtle'),
          strong: token('surface-strong'),
        },
        ink: token('ink'),
        fg: {
          DEFAULT: token('fg'),
          secondary: token('fg-secondary'),
          muted: token('fg-muted'),
          subtle: token('fg-subtle'),
          faint: token('fg-faint'),
        },
        line: {
          DEFAULT: token('line'),
          subtle: token('line-subtle'),
          strong: token('line-strong'),
        },
        brand: {
          DEFAULT: token('brand'),
          strong: token('brand-strong'),
          deep: token('brand-deep'),
          fg: token('brand-fg'),
          'fg-strong': token('brand-fg-strong'),
          'fg-mid': token('brand-fg-mid'),
          'fg-light': token('brand-fg-light'),
          subtle: token('brand-subtle'),
          soft: token('brand-soft'),
          border: token('brand-border'),
          'border-subtle': token('brand-border-subtle'),
          'border-strong': token('brand-border-strong'),
          ring: token('brand-ring'),
        },
        success: {
          DEFAULT: token('success'),
          bg: token('success-bg'),
          border: token('success-border'),
          fg: token('success-fg'),
        },
        danger: {
          DEFAULT: token('danger'),
          bg: token('danger-bg'),
          border: token('danger-border'),
          fg: token('danger-fg'),
        },
        warning: {
          DEFAULT: token('warning'),
          bg: token('warning-bg'),
          border: token('warning-border'),
          fg: token('warning-fg'),
        },
      },
    },
  },
  plugins: [],
};
