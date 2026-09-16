import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Image, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { GradientButton } from '../components/GradientButton';
import { Card } from '../components/Card';
import { FadeInUp } from '../components/FadeInUp';
import { MuscleBodyDiagram } from '../components/MuscleBodyDiagram';
import { EmptyIllustration } from '../components/EmptyIllustration';
import { useOnboarding } from '../context/OnboardingContext';
import { useUser } from '../context/UserContext';
import { isFollowUpDue, loadHistory } from '../services/analysisHistory';
import { muscleLabel, ZoneStatus } from '../data/muscleGroups';
import { colors, spacing, radius, font, gradients } from '../theme/colors';
import { useResponsive } from '../utils/responsive';

const STATUS_COLOR: Record<ZoneStatus, string> = {
  priority: colors.danger,
  developed: colors.fats,
  balanced: colors.success,
};

export function BodyHomeScreen({ navigation }: any) {
  const { width, horizontalPadding, verticalScale } = useResponsive();
  const { answers } = useOnboarding();
  const { user } = useUser();
  const zones = answers.analysis?.zones ?? [];
  // Mêmes règles que l'écran de résultat : on ne compte que les muscles
  // réellement observés sur la photo. Sans ce filtre, les zones complétées
  // automatiquement gonflaient le nombre de points faibles affiché.
  const analysed = zones.filter((z) => z.visible !== false && !z.isGeneric);
  const priorityZones = analysed.filter((z) => z.status === 'priority');
  const developedCount = analysed.filter((z) => z.status === 'developed').length;

  // Le suivi à 15 jours est obligatoire, pas une simple relance : tant que
  // l'échéance est dépassée, cet onglet reste bloqué derrière un écran de
  // reprise de photo plutôt que d'afficher une analyse devenue périmée.
  const [followUpDue, setFollowUpDue] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadHistory(user?.id).then((history) => {
        if (alive) setFollowUpDue(isFollowUpDue(history[0]));
      });
      return () => {
        alive = false;
      };
    }, [user?.id]),
  );

  if (followUpDue) {
    return (
      <View style={styles.gateContainer}>
        <View style={{ flex: 1 }} />
        <EmptyIllustration kind="body" width={150} color={colors.brand} />
        <Text style={styles.gateTitle}>Suivi obligatoire</Text>
        <Text style={styles.gateText}>
          15 jours se sont écoulés depuis ta dernière analyse. Reprends une photo dans les mêmes
          conditions pour que l'IA vérifie si tes zones prioritaires ont évolué ou non.
        </Text>
        <View style={{ flex: 1 }} />
        <GradientButton
          label="Reprendre la photo"
          icon="camera"
          gradient={gradients.muscle}
          onPress={() => navigation.navigate('PhotoCapture')}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingHorizontal: horizontalPadding, paddingTop: spacing.lg, paddingBottom: spacing.xxl }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.title}>Mon corps</Text>
          <Text style={styles.subtitle}>Ta dernière analyse IA</Text>
        </View>
        <Pressable onPress={() => navigation.navigate('ProgressHistory')} style={styles.progressBtn}>
          <Ionicons name="stats-chart" size={16} color={colors.brand} />
          <Text style={styles.progressBtnText}>Progression</Text>
        </Pressable>
      </View>

      {answers.bodyPhotoUri ? (
        <FadeInUp>
          <View style={[styles.photoWrap, { height: Math.min(width * 0.9, verticalScale(420)) }]}>
            <Image source={{ uri: answers.bodyPhotoUri }} style={styles.photo} />
            <LinearGradient colors={['transparent', 'rgba(14,16,22,0.85)']} style={styles.photoOverlay} />
            <View style={styles.photoContent}>
              <View style={styles.badgeRow}>
                <View style={styles.badge}>
                  <Ionicons name="checkmark-circle" size={13} color={colors.success} />
                  <Text style={styles.badgeText}>{analysed.length} muscles analysés</Text>
                </View>
                <View style={styles.badge}>
                  <Ionicons name="alert-circle" size={13} color={colors.danger} />
                  <Text style={styles.badgeText}>{priorityZones.length} prioritaires</Text>
                </View>
              </View>
            </View>
          </View>
        </FadeInUp>
      ) : (
        <Card style={styles.emptyCard}>
          <EmptyIllustration kind="body" width={150} color={colors.brand} />
          <Text style={styles.emptyTitle}>
            {answers.analysisSkipped ? 'Analyse non effectuée' : 'Aucune analyse'}
          </Text>
          <Text style={styles.emptyText}>
            {answers.analysisSkipped
              ? "Tu as passé l'étape photo. Ton programme couvre tout le corps ; lance l'analyse quand tu veux pour cibler tes muscles en retard."
              : 'Prends une photo pour lancer ta première analyse corporelle.'}
          </Text>
        </Card>
      )}

      {analysed.length > 0 ? (
        <FadeInUp delay={60}>
          <Card style={styles.mapCard}>
            <View style={styles.mapDiagram}>
              <MuscleBodyDiagram
                highlight={priorityZones.map((z) => z.muscleGroup)}
                color={colors.danger}
                width={96}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.mapTitle}>Ta carte musculaire</Text>
              <Text style={styles.mapText}>
                {priorityZones.length > 0
                  ? `En rouge, les ${priorityZones.length} zones que l'IA te recommande de travailler en priorité.`
                  : 'Aucune zone en retard : maintiens ton équilibre actuel.'}
              </Text>
              <View style={styles.mapTags}>
                {priorityZones.slice(0, 4).map((z, i) => (
                  <View key={i} style={styles.mapTag}>
                    <Text style={styles.mapTagText}>{muscleLabel(z.muscleGroup)}</Text>
                  </View>
                ))}
              </View>
            </View>
          </Card>
        </FadeInUp>
      ) : null}

      {analysed.length > 0 ? (
        <View style={styles.summaryRow}>
          <Card style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: colors.danger }]}>{priorityZones.length}</Text>
            <Text style={styles.summaryLabel}>À prioriser</Text>
          </Card>
          <Card style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: colors.fats }]}>{developedCount}</Text>
            <Text style={styles.summaryLabel}>Bien développés</Text>
          </Card>
          <Card style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: colors.success }]}>
              {analysed.length - priorityZones.length - developedCount}
            </Text>
            <Text style={styles.summaryLabel}>Équilibrés</Text>
          </Card>
        </View>
      ) : null}

      {priorityZones.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>Tes zones prioritaires</Text>
          {priorityZones.map((z, i) => (
            <FadeInUp key={i} delay={i * 60}>
              <Card style={styles.zoneCard}>
                <View style={styles.zoneHeader}>
                  <View style={[styles.zoneIcon, { backgroundColor: `${STATUS_COLOR.priority}1A` }]}>
                    <Ionicons name="alert-circle" size={17} color={STATUS_COLOR.priority} />
                  </View>
                  <Text style={styles.zoneTitle}>{muscleLabel(z.muscleGroup)}</Text>
                  {z.frequencyPerWeek ? (
                    <View style={styles.freqPill}>
                      <Text style={styles.freqText}>{z.frequencyPerWeek}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.zoneText}>{z.recommendation}</Text>
              </Card>
            </FadeInUp>
          ))}
        </>
      ) : null}

      <GradientButton
        label={answers.bodyPhotoUri ? 'Nouvelle analyse' : 'Lancer une analyse'}
        icon="camera"
        gradient={gradients.muscle}
        onPress={() => navigation.navigate('PhotoCapture')}
        style={{ marginTop: spacing.lg }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgSoft },
  gateContainer: { flex: 1, backgroundColor: colors.bgSoft, padding: spacing.lg, alignItems: 'center' },
  gateTitle: { ...font.h1, color: colors.text, marginTop: spacing.lg, textAlign: 'center' },
  gateText: {
    ...font.body, color: colors.subtext, textAlign: 'center',
    marginTop: spacing.sm, lineHeight: 21, paddingHorizontal: spacing.md,
  },
  titleRow: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: { ...font.h1, color: colors.text },
  subtitle: { ...font.caption, color: colors.subtext, marginTop: 2 },
  progressBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: `${colors.brand}12`, paddingHorizontal: 11, paddingVertical: 7,
    borderRadius: radius.pill, marginTop: 4,
  },
  progressBtnText: { ...font.tiny, fontWeight: '700', color: colors.brand },

  photoWrap: { borderRadius: radius.xl, overflow: 'hidden', marginBottom: spacing.md },
  photo: { width: '100%', height: '100%' },
  photoOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 140 },
  photoContent: { position: 'absolute', bottom: spacing.md, left: spacing.md, right: spacing.md },
  badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: radius.pill,
  },
  badgeText: { ...font.tiny, color: colors.text },

  emptyCard: { alignItems: 'center', paddingVertical: spacing.xl, marginBottom: spacing.md },
  emptyIcon: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
  },
  emptyTitle: { ...font.bodyBold, color: colors.text },
  emptyText: { ...font.caption, color: colors.subtext, marginTop: 4, textAlign: 'center', paddingHorizontal: spacing.lg },

  mapCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  mapDiagram: {
    width: 106, height: 200, borderRadius: radius.md, backgroundColor: colors.bgSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  mapTitle: { ...font.h3, color: colors.text, marginBottom: 4 },
  mapText: { ...font.caption, color: colors.subtext, lineHeight: 19 },
  mapTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: spacing.sm },
  mapTag: { backgroundColor: `${colors.danger}12`, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill },
  mapTagText: { ...font.tiny, fontSize: 10, color: colors.danger },
  summaryRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  summaryCard: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  summaryValue: { ...font.h2 },
  summaryLabel: { ...font.tiny, fontWeight: '500', color: colors.subtext, marginTop: 2, textAlign: 'center' },

  sectionTitle: { ...font.h3, color: colors.text, marginBottom: spacing.sm },
  zoneCard: { marginBottom: spacing.sm },
  zoneHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  zoneIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  zoneTitle: { ...font.h3, fontSize: 15, color: colors.text, flex: 1 },
  freqPill: { backgroundColor: colors.card, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill },
  freqText: { ...font.tiny, fontSize: 10, color: colors.subtext },
  zoneText: { ...font.body, color: colors.subtext, lineHeight: 20 },
});
