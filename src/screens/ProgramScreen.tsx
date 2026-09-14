import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Card } from '../components/Card';
import { FadeInUp } from '../components/FadeInUp';
import { GradientButton } from '../components/GradientButton';
import { EmptyIllustration } from '../components/EmptyIllustration';
import { MedicalDisclaimer } from '../components/MedicalDisclaimer';
import { LocationToggle } from '../components/LocationToggle';
import { useCoach } from '../context/CoachContext';
import { useOnboarding, WorkoutLocation } from '../context/OnboardingContext';
import { DAY_LABELS, totalExercises, weeklySetsByMuscle } from '../services/coachProgram';
import { EQUIPMENT_META, muscleLabel } from '../data/muscleGroups';
import { colors, spacing, radius, font, gradients } from '../theme/colors';

/**
 * PROGRAMME DE LA SEMAINE
 * =======================
 *
 * L'ancien écran de programme listait des muscles recalculés à chaque
 * affichage, sans notion de séance ni de jour. Celui-ci présente le programme
 * réellement enregistré : les séances telles qu'elles seront jouées, avec ce
 * qui a déjà été fait cette semaine, et le volume hebdomadaire par muscle qui
 * montre concrètement où passe l'effort supplémentaire décidé par l'analyse.
 */
export function ProgramScreen({ navigation }: any) {
  const { program, doneThisWeek, stats, refresh, regenerateProgram, isReady } = useCoach();
  const { updateAnswers } = useOnboarding();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [rebuilding, setRebuilding] = useState(false);

  /**
   * Changer de lieu ne peut pas être un simple filtre d'affichage : les
   * exercices, le matériel et donc le volume ne sont pas les mêmes en salle et
   * à la maison. Le programme est réellement reconstruit, et le choix est
   * enregistré dans le profil.
   */
  const switchLocation = async (next: WorkoutLocation) => {
    if (rebuilding || program?.location === next) return;
    setRebuilding(true);
    try {
      updateAnswers({ workoutLocation: next });
      await regenerateProgram({ workoutLocation: next });
    } finally {
      setRebuilding(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  if (!isReady) return <View style={styles.container} />;

  if (!program) {
    return (
      <View style={styles.gate}>
        <View style={{ flex: 1 }} />
        <EmptyIllustration kind="body" width={150} color={colors.gym} />
        <Text style={styles.gateTitle}>Aucun programme pour l'instant</Text>
        <Text style={styles.gateText}>
          Ton programme se construit à partir des zones que l'IA identifie sur ta photo. Sans
          analyse, il n'y a rien de réel à te proposer.
        </Text>
        <View style={{ flex: 1 }} />
        <GradientButton
          label="Lancer l'analyse IA"
          icon="camera"
          gradient={gradients.gym}
          onPress={() => navigation.navigate('PhotoCapture')}
        />
      </View>
    );
  }

  const setsByMuscle = Object.entries(weeklySetsByMuscle(program)).sort((a, b) => b[1] - a[1]);
  const maxSets = setsByMuscle[0]?.[1] ?? 1;

  const rebuild = async () => {
    setRebuilding(true);
    try {
      await regenerateProgram();
    } finally {
      setRebuilding(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>CYCLE {program.cycle}</Text>
          <Text style={styles.title}>Mon programme</Text>
          <Text style={styles.subtitle}>
            {program.sessions.length} muscle{program.sessions.length > 1 ? 's' : ''} ciblé
            {program.sessions.length > 1 ? 's' : ''} · {totalExercises(program)} exercices ·{' '}
            {program.location === 'gym' ? 'salle' : 'maison'}
          </Text>
        </View>
        <Pressable onPress={() => navigation.navigate('NutritionPlan')} style={styles.headerBtn}>
          <MaterialCommunityIcons name="food-apple-outline" size={17} color={colors.brand} />
        </Pressable>
      </View>

      <LocationToggle
        value={program.location}
        onChange={switchLocation}
        disabled={rebuilding}
        caption={
          rebuilding
            ? 'Reconstruction du programme...'
            : "Change de lieu quand tu veux : les exercices et le matériel sont recalculés."
        }
        style={{ marginBottom: spacing.md }}
      />

      {/* Le lien avec l'analyse, dit explicitement : c'est la raison d'être de
          ce programme, pas une décoration. */}
      <View style={styles.scopeNote}>
        <Ionicons name="scan-outline" size={15} color={colors.brand} />
        <Text style={styles.scopeText}>
          {program.priorityMuscles.length > 0
            ? `Une séance par muscle détecté en retard sur ta photo : ${program.priorityMuscles
                .map(muscleLabel)
                .join(', ')}. Rien d'autre, pour que l'effort aille où il manque.`
            : "Aucune zone en retard détectée : séances d'entretien sur les muscles visibles de ta photo."}
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Tes séances</Text>

      {program.sessions.map((session, i) => {
        const done = doneThisWeek.has(session.id);
        const isOpen = expanded === session.id;
        return (
          <FadeInUp key={session.id} delay={i * 50}>
            <Card style={[styles.sessionCard, done && styles.sessionCardDone]}>
              <Pressable
                onPress={() => setExpanded(isOpen ? null : session.id)}
                style={styles.sessionHeader}
              >
                <View style={[styles.sessionIndex, done && styles.sessionIndexDone]}>
                  {done ? (
                    <Ionicons name="checkmark" size={15} color={colors.white} />
                  ) : (
                    <Text style={styles.sessionIndexText}>{session.index}</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sessionTitle}>{session.title}</Text>
                  <Text style={styles.sessionMeta}>
                    {DAY_LABELS[session.suggestedDay]} · {session.exercises.length} exercices · ~
                    {session.estimatedMinutes} min
                  </Text>
                </View>
                <Ionicons
                  name={isOpen ? 'chevron-up' : 'chevron-down'}
                  size={17}
                  color={colors.faint}
                />
              </Pressable>

              {isOpen ? (
                <View style={styles.exerciseList}>
                  {session.exercises.map((ex, j) => (
                    <View key={j} style={styles.exerciseRow}>
                      <View
                        style={[
                          styles.exerciseIcon,
                          ex.isPriority && { backgroundColor: `${colors.danger}1A` },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={EQUIPMENT_META[ex.equipment].icon as any}
                          size={16}
                          color={ex.isPriority ? colors.danger : colors.brand}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.exerciseName}>{ex.name}</Text>
                        <Text style={styles.exerciseMeta}>
                          {ex.muscleLabel} · {EQUIPMENT_META[ex.equipment].label}
                        </Text>
                      </View>
                      <Text style={styles.exerciseSets}>
                        {ex.sets} × {ex.reps}
                      </Text>
                    </View>
                  ))}
                  <Pressable
                    onPress={() => navigation.navigate('WorkoutSession', { sessionId: session.id })}
                    style={styles.startBtn}
                  >
                    <Ionicons name="play" size={14} color={colors.white} />
                    <Text style={styles.startBtnText}>
                      {done ? 'Refaire cette séance' : 'Démarrer cette séance'}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </Card>
          </FadeInUp>
        );
      })}

      {/* Volume par muscle : la traduction chiffrée de « cette zone est
          prioritaire ». Sans ce graphique, la priorité reste une affirmation. */}
      <Text style={styles.sectionTitle}>Volume hebdomadaire par muscle</Text>
      <Card style={styles.volumeCard}>
        {setsByMuscle.map(([muscle, sets]) => {
          const isPriority = program.priorityMuscles.includes(muscle as any);
          return (
            <View key={muscle} style={styles.volumeRow}>
              <Text style={[styles.volumeLabel, isPriority && { color: colors.text }]}>
                {muscleLabel(muscle)}
              </Text>
              <View style={styles.volumeTrack}>
                <View
                  style={[
                    styles.volumeFill,
                    {
                      width: `${(sets / maxSets) * 100}%`,
                      backgroundColor: isPriority ? colors.danger : colors.brand,
                    },
                  ]}
                />
              </View>
              <Text style={styles.volumeValue}>{sets}</Text>
            </View>
          );
        })}
        <Text style={styles.volumeNote}>
          Séries planifiées par semaine. Tu en as réalisé{' '}
          {Object.values(stats.recentSetsByMuscle).reduce((a, b) => a + b, 0)} sur les 14 derniers
          jours.
        </Text>
      </Card>

      <MedicalDisclaimer compact />

      <Pressable onPress={rebuild} disabled={rebuilding} style={styles.rebuildBtn}>
        <Ionicons name="refresh" size={15} color={colors.subtext} />
        <Text style={styles.rebuildText}>
          {rebuilding ? 'Reconstruction...' : 'Reconstruire depuis ma dernière analyse'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  gate: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, alignItems: 'center' },
  gateTitle: { ...font.h1, color: colors.text, marginTop: spacing.lg, textAlign: 'center' },
  gateText: {
    ...font.body,
    color: colors.subtext,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 21,
  },

  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md },
  eyebrow: { ...font.tiny, fontSize: 10, letterSpacing: 1.4, color: colors.gymAlt },
  title: { ...font.h1, color: colors.text, marginTop: 3 },
  subtitle: { ...font.caption, color: colors.subtext, marginTop: 2 },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scopeNote: {
    flexDirection: 'row',
    gap: 9,
    backgroundColor: `${colors.brand}12`,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  scopeText: { flex: 1, ...font.caption, color: colors.subtext, lineHeight: 18 },


  sectionTitle: { ...font.h3, color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm },

  sessionCard: { marginBottom: spacing.sm, gap: 0 },
  sessionCardDone: { opacity: 0.72 },
  sessionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sessionIndex: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: colors.bgSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionIndexDone: { backgroundColor: colors.success },
  sessionIndexText: { ...font.bodyBold, fontSize: 14, color: colors.gymAlt },
  sessionTitle: { ...font.h3, fontSize: 15, color: colors.text },
  sessionMeta: { ...font.tiny, fontSize: 10, fontWeight: '500', color: colors.subtext, marginTop: 2 },

  exerciseList: { marginTop: spacing.sm, gap: 2 },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  exerciseIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: `${colors.brand}14`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseName: { ...font.bodyBold, fontSize: 14, color: colors.text },
  exerciseMeta: { ...font.tiny, fontSize: 10, fontWeight: '500', color: colors.subtext, marginTop: 1 },
  exerciseSets: { ...font.tiny, color: colors.subtext },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.gym,
    borderRadius: radius.pill,
    paddingVertical: 11,
    marginTop: spacing.sm,
  },
  startBtnText: { ...font.tiny, color: colors.white },

  volumeCard: { gap: 9 },
  volumeRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  volumeLabel: { ...font.tiny, fontSize: 10, fontWeight: '600', color: colors.subtext, width: 86 },
  volumeTrack: {
    flex: 1,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.progressTrack,
    overflow: 'hidden',
  },
  volumeFill: { height: '100%', borderRadius: radius.pill },
  volumeValue: { ...font.tiny, fontSize: 10, color: colors.faint, width: 18, textAlign: 'right' },
  volumeNote: { ...font.tiny, fontSize: 10, fontWeight: '500', color: colors.faint, marginTop: 4 },

  rebuildBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: spacing.md,
  },
  rebuildText: { ...font.tiny, fontWeight: '600', color: colors.subtext },
});
