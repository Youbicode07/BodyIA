import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProgressBar } from '../components/ProgressBar';
import { useCoach } from '../context/CoachContext';
import { EQUIPMENT_META, youtubeSearchUrl } from '../data/muscleGroups';
import { WorkoutLogEntry } from '../services/workoutLog';
import { colors, spacing, radius, font, gradients } from '../theme/colors';

/**
 * SÉANCE EN COURS
 * ===============
 *
 * L'application proposait des exercices sans jamais permettre de dire qu'ils
 * avaient été faits. C'est cet écran qui alimente tout le reste : la
 * progression du tableau de bord, la régularité, et surtout le bilan à 15
 * jours, qui ne peut expliquer une stagnation que s'il sait ce qui a
 * réellement été réalisé.
 *
 * Une séance partiellement terminée est enregistrée comme telle : cocher la
 * moitié des exercices puis terminer n'écrit pas « séance complète ».
 */

const FEELINGS: { key: NonNullable<WorkoutLogEntry['feeling']>; label: string; icon: string }[] = [
  { key: 'facile', label: 'Facile', icon: 'emoticon-happy-outline' },
  { key: 'correct', label: 'Correct', icon: 'emoticon-neutral-outline' },
  { key: 'difficile', label: 'Difficile', icon: 'emoticon-dead-outline' },
];

export function WorkoutSessionScreen({ navigation, route }: any) {
  const { program, finishSession } = useCoach();
  const insets = useSafeAreaInsets();
  const sessionId: string | undefined = route?.params?.sessionId;

  const session = useMemo(
    () => program?.sessions.find((s) => s.id === sessionId) ?? program?.sessions[0] ?? null,
    [program, sessionId],
  );

  const [done, setDone] = useState<number[]>([]);
  const [feeling, setFeeling] = useState<WorkoutLogEntry['feeling']>();
  const [saving, setSaving] = useState(false);
  const startedAt = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!session) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Aucune séance à afficher.</Text>
        <Pressable onPress={() => navigation.goBack()} style={styles.emptyBtn}>
          <Text style={styles.emptyBtnText}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  const toggle = (index: number) =>
    setDone((prev) => (prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]));

  const progress = session.exercises.length > 0 ? done.length / session.exercises.length : 0;
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  const finish = async () => {
    if (done.length === 0) {
      Alert.alert(
        'Aucun exercice coché',
        "Coche au moins un exercice pour enregistrer la séance. Sans cela, rien n'aurait été réellement fait à enregistrer.",
      );
      return;
    }
    setSaving(true);
    try {
      await finishSession(session, done, {
        durationMin: Math.max(1, Math.round(elapsed / 60)),
        feeling,
      });
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  const quit = () => {
    if (done.length === 0) {
      navigation.goBack();
      return;
    }
    Alert.alert('Quitter la séance ?', 'Les exercices cochés ne seront pas enregistrés.', [
      { text: 'Continuer la séance', style: 'cancel' },
      { text: 'Quitter', style: 'destructive', onPress: () => navigation.goBack() },
    ]);
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={gradients.gym}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + spacing.md }]}
      >
        <View style={styles.heroTop}>
          <Pressable onPress={quit} hitSlop={12} style={styles.roundBtn}>
            <Ionicons name="close" size={19} color={colors.white} />
          </Pressable>
          <View style={styles.timer}>
            <Ionicons name="time-outline" size={13} color={colors.white} />
            <Text style={styles.timerText}>
              {minutes}:{String(seconds).padStart(2, '0')}
            </Text>
          </View>
        </View>
        <Text style={styles.heroTitle}>{session.title}</Text>
        <Text style={styles.heroSub}>
          {done.length} / {session.exercises.length} exercices · ~{session.estimatedMinutes} min
          prévues
        </Text>
        <View style={styles.heroProgress}>
          <ProgressBar progress={progress} />
        </View>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 160 }}
        showsVerticalScrollIndicator={false}
      >
        {session.exercises.map((ex, i) => {
          const checked = done.includes(i);
          const meta = EQUIPMENT_META[ex.equipment];
          return (
            <Pressable
              key={i}
              onPress={() => toggle(i)}
              style={[styles.card, checked && styles.cardDone]}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.checkbox, checked && styles.checkboxOn]}>
                  {checked ? <Ionicons name="checkmark" size={15} color={colors.white} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.name, checked && styles.nameDone]}>{ex.name}</Text>
                    {ex.isPriority ? (
                      <View style={styles.priorityTag}>
                        <Text style={styles.priorityTagText}>PRIORITÉ</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.meta}>
                    {ex.muscleLabel} · {meta.label}
                  </Text>
                </View>
                <View style={styles.setsBox}>
                  <Text style={styles.setsValue}>{ex.sets}</Text>
                  <Text style={styles.setsLabel}>× {ex.reps}</Text>
                </View>
              </View>

              <Text style={styles.description}>{ex.description}</Text>

              <Pressable
                onPress={() => Linking.openURL(youtubeSearchUrl(ex.name))}
                style={styles.videoLink}
                hitSlop={6}
              >
                <Ionicons name="logo-youtube" size={13} color={colors.danger} />
                <Text style={styles.videoLinkText}>Voir la technique</Text>
              </Pressable>
            </Pressable>
          );
        })}

        <Text style={styles.feelingTitle}>Comment as-tu ressenti la séance ?</Text>
        <View style={styles.feelingRow}>
          {FEELINGS.map((f) => (
            <Pressable
              key={f.key}
              onPress={() => setFeeling(feeling === f.key ? undefined : f.key)}
              style={[styles.feelingBtn, feeling === f.key && styles.feelingBtnOn]}
            >
              <MaterialCommunityIcons
                name={f.icon as any}
                size={20}
                color={feeling === f.key ? colors.white : colors.subtext}
              />
              <Text style={[styles.feelingText, feeling === f.key && { color: colors.white }]}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Pressable onPress={finish} disabled={saving}>
          <LinearGradient
            colors={done.length > 0 ? gradients.brand : [colors.progressTrack, colors.progressTrack]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.finishBtn}
          >
            <Ionicons
              name="checkmark-circle"
              size={19}
              color={done.length > 0 ? colors.white : colors.faint}
            />
            <Text style={[styles.finishText, done.length === 0 && { color: colors.faint }]}>
              {saving
                ? 'Enregistrement...'
                : done.length === session.exercises.length
                  ? 'Terminer la séance'
                  : `Enregistrer ${done.length} exercice${done.length > 1 ? 's' : ''}`}
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  empty: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyText: { ...font.body, color: colors.subtext },
  emptyBtn: { paddingHorizontal: spacing.lg, paddingVertical: 10, backgroundColor: colors.card, borderRadius: radius.pill },
  emptyBtnText: { ...font.caption, color: colors.text },

  hero: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roundBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  timerText: { ...font.tiny, color: colors.white },
  heroTitle: { ...font.h1, color: colors.white, marginTop: spacing.md },
  heroSub: { ...font.caption, color: 'rgba(255,255,255,0.88)', marginTop: 3 },
  heroProgress: { marginTop: spacing.md },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: 8,
  },
  cardDone: { backgroundColor: `${colors.success}14` },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 9,
    borderWidth: 1.8,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.success, borderColor: colors.success },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { ...font.bodyBold, fontSize: 15, color: colors.text, flexShrink: 1 },
  nameDone: { textDecorationLine: 'line-through', color: colors.subtext },
  priorityTag: {
    backgroundColor: `${colors.danger}22`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  priorityTagText: { ...font.tiny, fontSize: 8.5, color: colors.danger },
  meta: { ...font.tiny, fontSize: 10, fontWeight: '500', color: colors.subtext, marginTop: 2 },
  setsBox: { alignItems: 'flex-end' },
  setsValue: { ...font.h3, color: colors.gymAlt },
  setsLabel: { ...font.tiny, fontSize: 10, fontWeight: '500', color: colors.faint },
  description: { ...font.caption, color: colors.subtext, lineHeight: 18 },
  videoLink: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  videoLinkText: { ...font.tiny, fontWeight: '700', color: colors.danger },

  feelingTitle: { ...font.h3, fontSize: 15, color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm },
  feelingRow: { flexDirection: 'row', gap: spacing.sm },
  feelingBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  feelingBtnOn: { backgroundColor: colors.brand },
  feelingText: { ...font.tiny, fontSize: 10, color: colors.subtext },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  finishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: radius.pill,
  },
  finishText: { ...font.bodyBold, fontSize: 15, color: colors.white },
});
