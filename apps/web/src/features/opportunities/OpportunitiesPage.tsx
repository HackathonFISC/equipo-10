import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router';
import type { OpportunitySummaryView } from '@equipo10/contracts';
import { useSession } from '../../app/session';
import { fetchData } from '../../lib/api';
import { Button, Notice } from '../../components/Controls';
import styles from './opportunities.module.css';

export function OpportunitiesPage() {
  const { session } = useSession();
  const [opportunities, setOpportunities] = useState<OpportunitySummaryView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterText, setFilterText] = useState('');
  const [workplaceType, setWorkplaceType] = useState<string>('ALL');

  const loadOpportunities = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filterText.trim()) {
        params.append('q', filterText.trim());
      }
      if (workplaceType !== 'ALL') {
        params.append('workplace_type', workplaceType);
      }

      const queryString = params.toString() ? `?${params.toString()}` : '';
      const res = await fetchData<{ items: OpportunitySummaryView[]; total: number }>(
        `/opportunities${queryString}`,
        session.access_token
      );
      setOpportunities(res.items);
    } catch {
      setError('No se pudieron cargar las vacantes. Reintente en un momento.');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, filterText, workplaceType]);

  useEffect(() => {
    loadOpportunities();
  }, [loadOpportunities]);

  const handleClearFilters = () => {
    setFilterText('');
    setWorkplaceType('ALL');
  };

  const formatWorkplaceType = (type: string) => {
    switch (type) {
      case 'ON_SITE':
        return 'Presencial';
      case 'REMOTE':
        return 'Remoto';
      case 'HYBRID':
        return 'Híbrido';
      default:
        return type;
    }
  };

  const formatSalary = (amount: string | null, currency: string | null, period: string | null) => {
    if (!amount) return 'Salario a convenir';
    const periodLabel = period === 'MONTH' ? '/ mes' : period === 'HOUR' ? '/ hora' : '';
    return `$${amount} ${currency || 'USD'} ${periodLabel}`.trim();
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.tabs} role="tablist" aria-label="Secciones de exploración">
          <button type="button" className={`${styles.tab} ${styles.tabActive}`} role="tab" aria-selected="true">
            💼 Vacantes laborales
          </button>
          <Link to="/cursos" className={styles.tab} role="tab" aria-selected="false">
            🎓 Cursos formativos
          </Link>
        </div>
        <h1 className={styles.title}>Explorar oportunidades</h1>
        <p className={styles.subtitle}>
          Encuentra vacantes ajustadas a tus competencias y evalúa compatibilidad objetiva con C01.
        </p>
      </div>

      <div className={styles.filterBar}>
        <input
          type="search"
          aria-label="Buscar por título o descripción"
          placeholder="Buscar por título o palabra clave..."
          className={styles.filterInput}
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
        />

        <select
          aria-label="Filtrar por modalidad"
          className={styles.filterSelect}
          value={workplaceType}
          onChange={(e) => setWorkplaceType(e.target.value)}
        >
          <option value="ALL">Todas las modalidades</option>
          <option value="ON_SITE">Presencial</option>
          <option value="REMOTE">Remoto</option>
          <option value="HYBRID">Híbrido</option>
        </select>

        {(filterText || workplaceType !== 'ALL') && (
          <Button variant="text" onClick={handleClearFilters}>
            Limpiar filtros
          </Button>
        )}
      </div>

      {error && (
        <Notice error title="Error al cargar vacantes">
          {error}
          <div style={{ marginTop: '8px' }}>
            <Button onClick={loadOpportunities}>Reintentar</Button>
          </div>
        </Notice>
      )}

      {loading && !error && (
        <div className={styles.emptyState} role="status">
          <p>Cargando oportunidades disponibles...</p>
        </div>
      )}

      {!loading && !error && opportunities.length === 0 && (
        <div className={styles.emptyState}>
          <h3>No se encontraron oportunidades</h3>
          <p>Prueba ajustando los términos de búsqueda o los filtros aplicados.</p>
          {(filterText || workplaceType !== 'ALL') && (
            <div style={{ marginTop: '12px' }}>
              <Button variant="secondary" onClick={handleClearFilters}>
                Restablecer filtros
              </Button>
            </div>
          )}
        </div>
      )}

      {!loading && !error && opportunities.length > 0 && (
        <div className={styles.listGrid}>
          {opportunities.map((opp) => (
            <Link
              key={opp.id}
              to={`/explorar/${opp.id}`}
              className={styles.card}
              data-testid={`opportunity-card-${opp.id}`}
            >
              <div className={styles.cardHeader}>
                <div className={styles.badges}>
                  {opp.is_demo && (
                    <span className={`${styles.badge} ${styles.badgeDemo}`}>Demo</span>
                  )}
                  <span className={`${styles.badge} ${styles.badgeWorkplace}`}>
                    {formatWorkplaceType(opp.workplace_type)}
                  </span>
                </div>
              </div>

              <div>
                <h2 className={styles.cardTitle}>{opp.title}</h2>
                <span className={styles.orgName}>{opp.organization.name}</span>
              </div>

              <div className={styles.cardMeta}>
                <div className={styles.metaItem}>
                  <span>📍 {opp.location}</span>
                </div>
                <div className={styles.metaItem}>
                  <span>💵 {formatSalary(opp.salary_amount, opp.salary_currency, opp.salary_period)}</span>
                </div>
                {opp.schedule_summary && (
                  <div className={styles.metaItem}>
                    <span>⏱️ {opp.schedule_summary}</span>
                  </div>
                )}
              </div>

              <div className={styles.cardFooter}>
                <span>{opp.available_slots} plaza{opp.available_slots === 1 ? '' : 's'} disponible{opp.available_slots === 1 ? '' : 's'}</span>
                <span style={{ color: 'var(--color-action)', fontWeight: 600 }}>Ver detalle →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
