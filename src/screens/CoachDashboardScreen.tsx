import React, { useCallback, useMemo } from 'react';
import { View, Text, ScrollView, Image, Pressable, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { Card } from '../components/Card';
import { FadeInUp } from '../components/FadeInUp';
import { ScoreRing } from '../components/ScoreRing';
import { MuscleBodyDiagram } from '../components/MuscleBodyDiagram';
import { GradientButton } from '../components/GradientButton';
import { EmptyIllustration } from '../components/EmptyIllustration';
import { useCoach } from '../context/CoachContext';
import { useOnboarding } from '../context/OnboardingContext';
import { useUser } from '../context/UserContext';
import { useNutrition } from '../context/NutritionContext';
import { buildNutritionPlan } from '../services/nutritionPlan';
import { DAY_LABELS } from '../services/coachProgram';
import { muscleLabel } from '../data/muscleGroups';
import { colors, spacing, radius, font, gradients, shadow } from '../theme/colors';

/**
 * TABLEAU DE BORD DU COACH
 * ========================
 *
 * L'écran d'accueil affichait « 42 % » et « 0 séance terminée » écrits en dur,
 * au-dessus d'un suivi nutritionnel. Il ne mesurait donc rien de
 * l'entraînement, faute de programme et de journal à lire.
 *
 * Ici, chaque chiffre vient d'une donnée enregistrée : les séances réellement
 * terminées cette semaine, la régularité mesurée sur le journal, les zones
 * issues de la dernière analyse, et l'échéance exacte du prochain suivi. Quand
 * une donnée n'existe pas encore, l'écran le dit et propose l'action qui la
 * créera — jamais un chiffre de remplissage.
 */

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bonjour';
  if (h < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

const todayLabel = () =>
  new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

const DAY_MS = 24 * 60 * 60 * 1000;

export function CoachDashboardScreen({ navigation }: any) {
  const { answers } = useOnboarding();
  const { user } = useUser();
  const { totals } = useNutrition();
  const {
    isReady,
    program,
    stats,
    upcoming,
    doneThisWeek,
    history,
    nextCheckIn,
    refresh,
  } = useCoach();

  // Les données changent depuis d'autres écrans (fin de séance, nouvelle
  // analyse) : on relit à chaque retour sur l'onglet plutôt que de garder un
  // état figé au premier montage.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const plan = useMemo(() => buildNutritionPlan(answers), [answers]);
  const priorityZones = useMemo(
    () =>
      (answers.analysis?.zones ?? []).filter(
        (z) => z.status === 'priority' && z.visible !== false && !z.isGeneric,
      ),
    [answers.analysis],
  );

  const daysToCheckIn = nextCheckIn
    ? Math.ceil((nextCheckIn - Date.now()) / DAY_MS)
    : undefined;

  const hasAnalysis = history.length > 0 || Boolean(answers.analysis);

  if (!isReady) {
    return <View style={styles.container} />;
  }

  // Aucune analyse : rien d'honnête à mettre dans un tableau de bord de
  // progression. On propose l'action qui le remplira.
  if (!hasAnalysis) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.emptyWrap}>
        <Text style={styles.eyebrow}>TON ESPACE COACHING</Text>
        <Text style={styles.greeting}>
          {greeting()}
          {user?.name ? `, ${user.name}` : ''}
        </Text>
        <View style={{ height: spacing.xl }} />
        <EmptyIllustration kind="body" width={160} color={colors.brand} />
        <Text style={styles.emptyTitle}>Ton coach attend ta première photo</Text>
        <Text style={styles.emptyText}>
          L'IA identifie tes trois zones à travailler en priorité, puis construit ton programme
          autour d'elles. Sans photo, il n'y a rien de réel à suivre.
        </Text>
        <GradientButton
          label="Lancer mon analyse"
          icon="camera"
          gradient={gradients.muscle}
          onPress={() => navigation.navigate('PhotoCapture')}
          style={{ marginTop: spacing.xl, alignSelf: 'stretch' }}
        />
        <Pressable onPress={() => navigation.navigate('Nutrition')} style={styles.secondaryLink}>
          <Ionicons name="restaurant-outline" size={15} color={colors.subtext} />
          <Text style={styles.secondaryLinkText}>Voir mon suivi nutrition</Text>
        </Pressable>
      </ScrollView>
    );
  }

  const weekDays = DAY_LABELS.map((label, day) => ({
    label: label.slice(0, 1),
    session: program?.sessions.find((s) => s.suggestedDay === day),
    day,
  }));
  const todayIndex = (new Date().getDay() + 6) % 7;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>TON ESPACE COACHING</Text>
          <Text style={styles.greeting}>
            {greeting()}
            {user?.name ? `, ${user.name}` : ''}
          </Text>
          <Text style={styles.date}>{todayLabel()}</Text>
        </View>
        <Pressable onPress={() => navigation.navigate('Profil')} style={styles.avatar}>
          {user?.photoUrl ? (
            <Image source={{ uri: user.photoUrl }} style={styles.avatarImage} />
          ) : (
            <Ionicons name="person" size={19} color={colors.brand} />
          )}
        </Pressable>
      </View>

      {/* Régularité de la semaine, lue dans le journal d'entraînement. Ce
          n'est pas une estimation : chaque séance a été cochée. */}
      <FadeInUp>
        <Card style={styles.heroCard}>
          <ScoreRing
            value={stats.weeklyCompletion}
            display={`${stats.thisWeek}/${stats.weeklyTarget}`}
            label="SÉANCES CETTE SEMAINE"
            sublabel="Objectif hebdomadaire"
            size={136}
          />
          <View style={styles.heroSide}>
            <Text style={styles.heroTitle}>
              {stats.totalSessions > 0 ? 'Ton suivi est lancé' : 'Premier objectif : la régularité'}
            </Text>
            <Text style={styles.heroText} numberOfLines={4}>
              Termine tes séances de la semaine : c'est ce que ta prochaine analyse comparera à ta
              photo d'aujourd'hui.
            </Text>
            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{stats.totalSessions}</Text>
                <Text style={styles.heroStatLabel}>séances</Text>
              </View>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{stats.streakWeeks}</Text>
                <Text style={styles.heroStatLabel}>sem. d'affilée</Text>
              </View>
            </View>
          </View>
        </Card>
      </FadeInUp>

      {history.length > 1 ? (
        <Pressable onPress={() => navigation.navigate('ProgressHistory')} style={styles.reportLink}>
          <Ionicons name="stats-chart-outline" size={15} color={colors.brand} />
          <Text style={styles.reportLinkText}>Comparer tes analyses zone par zone</Text>
          <Ionicons name="chevron-forward" size={15} color={colors.brand} />
        </Pressable>
      ) : null}

      {/* Prochaine séance */}
      <Text style={styles.sectionTitle}>Ta prochaine séance</Text>
      {upcoming ? (
        <FadeInUp delay={60}>
          <Pressable onPress={() => navigation.navigate('WorkoutSession', { sessionId: upcoming.id })}>
            <LinearGradient
              colors={gradients.gym}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.nextSession, shadow.button]}
            >
              <View style={styles.nextSessionTop}>
                <View style={styles.nextSessionBadge}>
                  <Text style={styles.nextSessionBadgeText}>SÉANCE {upcoming.index}</Text>
                </View>
                <Text style={styles.nextSessionDuration}>~{upcoming.estimatedMinutes} min</Text>
              </View>
              <Text style={styles.nextSessionTitle}>{upcoming.title}</Text>
              <Text style={styles.nextSessionMuscles}>
                {upcoming.focusMuscles.map(muscleLabel).join(' · ')}
              </Text>
              <View style={styles.nextSessionFooter}>
                <Text style={styles.nextSessionCount}>
                  {upcoming.exercises.length} exercices ·{' '}
                  {upcoming.exercises.filter((e) => e.isPriority).length} sur tes zones prioritaires
                </Text>
                <View style={styles.playButton}>
                  <Ionicons name="play" size={17} color={colors.gym} />
                </View>
              </View>
            </LinearGradient>
          </Pressable>
        </FadeInUp>
      ) : (
        <Card style={styles.noProgramCard}>
          <Text style={styles.noProgramText}>
            Aucun programme enregistré. Relance une analyse pour en construire un.
          </Text>
        </Card>
      )}

      {/* Semaine */}
      {program ? (
        <FadeInUp delay={110}>
          <Card style={styles.weekCard}>
            <View style={styles.weekHeader}>
              <Text style={styles.cardTitle}>Ta semaine</Text>
              <Pressable onPress={() => navigation.navigate('Programme')}>
                <Text style={styles.cardLink}>Voir le programme</Text>
              </Pressable>
            </View>
            <View style={styles.weekRow}>
              {weekDays.map((d) => {
                const done = d.session ? doneThisWeek.has(d.session.id) : false;
                return (
                  <View key={d.day} style={styles.weekDay}>
                    <Text style={[styles.weekDayLabel, d.day === todayIndex && styles.weekDayToday]}>
                      {d.label}
                    </Text>
                    <View
                      style={[
                        styles.weekDot,
                        d.session && styles.weekDotPlanned,
                        done && styles.weekDotDone,
                      ]}
                    >
                      {done ? <Ionicons name="checkmark" size={12} color={colors.white} /> : null}
                    </View>
                  </View>
                );
              })}
            </View>
            <Text style={styles.weekFooter}>
              {stats.thisWeek} séance{stats.thisWeek > 1 ? 's' : ''} terminée
              {stats.thisWeek > 1 ? 's' : ''} sur {stats.weeklyTarget} prévue
              {stats.weeklyTarget > 1 ? 's' : ''}
            </Text>
          </Card>
        </FadeInUp>
      ) : null}

      {/* Zones prioritaires */}
      <Text style={styles.sectionTitle}>Tes zones prioritaires</Text>
      <FadeInUp delay={160}>
        <Card style={styles.zonesCard}>
          <View style={styles.zonesDiagram}>
            <MuscleBodyDiagram
              highlight={priorityZones.map((z) => z.muscleGroup)}
              color={colors.danger}
              width={84}
            />
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            {priorityZones.length > 0 ? (
              priorityZones.map((zone, i) => (
                <Pressable
                  key={String(zone.muscleGroup)}
                  onPress={() => navigation.navigate('Corps')}
                  style={styles.zoneRow}
                >
                  <View style={styles.zoneNumber}>
                    <Text style={styles.zoneNumberText}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.zoneName}>{muscleLabel(zone.muscleGroup)}</Text>
                    <Text style={styles.zoneMeta}>
                      {zone.estimatedWeeks ? `${zone.estimatedWeeks} semaines estimées` : 'Durée à estimer'}
                      {zone.severityScore ? ` · ${zone.severityScore}/10` : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.faint} />
                </Pressable>
              ))
            ) : (
              <Text style={styles.zoneMeta}>
                Aucune zone en retard sur ta dernière analyse. Ton programme entretient ton équilibre.
              </Text>
            )}
          </View>
        </Card>
      </FadeInUp>

      {/* Prochaine analyse */}
      <FadeInUp delay={210}>
        <Pressable
          onPress={() => navigation.navigate('ProgressHistory')}
          style={[styles.checkInCard, daysToCheckIn !== undefined && daysToCheckIn <= 2 && styles.checkInDue]}
        >
          <View style={styles.checkInIcon}>
            <MaterialCommunityIcons
              name="camera-timer"
              size={20}
              color={daysToCheckIn !== undefined && daysToCheckIn <= 2 ? colors.warning : colors.brand}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.checkInTitle}>
              {daysToCheckIn === undefined
                ? 'Prochaine analyse à planifier'
                : daysToCheckIn > 0
                  ? `Prochaine analyse dans ${daysToCheckIn} jour${daysToCheckIn > 1 ? 's' : ''}`
                  : 'Analyse de suivi à faire maintenant'}
            </Text>
            <Text style={styles.checkInText}>
              {daysToCheckIn !== undefined && daysToCheckIn > 0
                ? 'Reprends la photo dans les mêmes conditions pour que la comparaison ait un sens.'
                : "L'IA comparera cette photo à la précédente et adaptera ton programme."}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.faint} />
        </Pressable>
      </FadeInUp>

      {/* Nutrition — raccourci, l'écran complet reste accessible tel quel. */}
      <FadeInUp delay={260}>
        <Pressable onPress={() => navigation.navigate('Nutrition')} style={styles.nutritionCard}>
          <View style={styles.nutritionLeft}>
            <Text style={styles.cardTitle}>Nutrition du jour</Text>
            <Text style={styles.nutritionValue}>
              {Math.round(totals.calories)}{' '}
              <Text style={styles.nutritionUnit}>/ {plan.targetCalories} kcal</Text>
            </Text>
            <Text style={styles.nutritionMeta}>
              {Math.round(totals.protein_g)} g de protéines sur {plan.protein_g} g
            </Text>
          </View>
          <View style={styles.scanButton}>
            <Ionicons name="camera" size={18} color={colors.white} />
          </View>
        </Pressable>
      </FadeInUp>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  emptyWrap: { padding: spacing.lg, paddingBottom: spacing.xxl, alignItems: 'center' },

  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.lg },
  eyebrow: { ...font.tiny, fontSize: 10, letterSpacing: 1.4, color: colors.brand },
  greeting: { ...font.h1, color: colors.text, marginTop: 4 },
  date: { ...font.caption, color: colors.subtext, marginTop: 2, textTransform: 'capitalize' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },

  emptyTitle: { ...font.h2, color: colors.text, marginTop: spacing.lg, textAlign: 'center' },
  emptyText: {
    ...font.body,
    color: colors.subtext,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 21,
  },
  secondaryLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  secondaryLinkText: { ...font.caption, color: colors.subtext, fontWeight: '600' },

  heroCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroSide: { flex: 1, gap: 6 },
  heroTitle: { ...font.h3, color: colors.text },
  heroText: { ...font.caption, color: colors.subtext, lineHeight: 18 },
  heroStats: { flexDirection: 'row', gap: spacing.md, marginTop: 4 },
  heroStat: {},
  heroStatValue: { ...font.h3, color: colors.brand },
  heroStatLabel: { ...font.tiny, fontSize: 9.5, fontWeight: '500', color: colors.faint },

  reportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: `${colors.brand}14`,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    marginTop: spacing.sm,
  },
  reportLinkText: { flex: 1, ...font.tiny, fontWeight: '700', color: colors.brand },

  sectionTitle: { ...font.h3, color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm },

  nextSession: { borderRadius: radius.lg, padding: spacing.md, gap: 4 },
  nextSessionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nextSessionBadge: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  nextSessionBadgeText: { ...font.tiny, fontSize: 9.5, color: colors.white },
  nextSessionDuration: { ...font.tiny, color: 'rgba(255,255,255,0.85)' },
  nextSessionTitle: { ...font.h2, fontSize: 20, color: colors.white, marginTop: 6 },
  nextSessionMuscles: { ...font.caption, color: 'rgba(255,255,255,0.85)' },
  nextSessionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  nextSessionCount: { flex: 1, ...font.tiny, fontWeight: '500', color: 'rgba(255,255,255,0.9)' },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },

  noProgramCard: { alignItems: 'center', paddingVertical: spacing.lg },
  noProgramText: { ...font.caption, color: colors.subtext, textAlign: 'center' },

  weekCard: { marginTop: spacing.md, gap: spacing.sm },
  weekHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { ...font.h3, fontSize: 15, color: colors.text },
  cardLink: { ...font.tiny, fontWeight: '700', color: colors.brand },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  weekDay: { alignItems: 'center', gap: 7 },
  weekDayLabel: { ...font.tiny, fontSize: 10, color: colors.faint },
  weekDayToday: { color: colors.brand },
  weekDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.bgSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDotPlanned: { borderWidth: 1.5, borderColor: colors.gymAlt },
  weekDotDone: { backgroundColor: colors.success, borderColor: colors.success },
  weekFooter: { ...font.tiny, fontWeight: '500', color: colors.subtext },

  zonesCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  zonesDiagram: {
    width: 92,
    height: 176,
    borderRadius: radius.md,
    backgroundColor: colors.bgSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  zoneNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneNumberText: { ...font.tiny, color: colors.white },
  zoneName: { ...font.bodyBold, fontSize: 14, color: colors.text },
  zoneMeta: { ...font.tiny, fontSize: 10, fontWeight: '500', color: colors.subtext, marginTop: 1 },

  checkInCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  checkInDue: { borderWidth: 1, borderColor: colors.warning },
  checkInIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.bgSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkInTitle: { ...font.bodyBold, fontSize: 14, color: colors.text },
  checkInText: { ...font.tiny, fontWeight: '500', color: colors.subtext, marginTop: 2, lineHeight: 15 },

  nutritionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  nutritionLeft: { flex: 1, gap: 2 },
  nutritionValue: { ...font.h2, fontSize: 21, color: colors.text },
  nutritionUnit: { ...font.caption, color: colors.subtext },
  nutritionMeta: { ...font.tiny, fontWeight: '500', color: colors.subtext },
  scanButton: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
