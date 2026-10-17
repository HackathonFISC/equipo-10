import React, { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import styles from './Controls.module.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'text';
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  const variantClass = styles[variant] || styles.primary;
  return <button className={`${styles.button} ${variantClass} ${className}`.trim()} {...props} />;
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  help?: string;
  error?: string;
}

export function Field({ id, label, help, error, className = '', ...props }: FieldProps) {
  const helpId = help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, helpId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {props.required ? ' *' : ''}
      </label>
      <input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className={`${styles.input} ${className}`.trim()}
        {...props}
      />
      {error && <p id={errorId} className={styles.fieldError}>{error}</p>}
      {help && <p id={helpId} className={styles.help}>{help}</p>}
    </div>
  );
}

interface NoticeProps {
  children: ReactNode;
  title?: string;
  error?: boolean;
}

export function Notice({ children, title, error = false }: NoticeProps) {
  return (
    <div
      role={error ? 'alert' : 'status'}
      className={`${styles.notice} ${error ? styles.noticeError : ''}`.trim()}
    >
      {title && <div className={styles.noticeTitle}>{title}</div>}
      <div>{children}</div>
    </div>
  );
}

const STEP_LABELS = ['Cuenta', 'Experiencia', 'Disponibilidad', 'Revisión'];

interface ProgressStepsProps {
  current: number;
}

export function ProgressSteps({ current }: ProgressStepsProps) {
  return (
    <ol className={styles.progressSteps}>
      {STEP_LABELS.map((label, idx) => {
        const isCurrent = idx === current;
        const isDone = idx < current;
        const showLine = idx < STEP_LABELS.length - 1;
        return (
          <li
            key={label}
            className={`${styles.stepItem} ${isDone ? styles.stepDone : ''} ${isCurrent ? styles.stepCurrent : ''}`.trim()}
            aria-current={isCurrent ? 'step' : undefined}
          >
            <span className={styles.stepContent} data-step={idx + 1}>{label}</span>
            {showLine && (
              <span className={`${styles.stepLine} ${isDone ? styles.lineDone : ''}`.trim()} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
