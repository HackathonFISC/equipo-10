import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useDraft } from './useDraft';
import { Button, Notice, ProgressSteps } from '../../components/Controls';
import { ExperienceList } from './ExperienceList';
import { TrainingList } from './TrainingList';
import { InterestsList } from './InterestsList';
import { SourceUploadModal } from './SourceUploadModal';
import { A02SuggestionsViewer } from './A02SuggestionsViewer';
import type {
  ExperienceItem,
  TrainingItem,
  InterestItem,
  InterpretationRunView,
  SuggestionBatchDecisionResponse,
} from '@equipo10/contracts';
import styles from './ExperienceStep.module.css';

interface ExperienceStepProps {
  onContinue?: () => void;
}

export function ExperienceStep({ onContinue }: ExperienceStepProps) {
  const navigate = useNavigate();
  const manualSection = useRef<HTMLDivElement>(null);
  const openingAssistant = useRef(false);
  const {
    draft,
    etag,
    loading,
    saving,
    conflict,
    error,
    saveExperience,
    saveTraining,
    saveInterests,
    reload,
  } = useDraft();

  const [experiences, setExperiences] = useState<ExperienceItem[]>([]);
  const [noExperience, setNoExperience] = useState(false);

  const [trainings, setTrainings] = useState<TrainingItem[]>([]);
  const [noTraining, setNoTraining] = useState(false);

  const [interests, setInterests] = useState<InterestItem[]>([]);
  const [noInterests, setNoInterests] = useState(false);

  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [analysisSources, setAnalysisSources] = useState<{ id: string; version: number }[]>([]);
  const [interviewText, setInterviewText] = useState("");
  const [activeInterpretationRun, setActiveInterpretationRun] = useState<InterpretationRunView | null>(null);

  // Sync draft state on load
  useEffect(() => {
    if (draft) {
      setExperiences(draft.experiences || []);
      setNoExperience(draft.experience_status === 'NONE');

      setTrainings(draft.trainings || []);
      setNoTraining(draft.training_status === 'NONE');

      setInterests(draft.interests || []);
      setNoInterests(draft.interests_status === 'NONE');
    }
  }, [draft]);

  const handleToggleNoExperience = (none: boolean) => {
    setNoExperience(none);
    if (none) {
      setExperiences([]);
    }
  };

  const handleToggleNoTraining = (none: boolean) => {
    setNoTraining(none);
    if (none) {
      setTrainings([]);
    }
  };

  const handleToggleNoInterests = (none: boolean) => {
    setNoInterests(none);
    if (none) {
      setInterests([]);
    }
  };

  const handleSaveAndContinue = async () => {
    setSuccessNotice(null);

    // 1. Save experiences
    const expSuccess = await saveExperience({
      status: noExperience ? 'NONE' : experiences.length > 0 ? 'PROVIDED' : 'UNKNOWN',
      items: noExperience ? [] : experiences,
    });
    if (!expSuccess) return;

    // 2. Save training
    const trainSuccess = await saveTraining({
      status: noTraining ? 'NONE' : trainings.length > 0 ? 'PROVIDED' : 'UNKNOWN',
      items: noTraining ? [] : trainings,
    });
    if (!trainSuccess) return;

    // 3. Save interests
    const intSuccess = await saveInterests({
      status: noInterests ? 'NONE' : interests.length > 0 ? 'PROVIDED' : 'UNKNOWN',
      items: noInterests ? [] : interests,
    });
    if (!intSuccess) return;

    setSuccessNotice('Trayectoria e intereses guardados correctamente.');
    if (onContinue) {
      onContinue();
    } else {
      navigate('/perfil/disponibilidad');
    }
  };

  useEffect(() => {
    if (!activeInterpretationRun && !loading && successNotice) {
      manualSection.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
      manualSection.current?.focus({ preventScroll: true });
    }
  }, [activeInterpretationRun, loading, successNotice]);

  const openAssistant = async () => {
    if (!draft || openingAssistant.current) return;
    openingAssistant.current = true;
    try {
      // Preserve manual edits before analysis replaces form state with persisted data.
      if (JSON.stringify(experiences) !== JSON.stringify(draft.experiences) || noExperience !== (draft.experience_status === 'NONE')) {
        if (!await saveExperience({ status: noExperience ? 'NONE' : experiences.length ? 'PROVIDED' : 'UNKNOWN', items: noExperience ? [] : experiences })) return;
      }
      if (JSON.stringify(trainings) !== JSON.stringify(draft.trainings) || noTraining !== (draft.training_status === 'NONE')) {
        if (!await saveTraining({ status: noTraining ? 'NONE' : trainings.length ? 'PROVIDED' : 'UNKNOWN', items: noTraining ? [] : trainings })) return;
      }
      if (JSON.stringify(interests) !== JSON.stringify(draft.interests) || noInterests !== (draft.interests_status === 'NONE')) {
        if (!await saveInterests({ status: noInterests ? 'NONE' : interests.length ? 'PROVIDED' : 'UNKNOWN', items: noInterests ? [] : interests })) return;
      }
      setInterviewText(""); setAnalysisSources([]); setUploadModalOpen(true);
    } finally { openingAssistant.current = false; }
  };

  const handleDecisionsApplied = (response: SuggestionBatchDecisionResponse) => {
    setActiveInterpretationRun(null);
    setSuccessNotice(response.accepted_count ? 'Añadimos ' + response.accepted_count + ' datos a tu borrador privado. Ahora puedes revisarlos y agregar otras experiencias o cursos.' : 'Guardamos tus elecciones. No añadimos datos nuevos. Puedes seguir completando tu trayectoria manualmente.');
    reload();
  };

  if (loading && !draft) {
    return (
      <div className={styles.container}>
        <p className={styles.subtitle}>Cargando trayectoria...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <ProgressSteps current={1} />

      <header className={styles.header}>
        <span className={styles.eyebrow}>Paso 2 de 4 · Trayectoria</span>
        <h1 className={styles.title}>Tus experiencias cuentan.</h1>
        <p className={styles.subtitle}>
          Formal, informal, voluntariado o proyectos propios. No necesitas un CV para continuar.
        </p>
      </header>

      {conflict && (
        <Notice error title="Conflicto de versión (HTTP 412)">
          El borrador cambió en otra pestaña o sesión.
          <div style={{ marginTop: '8px' }}>
            <Button variant="secondary" onClick={reload}>
              Recargar versión del servidor
            </Button>
          </div>
        </Notice>
      )}

      {error && !conflict && <Notice error>{error}</Notice>}
      {successNotice && <Notice>{successNotice}</Notice>}

      {!activeInterpretationRun && <div className={styles.aiBanner}>
        <div className={styles.aiBannerContent}>
          <h3 className={styles.aiBannerTitle}>
            <span>Ayuda para completar tu trayectoria</span>
            <span className={styles.aiBannerBadge}>IA Asistida</span>
          </h3>
          <p className={styles.aiBannerDesc}>
            ¿Tienes un CV en PDF digital o prefieres escribir tu relato libremente?
            Revisaremos tu información contigo. Podrás responder preguntas, corregir datos y elegir qué añadir.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={openAssistant}
          disabled={saving || conflict || !draft}
        >
          Leer mi CV o contar mi experiencia
        </Button>
      </div>}

      {activeInterpretationRun && draft && (
        <A02SuggestionsViewer
            key={activeInterpretationRun.run_id}
            onClarify={(answers) => { setInterviewText(answers); setUploadModalOpen(true); }}
          runView={activeInterpretationRun}
          draftRevision={draft.revision}
          onDecisionsApplied={handleDecisionsApplied}
          onDismiss={() => { setActiveInterpretationRun(null); setSuccessNotice("Puedes completar tu trayectoria manualmente. No añadimos los datos de esta revisión."); }}
        />
      )}

      {!activeInterpretationRun && <div className={styles.contentGrid} ref={manualSection} tabIndex={-1} aria-label="Completar trayectoria manualmente">
        <div className={styles.formCard}>
          <ExperienceList
            items={experiences}
            noneDeclared={noExperience}
            onToggleNone={handleToggleNoExperience}
            onChangeItems={setExperiences}
            disabled={saving || conflict}
          />

          <TrainingList
            items={trainings}
            noneDeclared={noTraining}
            onToggleNone={handleToggleNoTraining}
            onChangeItems={setTrainings}
            disabled={saving || conflict}
          />

          <InterestsList
            items={interests}
            noneDeclared={noInterests}
            onToggleNone={handleToggleNoInterests}
            onChangeItems={setInterests}
            disabled={saving || conflict}
          />

          <div className={styles.actions}>
            <Button
              type="button"
              onClick={handleSaveAndContinue}
              disabled={saving || conflict}
            >
              {saving ? 'Guardando...' : 'Guardar y continuar a Disponibilidad'}
            </Button>
            {etag && (
              <span className={styles.statusText}>
                Revisión activa: v{etag}
              </span>
            )}
          </div>
        </div>

        <aside className={styles.infoCard}>
          <h2 className={styles.infoTitle}>Toda experiencia suma</h2>
          <p className={styles.infoDesc}>
            En la plataforma valoramos lo que has hecho en la vida real, no solo contratos formales.
          </p>

          <div className={styles.infoHighlights}>
            <div className={styles.highlightItem}>
              <span className={styles.highlightIcon}>✓</span>
              <span>Trabajos informales o ayuda en negocios familiares demuestran compromiso y responsabilidad.</span>
            </div>
            <div className={styles.highlightItem}>
              <span className={styles.highlightIcon}>✓</span>
              <span>Proyectos independientes o voluntariados reflejan proactividad y resolución de problemas.</span>
            </div>
            <div className={styles.highlightItem}>
              <span className={styles.highlightIcon}>✓</span>
              <span>Si estás empezando de cero, simplemente marca que no tienes experiencia y te ayudaremos a formarte.</span>
            </div>
          </div>

          <span className={styles.infoMeta}>Sin sesgos ni exigencias de CV rígido</span>
        </aside>
      </div>}

      {draft && (
        <SourceUploadModal
          key={uploadModalOpen ? "open-" + interviewText : "closed"}
          initialText={interviewText}
          previousSources={interviewText ? analysisSources : []}
          draftId={draft.id}
          draftRevision={draft.revision}
          isOpen={uploadModalOpen}
          onClose={() => setUploadModalOpen(false)}
          onInterpretationReady={(runView, sources) => {
            setAnalysisSources(sources);
            setInterviewText("");
            setUploadModalOpen(false);
            setActiveInterpretationRun(runView);
          }}
        />
      )}
    </div>
  );
}
