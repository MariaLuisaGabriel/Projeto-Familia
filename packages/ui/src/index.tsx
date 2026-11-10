/**
 * @estudos/ui
 * Primitivos de interface minimalista e acessível (WCAG 2.1 AA, alvos de toque >= 44px — R-44).
 */
import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  readonly size?: 'md' | 'sm';
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  children,
  ...rest
}: ButtonProps): React.ReactElement {
  return (
    <button
      type="button"
      className={`ui-btn ui-btn--${variant} ui-btn--${size} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
}

export interface CardProps {
  readonly title?: string;
  readonly subtitle?: string;
  readonly headerRight?: React.ReactNode;
  readonly children: React.ReactNode;
  readonly className?: string;
}

export function SurfaceCard({
  title,
  subtitle,
  headerRight,
  children,
  className = '',
}: CardProps): React.ReactElement {
  return (
    <section className={`ui-card ${className}`.trim()}>
      {(title || headerRight) && (
        <header className="ui-card__header">
          <div>
            {title && <h3 className="ui-card__title">{title}</h3>}
            {subtitle && <p className="ui-card__subtitle">{subtitle}</p>}
          </div>
          {headerRight && <div className="ui-card__actions">{headerRight}</div>}
        </header>
      )}
      <div className="ui-card__body">{children}</div>
    </section>
  );
}

export interface BadgeProps {
  readonly tone?: 'neutral' | 'accent' | 'success' | 'warning';
  readonly children: React.ReactNode;
  readonly title?: string;
}

export function Badge({ tone = 'neutral', children, title }: BadgeProps): React.ReactElement {
  return (
    <span className={`ui-badge ui-badge--${tone}`} title={title}>
      {children}
    </span>
  );
}

/**
 * R-31: Toda entidade criada ou alterada por regra DEVE registrar a regra de origem,
 * e a interface DEVE exibir essa informação ("criado pela regra Descanso pós-plantão").
 */
export function RuleOriginBadge({ ruleName }: { readonly ruleName?: string | null }): React.ReactElement | null {
  if (!ruleName) return null;
  return (
    <Badge tone="accent" title={`Automação: criado pela regra ${ruleName}`}>
      criado pela regra {ruleName}
    </Badge>
  );
}
