import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * CodedSwitch brand mark — an eye wired into two nodes by circuit traces.
 *
 * Vectorized from the original logo (client/src/assets/codedswitch_logo.png)
 * and recoloured to the Astutely theme: cyan #06b6d4 line-work, magenta #d946ef
 * accent (pupil + one node). The mark uses `currentColor` for the line-work so
 * it inherits text colour anywhere, and `--logo-accent` for the two accent
 * fills (falls back to currentColor for a clean monochrome / favicon render).
 */

interface MarkProps extends React.SVGProps<SVGSVGElement> {
  /** Draw-in animation on mount (used on the studio splash). */
  animated?: boolean;
  title?: string;
}

export function LogoMark({ className, animated = false, title = 'CodedSwitch', style, ...rest }: MarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      fill="none"
      className={cn('block', animated && 'cs-logo-animated', className)}
      style={{ ['--logo-accent' as string]: '#d946ef', ...style }}
      {...rest}
    >
      {animated && (
        <style>{`
          .cs-logo-animated [data-draw] {
            stroke-dasharray: var(--len, 120);
            stroke-dashoffset: var(--len, 120);
            animation: cs-logo-draw 1.1s cubic-bezier(.65,0,.35,1) forwards;
            animation-delay: var(--d, 0s);
          }
          .cs-logo-animated [data-fade] { opacity: 0; animation: cs-logo-fade .5s ease forwards; animation-delay: var(--d, .9s); }
          @keyframes cs-logo-draw { to { stroke-dashoffset: 0; } }
          @keyframes cs-logo-fade { to { opacity: 1; } }
          @media (prefers-reduced-motion: reduce) {
            .cs-logo-animated [data-draw] { stroke-dashoffset: 0; animation: none; }
            .cs-logo-animated [data-fade] { opacity: 1; animation: none; }
          }
        `}</style>
      )}

      {/* circuit traces — eye corners out to the diagonal nodes */}
      <path d="M52 32 H58 V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" data-draw style={{ ['--len' as string]: 40, ['--d' as string]: '0s' }} />
      <path d="M12 32 H6 V49" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" data-draw style={{ ['--len' as string]: 40, ['--d' as string]: '.12s' }} />

      {/* eye almond */}
      <path d="M12 32C19 21 45 21 52 32C45 43 19 43 12 32Z" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round" data-draw style={{ ['--len' as string]: 120, ['--d' as string]: '.28s' }} />

      {/* iris + pupil */}
      <circle cx="32" cy="32" r="8" stroke="currentColor" strokeWidth="2.6" data-draw style={{ ['--len' as string]: 52, ['--d' as string]: '.6s' }} />
      <circle cx="32" cy="32" r="3.4" fill="var(--logo-accent, currentColor)" data-fade style={{ ['--d' as string]: '.95s' }} />
      <circle cx="29.4" cy="29.4" r="1.05" fill="currentColor" data-fade style={{ ['--d' as string]: '1.05s' }} />

      {/* nodes */}
      <circle cx="55" cy="11" r="4" stroke="currentColor" strokeWidth="2" data-draw style={{ ['--len' as string]: 26, ['--d' as string]: '.75s' }} />
      <circle cx="55" cy="11" r="1.6" fill="var(--logo-accent, currentColor)" data-fade style={{ ['--d' as string]: '1.1s' }} />
      <circle cx="9" cy="53" r="4" stroke="currentColor" strokeWidth="2" data-draw style={{ ['--len' as string]: 26, ['--d' as string]: '.85s' }} />
      <circle cx="9" cy="53" r="1.6" fill="currentColor" data-fade style={{ ['--d' as string]: '1.15s' }} />
    </svg>
  );
}

interface LogoProps {
  className?: string;
  /** Icon height in px (the wordmark scales with it). */
  size?: number;
  /** Show the "CodedSwitch" wordmark next to the mark. */
  wordmark?: boolean;
  /** Show the "AI GODFATHER" tagline under the wordmark. */
  tagline?: boolean;
  animated?: boolean;
}

/**
 * The full lockup: mark + optional wordmark + optional tagline.
 * Wordmark uses the app heading face (Poppins via --font-heading).
 */
export function Logo({ className, size = 32, wordmark = true, tagline = false, animated = false }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 text-cyan-400 select-none', className)}>
      <LogoMark animated={animated} style={{ height: size, width: size }} />
      {wordmark && (
        <span className="flex flex-col leading-none">
          <span
            className="font-heading font-bold tracking-tight text-white"
            style={{ fontSize: size * 0.56 }}
          >
            CodedSwitch
          </span>
          {tagline && (
            <span
              className="font-heading font-semibold uppercase text-cyan-400/80"
              style={{ fontSize: size * 0.24, letterSpacing: '0.22em', marginTop: size * 0.09 }}
            >
              AI Godfather
            </span>
          )}
        </span>
      )}
    </span>
  );
}

export default Logo;
