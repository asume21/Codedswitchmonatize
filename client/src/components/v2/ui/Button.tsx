import React from 'react';
import { cn } from '@/lib/utils';
import './Button.css';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  glow?: boolean;
  gradient?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      glow = false,
      gradient = false,
      loading = false,
      icon,
      iconPosition = 'left',
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const classes = cn(
      'button-v2',
      `button-v2--${variant}`,
      `button-v2--${size}`,
      {
        'button-v2--glow': glow,
        'button-v2--gradient': gradient,
        'button-v2--loading': loading,
        'button-v2--icon-left': icon && iconPosition === 'left',
        'button-v2--icon-right': icon && iconPosition === 'right',
      },
      className
    );

    return (
      <button
        ref={ref}
        className={classes}
        disabled={disabled || loading}
        {...props}
      >
        <span className="button-v2__content">
          {loading && (
            <span className="button-v2__loader">
              <svg className="button-v2__spinner" viewBox="0 0 24 24">
                <circle
                  className="button-v2__spinner-circle"
                  cx="12"
                  cy="12"
                  r="10"
                  fill="none"
                  strokeWidth="3"
                />
              </svg>
            </span>
          )}
          {!loading && icon && iconPosition === 'left' && (
            <span className="button-v2__icon button-v2__icon--left">{icon}</span>
          )}
          {children && <span className="button-v2__text">{children}</span>}
          {!loading && icon && iconPosition === 'right' && (
            <span className="button-v2__icon button-v2__icon--right">{icon}</span>
          )}
        </span>
        <span className="button-v2__ripple" aria-hidden="true" />
      </button>
    );
  }
);

Button.displayName = 'Button';
