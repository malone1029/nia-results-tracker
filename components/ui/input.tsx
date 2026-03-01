import { forwardRef } from 'react';

/* ─── Shared field styles ───────────────────────────────────── */

const fieldBase =
  'w-full border rounded-lg px-3 py-2 text-sm text-foreground bg-card placeholder:text-text-muted transition-colors focus:outline-none focus:ring-2 focus:ring-nia-grey-blue/40 focus:border-nia-grey-blue';

const fieldNormal = 'border-border hover:border-text-muted';
const fieldError = 'border-nia-red hover:border-nia-red focus:ring-nia-red/30 focus:border-nia-red';

/* ─── Types ─────────────────────────────────────────────────── */

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  hint?: string;
  size?: 'sm' | 'md';
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  size?: 'sm' | 'md';
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string;
  error?: string;
  hint?: string;
  size?: 'sm' | 'md';
  children: React.ReactNode;
}

/* ─── Size variants ─────────────────────────────────────────── */

const sizeStyles = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-3 py-2 text-sm',
} as const;

/* ─── Label component ───────────────────────────────────────── */

function Label({
  htmlFor,
  required,
  children,
}: {
  htmlFor?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-nia-dark mb-1">
      {children}
      {required && <span className="text-nia-red ml-0.5">*</span>}
    </label>
  );
}

/* ─── Helper / Error text ───────────────────────────────────── */

function FieldMessage({ error, hint }: { error?: string; hint?: string }) {
  if (!error && !hint) return null;
  return (
    <p className={`mt-1 text-xs ${error ? 'text-nia-red' : 'text-text-muted'}`}>{error || hint}</p>
  );
}

/* ─── Input ─────────────────────────────────────────────────── */

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, size = 'md', className = '', id, required, ...props },
  ref
) {
  const fieldId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  const borderStyle = error ? fieldError : fieldNormal;

  return (
    <div className={className}>
      {label && (
        <Label htmlFor={fieldId} required={required}>
          {label}
        </Label>
      )}
      <input
        ref={ref}
        id={fieldId}
        required={required}
        className={`${fieldBase} ${borderStyle} ${sizeStyles[size]}`}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        {...props}
      />
      <FieldMessage error={error} hint={hint} />
    </div>
  );
});

export default Input;

/* ─── Textarea ──────────────────────────────────────────────── */

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, size = 'md', className = '', id, required, ...props },
  ref
) {
  const fieldId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  const borderStyle = error ? fieldError : fieldNormal;

  return (
    <div className={className}>
      {label && (
        <Label htmlFor={fieldId} required={required}>
          {label}
        </Label>
      )}
      <textarea
        ref={ref}
        id={fieldId}
        required={required}
        className={`${fieldBase} ${borderStyle} ${sizeStyles[size]} min-h-[80px]`}
        aria-invalid={error ? 'true' : undefined}
        {...props}
      />
      <FieldMessage error={error} hint={hint} />
    </div>
  );
});

/* ─── Select ────────────────────────────────────────────────── */

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, hint, size = 'md', className = '', id, required, children, ...props },
  ref
) {
  const fieldId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  const borderStyle = error ? fieldError : fieldNormal;

  return (
    <div className={className}>
      {label && (
        <Label htmlFor={fieldId} required={required}>
          {label}
        </Label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={fieldId}
          required={required}
          className={`${fieldBase} ${borderStyle} ${sizeStyles[size]} appearance-none pr-9 cursor-pointer`}
          aria-invalid={error ? 'true' : undefined}
          {...props}
        >
          {children}
        </select>
        {/* Custom chevron — replaces browser default dropdown arrow */}
        <svg
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </div>
      <FieldMessage error={error} hint={hint} />
    </div>
  );
});
