import React, { useState } from 'react';
import { Routes, Route, Navigate, NavLink, Link } from 'react-router';
import { useSession } from './session';
import { ThemeSelect } from './theme';
import { AccessPage } from '../features/access/AccessPage';
import { HomePage } from '../features/home/HomePage';
import { AccountStep } from '../features/profile/AccountStep';
import { ExperienceStep } from '../features/profile/ExperienceStep';
import { AvailabilityStep } from '../features/profile/AvailabilityStep';
import { ReviewStep } from '../features/profile/ReviewStep';
import { ProfilePage } from '../features/profile/ProfilePage';
import { OpportunitiesPage } from '../features/opportunities/OpportunitiesPage';
import { OpportunityDetailPage } from '../features/opportunities/OpportunityDetailPage';
import { CoursesPage } from '../features/courses/CoursesPage';
import { CourseDetailPage } from '../features/courses/CourseDetailPage';
import { TrainingCenterPage } from '../features/training-center/TrainingCenterPage';
import { LearningRoutePage } from '../features/learning-route/LearningRoutePage';
import { ReservationConfirmPage } from '../features/learning-route/ReservationConfirmPage';
import { AgendaPage } from '../features/agenda/AgendaPage';
import { CompanyRecruitmentPage } from '../features/recruitment/CompanyRecruitmentPage';
import { JobDraftEditorPage } from '../features/recruitment/JobDraftEditorPage';
import { CounselorInboxPage } from '../features/orientation/CounselorInboxPage';
import { CounselorDetailPage } from '../features/orientation/CounselorDetailPage';
import { Button, Notice } from '../components/Controls';
import { Brand } from '../components/Brand';
import { fetchData } from '../lib/api';
import styles from '../styles/App.module.css';

function AccountPage() {
  const { me, session, signOut } = useSession();
  const [orgDetails, setOrgDetails] = useState<Record<string, string>>({});

  const loadOrg = async (id: string) => {
    if (!session?.access_token || orgDetails[id]) return;
    try {
      const res = await fetchData<{ organization: { name: string } }>(`/organizations/${id}/context`, session.access_token);
      setOrgDetails((prev) => ({ ...prev, [id]: res.organization.name }));
    } catch {
      setOrgDetails((prev) => ({ ...prev, [id]: 'Error al cargar nombre' }));
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.stack}>
        <h1 style={{ margin: 0 }}>Mi cuenta</h1>
        <p><strong>Correo electrónico:</strong> {me?.email}</p>
        <p><strong>Perfil privado:</strong> {me?.profile ? 'Activo' : 'No iniciado'}</p>
        <div>
          <h3 style={{ margin: '8px 0' }}>Organizaciones vinculadas</h3>
          {me?.contexts.length ? (
            <ul className={styles.accountList}>
              {me.contexts.map((ctx) => (
                <li key={ctx.membership_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '6px 0' }}>
                  <span>
                    <strong>{orgDetails[ctx.organization.id] || ctx.organization.name}</strong> ({ctx.role})
                  </span>
                  {ctx.organization.type === 'COMPANY' && (ctx.role === 'ADMIN' || ctx.role === 'RECRUITER') && (
                    <Link to={`/organizaciones/${ctx.organization.id}/vacantes`}>
                      <Button variant="secondary" style={{ fontSize: '13px', padding: '4px 10px' }}>
                        Gestionar Vacantes A01
                      </Button>
                    </Link>
                  )}
                  {ctx.organization.type === 'TRAINING_CENTER' && ['ADMIN','TRAINING_MANAGER'].includes(ctx.role) && <Link to="/centro"><Button variant="secondary">Gestionar cursos y participantes</Button></Link>}
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.muted}>No perteneces a ninguna organización.</p>
          )}
        </div>
        <div>
          <Button variant="secondary" onClick={() => signOut()}>Cerrar sesión</Button>
        </div>
      </div>
    </div>
  );
}

function StaticFeaturePage({ title, desc }: { title: string; desc: string }) {
  return (
    <div className={styles.card}>
      <h1 style={{ margin: '0 0 12px' }}>{title}</h1>
      <p className={styles.muted}>{desc}</p>
    </div>
  );
}

function ProtectedLayout() {
  const { session, me, loading, error, reload, signOut } = useSession();

  if (loading && !me) {
    return <div className={styles.layout}><main className={styles.main}><p>Cargando sesión...</p></main></div>;
  }
  if (!session) {
    return <Navigate to="/acceso" replace />;
  }
  if (error || !me) {
    return (
      <div className={styles.layout}>
        <main className={styles.main}>
          <Notice error title="Error de carga de sesión">
            {error || 'No se pudo obtener la información de usuario.'}
          </Notice>
          <div className={styles.actions} style={{ marginTop: '16px' }}>
            <Button onClick={reload}>Reintentar</Button>
            <Button variant="secondary" onClick={() => signOut()}>Cerrar sesión</Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      <a href="#contenido" className={styles.skipLink}>Saltar al contenido</a>
      <header className={styles.header}>
        <Link to="/inicio" className={styles.brand} aria-label="AImpulsa, ir a Inicio"><Brand /></Link>
        <nav className={styles.desktopNav} aria-label="Principal">
          <NavLink to="/inicio" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}>Inicio</NavLink>
          <NavLink to="/explorar" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}>Explorar</NavLink>
          <NavLink to="/cursos" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}>Cursos</NavLink>
          <NavLink to="/mi-ruta" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}>Mi Ruta</NavLink>
          <NavLink to="/agenda" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}>Agenda</NavLink>
        </nav>
        <div className={styles.accountActions}>
          <NavLink to="/mi-cuenta" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}>Mi cuenta</NavLink>
          {me.contexts.some(context=>context.organization.type==='TRAINING_CENTER'&&['ADMIN','TRAINING_MANAGER'].includes(context.role))&&<NavLink to="/centro" className={styles.navLink}>Mi centro</NavLink>}
          {me.counselor && (
            <NavLink to="/orientador/bandeja" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}>
              Orientador
            </NavLink>
          )}
          <ThemeSelect />
          <Button variant="text" onClick={() => signOut()}>Cerrar sesión</Button>
        </div>
      </header>
      <main id="contenido" className={styles.main}>
        <Routes>
          <Route path="/inicio" element={<HomePage />} />
          <Route path="/centro" element={<TrainingCenterPage />} />
          <Route path="/perfil" element={<ProfilePage />} />
          <Route path="/perfil/cuenta" element={<AccountStep />} />
          <Route path="/perfil/trayectoria" element={<ExperienceStep />} />
          <Route path="/perfil/disponibilidad" element={<AvailabilityStep />} />
          <Route path="/perfil/revision" element={<ReviewStep />} />
          <Route path="/explorar" element={<OpportunitiesPage />} />
          <Route path="/explorar/:id" element={<OpportunityDetailPage />} />
          <Route path="/cursos" element={<CoursesPage />} />
          <Route path="/cursos/:id" element={<CourseDetailPage />} />
          <Route path="/mi-ruta" element={<LearningRoutePage />} />
          <Route path="/mi-ruta/reservar" element={<ReservationConfirmPage />} />
          <Route path="/agenda" element={<AgendaPage />} />
          <Route path="/organizaciones/:orgId/vacantes" element={<CompanyRecruitmentPage />} />
          <Route path="/organizaciones/:orgId/vacantes/nueva" element={<JobDraftEditorPage />} />
          <Route path="/orientador/bandeja" element={<CounselorInboxPage />} />
          <Route path="/orientador/casos/:id" element={<CounselorDetailPage />} />
          <Route path="/mi-cuenta" element={<AccountPage />} />
          <Route path="*" element={<StaticFeaturePage title="Página no encontrada" desc="La ruta solicitada no existe." />} />
        </Routes>
      </main>
      <nav className={styles.bottomNav} aria-label="Móvil">
        <NavLink to="/inicio" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}>
          <img src="/assets/nav-home.svg" alt="" width="24" height="24" />
          <span>Inicio</span>
        </NavLink>
        <NavLink to="/explorar" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}>
          <img src="/assets/nav-explore.svg" alt="" width="24" height="24" />
          <span>Explorar</span>
        </NavLink>
        <NavLink to="/mi-ruta" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}>
          <img src="/assets/nav-route.svg" alt="" width="24" height="24" />
          <span>Mi Ruta</span>
        </NavLink>
        <NavLink to="/agenda" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}>
          <img src="/assets/nav-agenda.svg" alt="" width="24" height="24" />
          <span>Agenda</span>
        </NavLink>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/inicio" replace />} />
      <Route path="/acceso" element={<AccessPage />} />
      <Route path="/registro/cuenta" element={<AccessPage />} />
      <Route path="/recuperar" element={<AccessPage />} />
      <Route path="/*" element={<ProtectedLayout />} />
    </Routes>
  );
}
