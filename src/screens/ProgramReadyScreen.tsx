import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientButton } from '../components/GradientButton';
import { Card } from '../components/Card';
import { FadeInUp } from '../components/FadeInUp';
import { EmptyIllustration } from '../components/EmptyIllustration';
import { MuscleBodyDiagram } from '../components/MuscleBodyDiagram';
import { MedicalDisclaimer } from '../components/MedicalDisclaimer';
import { LocationToggle } from '../components/LocationToggle';
import { useOnboarding, WorkoutLocation } from '../context/OnboardingContext';
import { useCoach } from '../context/CoachContext';
import { DAY_LABELS, totalExercises } from '../services/coachProgram';
import { EQUIPMENT_META, muscleLabel } from '../data/muscleGroups';
import { colors, spacing, radius, font, gradients } from '../theme/colors';

/**
 * PROGRAMME PRÊT
 * ==============
 *
 * Cet écran présentait une liste de muscles recalculée à la volée, sans rapport
 * avec ce que l'utilisateur allait ensuite retrouver dans l'application. Il
 * montre maintenant le programme RÉELLEMENT enregistré — les mêmes séances,
 * les mêmes exercices, les mêmes séries que l'onglet Programme.
 *
 * Sans analyse, rien n'est fabriqué : un plan générique présenté comme
 * personnalisé ferait croire à un travail qui n'a pas eu lieu.
 */
export function ProgramReadyScreen({ navigation }: any) {
  const { updateAnswers } = useOnboarding();
  const { program, regenerateProgram } = useCoach();
  const [switching, setSwitching] = useState(false);

  const switchLocation = async (next: WorkoutLocation) => {
    if (switching || program?.location === next) return;
    setSwitching(true);
    try {
      updateAnswers({ workoutLocation: next });
      // La mise à jour ci-dessus ne sera visible qu'au prochain rendu : on
      // passe donc le nouveau lieu directement, sinon le programme serait
      // reconstruit avec l'ancien.
      await regenerateProgram({ workoutLocation: next });
    } finally {
      setSwitching(false);
    }
  };

  if (!program) {
    return (
      <View style={styles.gateContainer}>
        <View style={{ flex: 1 }} />
        <EmptyIllustration kind="body" width={150} color={colors.gym} />
        <Text style={styles.gateTitle}>Aucun programme pour l'instant</Text>
        <Text style={styles.gateText}>
          Ton programme est construit à partir des zones que l'IA identifie sur ta photo. Sans
          analyse, il n'y a rien de réel à te proposer.
        </Text>
        <View style={{ flex: 1 }} />
        <GradientButton
          label="Lancer l'analyse IA"
          icon="camera"
          gradient={gradients.gym}
          onPress={() => navigation.navigate('PhotoCapture')}
        />
        <Pressable onPress={() => navigation.navigate('Rating')} style={styles.gateSkip}>
          <Text style={styles.gateSkipText}>Continuer sans programme</Text>
        </Pressable>
      </View>
    );
  }

  const isGym = program.location === 'gym';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: spacing.xxl }}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={gradients.gym}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroIcon}>
          <Ionicons name="checkmark" size={30} color={colors.white} />
        </View>
        <Text style={styles.heroTitle}>Ton programme est prêt</Text>
        <Text style={styles.heroSub}>
          {isGym ? 'Salle de sport' : 'À la maison'} · {program.sessions.length} muscle
          {program.sessions.length > 1 ? 's' : ''} ciblé{program.sessions.length > 1 ? 's' : ''} ·{' '}
          {totalExercises(program)} exercices
        </Text>
      </LinearGradient>

      {/* Le choix reste ouvert ici : quelqu'un qui découvre son programme doit
          pouvoir dire « en fait je m'entraîne à la maison » sans tout refaire. */}
      <LocationToggle
        value={program.location}
        onChange={switchLocation}
        disabled={switching}
        caption={switching ? 'Reconstruction du programme...' : undefined}
        style={styles.placeToggleWrap}
      />

      <View style={styles.scopeNote}>
        <Ionicons name="scan-outline" size={14} color={colors.subtext} />
        <Text style={styles.scopeText}>
          {program.priorityMuscles.length > 0
            ? `Une séance par zone détectée en retard : ${program.priorityMuscles.map(muscleLabel).join(', ')}. Trois exercices chacune, rien de plus.`
            : "Aucun déséquilibre détecté : séances d'entretien sur tes muscles analysés."}
        </Text>
      </View>

      <View style={styles.body}>
        {program.sessions.map((session, i) => (
          <FadeInUp key={session.id} delay={i * 55}>
            <Card style={styles.dayCard}>
              <View style={styles.dayHeader}>
                {/* Silhouette avec les muscles de la séance allumés */}
                <View style={styles.diagram}>
                  <MuscleBodyDiagram
                    highlight={session.focusMuscles}
                    color={
                      session.exercises.some((e) => e.isPriority) ? colors.danger : colors.brand
                    }
                    width={30}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.muscle}>{session.title}</Text>
                  <Text style={styles.recommendation}>
                    {session.exercises.length} exercices ciblés
                  </Text>
                </View>
                <View style={styles.freqPill}>
                  <Ionicons name="time-outline" size={11} color={colors.brand} />
                  <Text style={styles.freqText}>~{session.estimatedMinutes} min</Text>
                </View>
              </View>

              <Text style={styles.dayHint}>
                {DAY_LABELS[session.suggestedDay]} conseillé
              </Text>

              {session.exercises.map((ex, j, arr) => {
                const meta = EQUIPMENT_META[ex.equipment];
                return (
                  <View
                    key={j}
                    style={[
                      styles.exerciseRow,
                      j === arr.length - 1 && { borderBottomWidth: 0, paddingBottom: 0 },
                    ]}
                  >
                    <View
                      style={[
                        styles.equipmentIcon,
                        ex.isPriority && { backgroundColor: `${colors.danger}1A` },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={meta.icon as any}
                        size={18}
                        color={ex.isPriority ? colors.danger : colors.brand}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.exerciseName}>{ex.name}</Text>
                      <Text style={styles.exerciseMeta}>
                        {ex.muscleLabel} · {meta.label}
                      </Text>
                    </View>
                    <View style={styles.setsPill}>
                      <Text style={styles.setsText}>
                        {ex.sets} × {ex.reps}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </Card>
          </FadeInUp>
        ))}

        <MedicalDisclaimer compact />

        <GradientButton
          label="Sauvegarder ma progression"
          icon="checkmark-circle"
          onPress={() => navigation.navigate('Rating')}
          style={{ marginTop: spacing.md }}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  gateContainer: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, alignItems: 'center' },
  gateTitle: { ...font.h1, color: colors.text, marginTop: spacing.lg, textAlign: 'center' },
  gateText: {
    ...font.body, color: colors.subtext, textAlign: 'center',
    marginTop: spacing.sm, lineHeight: 21, paddingHorizontal: spacing.md,
  },
  gateSkip: { alignItems: 'center', paddingVertical: spacing.md },
  gateSkipText: { ...font.caption, color: colors.subtext, fontWeight: '600' },
  hero: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  heroIcon: {
    width: 62, height: 62, borderRadius: 31, backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
  },
  heroTitle: { ...font.h1, color: colors.white },
  heroSub: { ...font.caption, color: 'rgba(255,255,255,0.88)', marginTop: 4, textAlign: 'center' },

  placeToggleWrap: { marginHorizontal: spacing.lg, marginTop: spacing.md },

  scopeNote: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: spacing.lg, paddingTop: spacing.md,
  },
  scopeText: { flex: 1, ...font.tiny, fontWeight: '500', color: colors.subtext, lineHeight: 16 },
  body: { padding: spacing.lg },
  dayCard: { marginBottom: spacing.sm, backgroundColor: colors.card, borderColor: colors.cardBorder },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  diagram: {
    width: 42, height: 66, borderRadius: 12, backgroundColor: colors.bgSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  muscle: { ...font.h3, fontSize: 15, color: colors.text },
  freqPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: `${colors.brand}12`, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill,
  },
  freqText: { ...font.tiny, fontSize: 10, color: colors.brand },
  recommendation: { ...font.caption, color: colors.subtext, lineHeight: 18 },
  dayHint: { ...font.tiny, fontSize: 10, fontWeight: '500', color: colors.faint, marginBottom: spacing.xs },

  exerciseRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.cardBorder,
  },
  equipmentIcon: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: `${colors.brand}10`,
    alignItems: 'center', justifyContent: 'center',
  },
  exerciseName: { ...font.bodyBold, fontSize: 14, color: colors.text },
  exerciseMeta: { ...font.tiny, fontWeight: '500', color: colors.subtext, marginTop: 1 },
  setsPill: { backgroundColor: colors.bgSoft, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  setsText: { ...font.tiny, color: colors.text },
});
