import React from 'react';
import type {
  OpportunityComparisonView,
  RequirementEvaluationStatus,
} from '@equipo10/contracts';
import { Button, Notice } from '../../components/Controls';
import styles from './opportunities.module.css';

interface Props {
  comparison: OpportunityComparisonView;
  onRefresh?: () => void;
  onRequestExplanation?: () => void;
  loadingExplanation?: boolean;
}

function renderStatusBadge(status: RequirementEvaluationStatus) {
  switch (status) {
    case 'CUMPLE':
      return <span className={`${styles.badge} ${styles.badgeViable}`}>Cumple</span>;
    case 'NO_CUMPLE':
      return <span className={`${styles.badge} ${styles.badgeInviable}`}>No cumple</span>;
    case 'DESCONOCIDO':
      return <span className={`${styles.badge} ${styles.badgePending}`}>Desconocido</span>;
    default:
      return <span className={styles.badge}>{status}</span>;
  }
}

export function ComparisonResultsCard({
  comparison,
  onRefresh,
  onRequestExplanation,
  loadingExplanation,
}: Props) {
  const isViable = comparison.status === 'VIABLE';
  const isInviable = comparison.status === 'INVIABLE';

  const feasibilityClass = isViable
    ? styles.badgeViable
    : isInviable
    ? styles.badgeInviable
    : styles.badgePending;

  const feasibilityLabel = isViable
    ? 'Viable para postular'
    : isInviable
    ? 'Incompatible o inviable'
    : 'Pendiente de información';

  const barColor = isViable
    ? '#137333'
    : isInviable
    ? '#c5221f'
    : '#1a73e8';

  const percent = comparison.coverage_percent ?? 0;

  return (
    <div className={styles.comparisonCard} data-testid="comparison-results-card">
      <div className={styles.feasibilityHeader}>
        <div>
          <span style={{ fontSize: '13px', color: 'var(--color-secondary)' }}>Evaluación objetiva C01</span>
          <h3 style={{ margin: '4px 0 0', fontSize: '20px' }}>Resultado de compatibilidad</h3>
        </div>
        <span className={`${styles.badge} ${feasibilityClass}`} style={{ fontSize: '14px', padding: '6px 12px' }}>
          {feasibilityLabel}
        </span>
      </div>

      {comparison.outdated && (
        <div className={styles.outdatedWarning} role="alert">
          La vacante se actualizó a una versión posterior desde que se calculó esta comparación.
          {onRefresh && (
            <div style={{ marginTop: '8px' }}>
              <Button variant="secondary" onClick={onRefresh}>
                Recalcular compatibilidad
              </Button>
            </div>
          )}
        </div>
      )}

      <div className={styles.coverageSection}>
        <div className={styles.coverageStats}>
          <span>Cobertura de requisitos</span>
          <span>
            {percent.toFixed(0)}% ({comparison.coverage_numerator} de {comparison.coverage_denominator})
          </span>
        </div>
        <div className={styles.coverageBar}>
          <div
            className={styles.coverageBarFill}
            style={{ width: `${Math.min(100, Math.max(0, percent))}%`, backgroundColor: barColor }}
          />
        </div>
      </div>

      <div>
        <h4 style={{ margin: '0 0 10px', fontSize: '15px' }}>Condiciones logísticas</h4>
        <div className={styles.logisticsGrid}>
          <div className={styles.logisticsRow}>
            <div>
              <strong>Salario esperado:</strong>
              <div style={{ fontSize: '13px', color: 'var(--color-secondary)' }}>
                {comparison.breakdown.logistics.salary.reason}
              </div>
            </div>
            <div>{renderStatusBadge(comparison.breakdown.logistics.salary.status)}</div>
          </div>

          <div className={styles.logisticsRow}>
            <div>
              <strong>Tiempo de traslado:</strong>
              <div style={{ fontSize: '13px', color: 'var(--color-secondary)' }}>
                {comparison.breakdown.logistics.commute.reason}
              </div>
            </div>
            <div>{renderStatusBadge(comparison.breakdown.logistics.commute.status)}</div>
          </div>

          <div className={styles.logisticsRow}>
            <div>
              <strong>Horario y jornada:</strong>
              <div style={{ fontSize: '13px', color: 'var(--color-secondary)' }}>
                {comparison.breakdown.logistics.schedule.reason}
              </div>
            </div>
            <div>{renderStatusBadge(comparison.breakdown.logistics.schedule.status)}</div>
          </div>
        </div>
      </div>

      <div>
        <h4 style={{ margin: '0 0 10px', fontSize: '15px' }}>Desglose de competencias y requisitos</h4>
        <div className={styles.reqList}>
          {comparison.breakdown.requirements.map((req) => (
            <div key={req.requirement_id} className={styles.reqItem}>
              <div className={styles.reqItemHeader}>
                <span className={styles.reqName}>{req.competency_name}</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <span className={styles.badge} style={{ fontSize: '11px', background: 'var(--color-surface-hover)' }}>
                    {req.requirement_type === 'ESSENTIAL' ? 'Esencial' : 'Deseable'} · {req.stage === 'ENTRY' ? 'Entrada' : 'Entrenable'}
                  </span>
                  {renderStatusBadge(req.status)}
                </div>
              </div>
              <div className={styles.reqDesc}>{req.evidence_reason}</div>
            </div>
          ))}
        </div>
      </div>

      {comparison.reasons.length > 0 && (
        <div>
          <h4 style={{ margin: '0 0 8px', fontSize: '15px' }}>Observaciones del cálculo</h4>
          <ul className={styles.reasonList}>
            {comparison.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {onRequestExplanation && (
        <div style={{ paddingTop: '12px', borderTop: '1px solid var(--color-divider)' }}>
          <Button
            variant="secondary"
            onClick={onRequestExplanation}
            disabled={loadingExplanation}
            style={{ width: '100%' }}
          >
            {loadingExplanation ? 'Consultando Asistente A03...' : 'Explicar resultado con Orientador IA (A03)'}
          </Button>
        </div>
      )}
    </div>
  );
}
