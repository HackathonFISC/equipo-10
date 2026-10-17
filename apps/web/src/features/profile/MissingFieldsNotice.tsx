import React from 'react';
import type { MissingFieldItem } from '@equipo10/contracts';
import styles from './ExperienceStep.module.css';

interface MissingFieldsNoticeProps {
  missingFields: MissingFieldItem[];
}

export function MissingFieldsNotice({ missingFields }: MissingFieldsNoticeProps) {
  if (missingFields.length === 0) return null;

  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderLeft: '4px solid var(--color-action)',
        borderRadius: 'var(--radius-card, 12px)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
      role="region"
      aria-label="Campos no completados"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '18px' }}>ℹ️</span>
        <strong style={{ fontSize: '14px', color: 'var(--color-text)' }}>
          Datos opcionales no declarados ({missingFields.length})
        </strong>
      </div>
      <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-secondary)' }}>
        Tu perfil puede confirmarse sin estos datos, pero completarlos mejorará la afinidad de tus recomendaciones:
      </p>
      <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px', fontSize: '13px', color: 'var(--color-text)' }}>
        {missingFields.map((item, idx) => (
          <li key={idx} style={{ marginBottom: '4px' }}>
            <span style={{ fontWeight: item.severity === 'WARNING' ? 600 : 400 }}>
              {item.message}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
