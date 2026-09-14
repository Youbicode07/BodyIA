import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientButton } from '../components/GradientButton';
import { Card } from '../components/Card';
import { FadeInUp } from '../components/FadeInUp';
import { BodyZoneOverlay } from '../components/BodyZoneOverlay';
import { MedicalDisclaimer } from '../components/MedicalDisclaimer';
import { useOnboarding, WorkoutLocation } from '../context/OnboardingContext';
import { EQUIPMENT_META, MuscleZone, muscleLabel, youtubeSearchUrl } from '../data/muscleGroups';
import { PRIORITY_LEVEL_META } from '../theme/priorityMeta';
import { adjustSetsForExperience, capExercises, filterByEquipment } from '../services/workoutGenerator';
import { analyzeBodyPhoto } from '../services/aiBodyAnalysis';
import { photoToBase64 } from '../services/imagePrep';
import { fitImage } from '../utils/imageFit';
import { colors, spacing, radius, font, gradients } from '../theme/colors';

export function AnalysisResultScreen({ navigation }: any) {
  const { answers, updateAnswers } = useOnboarding();
  const [retrying, setRetrying] = useState(false);
  const zones = answers.analysis?.zones ?? [];

  // Sélecteur salle/maison pour les exercices des problèmes prioritaires,
  // quand le lieu n'a pas encore été choisi (étape pouvant être passée).
  const [place, setPlace] = useState<WorkoutLocation>(answers.workoutLocation ?? 'gym');

  // Dimensions lues à l'exécution : l'écran s'adapte aussi bien à un petit
  // Android qu'à un iPhone Max ou à une tablette.
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const photoWidth = screenWidth - spacing.lg * 2;

  // Format réel de la photo. Sans lui, le cadre impose son propre ratio et
  // l'image est rognée : les repères ne correspondent alors plus au corps.
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const uri = answers.bodyPhotoUri;
    if (!uri) return;
    let alive = true;
    Image.getSize(
      uri,
      (w, h) => {
        if (alive && w > 0 && h > 0) setNatural({ w, h });
      },
      // Taille illisible : on garde le format par défaut, l'affichage reste correct.
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [answers.bodyPhotoUri]);

  // Le cadre épouse le format de la photo, borné pour rester lisible sur tous
  // les écrans (jamais plus haut que 62 % de la hauteur disponible).
  const ratio = natural ? natural.h / natural.w : 1.25;
  const photoHeight = Math.round(
    Math.min(Math.max(photoWidth * ratio, photoWidth * 0.9), screenHeight * 0.62),
  );
  // Zone exacte occupée par l'image dans le cadre : l'overlay y projette ses
  // repères, ce qui les fait tomber au bon endroit quel que soit le format.
  const content = fitImage(natural?.w ?? 0, natural?.h ?? 0, photoWidth, photoHeight, 'contain');

  // On ne garde que les au maximum 3 problèmes prioritaires : ni les autres
  // muscles corrects, ni les zones non observables ne sont affichés.
  const analysedZones = zones.filter((z) => z.visible !== false && !z.isGeneric);
  const priorityZones = analysedZones.filter((z) => z.status === 'priority');

  const retryAnalysis = async () => {
    if (!answers.bodyPhotoUri || retrying) return;
    setRetrying(true);
    try {
      const base64 = await photoToBase64(answers.bodyPhotoUri);
      const result = await analyzeBodyPhoto(base64, answers);

      // On ne remplace jamais une analyse réussie par un repli générique :
      // sinon un simple échec réseau ferait perdre un bon résultat.
      const currentIsReal = answers.analysis && !answers.analysis.isFallback;
      if (result.isFallback && currentIsReal) {
        Alert.alert(
          'Toujours indisponible',
          `${result.errorDetail ?? "L'IA n'a pas répondu."}\n\nTon analyse actuelle a été conservée.`,
        );
        return;
      }
      updateAnswers({ analysis: result });
    } finally {
      setRetrying(false);
    }
  };

  const exercisesFor = (zone: MuscleZone) => {
    const source = place === 'gym' ? zone.exercisesGym : zone.exercisesHome;
    return capExercises(filterByEquipment(source, answers.equipment));
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      {/* Photo plein cadre, annotée UNIQUEMENT sur les problèmes prioritaires */}
      <Pressable
        onPress={() => answers.bodyPhotoUri && navigation.navigate('BodyPhotoViewer')}
        style={[styles.photoBox, { width: photoWidth, height: photoHeight }]}
      >
        {answers.bodyPhotoUri ? (
          // "contain" et non "cover" : la photo entière reste visible, donc
          // rien de ce que l'IA a analysé n'est coupé à l'écran.
          <Image
            source={{ uri: answers.bodyPhotoUri }}
            style={styles.photo}
            resizeMode="contain"
          />
        ) : (
          <View style={[styles.photo, { backgroundColor: colors.card }]} />
        )}

        {/* Les dégradés viennent AVANT l'overlay pour que les étiquettes et les
            flèches restent nettes et lisibles par-dessus. */}
        <LinearGradient colors={['rgba(14,16,22,0.75)', 'transparent']} style={styles.topFade} />
        <LinearGradient colors={['transparent', 'rgba(14,16,22,0.9)']} style={styles.bottomFade} />

        <BodyZoneOverlay
          zones={zones}
          width={photoWidth}
          height={photoHeight}
          content={content}
          restrictToPriority
        />

        <View style={styles.photoTop}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={20} color={colors.white} />
          </Pressable>
        </View>

        {/* Invitation explicite : sans elle, rien n'indique que la photo
            s'ouvre en grand. */}
        {answers.bodyPhotoUri ? (
          <View style={styles.expandHint}>
            <Ionicons name="expand" size={13} color={colors.white} />
            <Text style={styles.expandHintText}>Toucher pour agrandir</Text>
          </View>
        ) : null}

        <View style={styles.photoBottom} />
      </Pressable>

      <View style={styles.body}>
        {answers.analysis?.isFallback ? (
          <View style={styles.warningBanner}>
            <View style={styles.warningTop}>
              <Ionicons name="warning" size={16} color={colors.warning} />
              <Text style={styles.warningText}>
                Analyse générique affichée : l'IA n'a pas pu traiter ta photo.
              </Text>
            </View>
            {answers.analysis.errorDetail ? (
              <Text style={styles.warningDetail} numberOfLines={4}>
                {answers.analysis.errorDetail}
              </Text>
            ) : null}
            <Pressable
              onPress={() => navigation.navigate('PhotoCapture')}
              style={[styles.retryButton, { marginBottom: 6 }]}
            >
              <Ionicons name="camera" size={14} color={colors.text} />
              <Text style={styles.retryText}>Reprendre une photo</Text>
            </Pressable>
            <Pressable onPress={retryAnalysis} disabled={retrying} style={styles.retryButton}>
              {retrying ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <>
                  <Ionicons name="refresh" size={14} color={colors.text} />
                  <Text style={styles.retryText}>Relancer l'analyse</Text>
                </>
              )}
            </Pressable>
          </View>
        ) : null}

        <MedicalDisclaimer compact />

        {answers.analysis?.summary ? (
          <Card style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Lecture du coach</Text>
            <Text style={styles.summaryText}>{answers.analysis.summary}</Text>
          </Card>
        ) : null}

        {/* Les au maximum 3 problèmes prioritaires, avec le numéro qui les
            relie au repère dessiné sur la photo. */}
        {priorityZones.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>
              {priorityZones.length > 1 ? 'Tes problèmes prioritaires' : 'Ton problème prioritaire'}
            </Text>

            {/* Bascule salle/maison pour les exercices, seulement utile si
                l'étape de choix du lieu a été passée. */}
            {!answers.workoutLocation ? (
              <View style={styles.placeToggle}>
                {(['gym', 'home'] as const).map((p) => (
                  <Pressable
                    key={p}
                    onPress={() => setPlace(p)}
                    style={[styles.placeBtn, place === p && styles.placeBtnActive]}
                  >
                    <Text style={[styles.placeText, place === p && styles.placeTextActive]}>
                      {p === 'gym' ? 'Salle' : 'Maison'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {priorityZones.map((zone, i) => {
              const level = zone.priorityLevel ? PRIORITY_LEVEL_META[zone.priorityLevel] : null;
              const exercises = exercisesFor(zone);
              return (
                <FadeInUp key={zone.muscleGroup} delay={i * 60}>
                  <Card style={styles.problemCard}>
                    <View style={styles.problemHeader}>
                      <View style={styles.problemNumber}>
                        <Text style={styles.problemNumberText}>{i + 1}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.problemTitle}>{muscleLabel(zone.muscleGroup)}</Text>
                        {level ? (
                          <Text style={[styles.problemLevel, { color: level.color }]}>{level.label}</Text>
                        ) : null}
                      </View>
                      {zone.severityScore ? (
                        <View style={styles.severityBadge}>
                          <Text style={styles.severityText}>{zone.severityScore}/10</Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.timelineRow}>
                      <Ionicons name="time-outline" size={15} color={colors.brand} />
                      <Text style={styles.timelineText}>
                        Progression visible estimée : {zone.estimatedWeeks
                          ? `${zone.estimatedWeeks} semaines`
                          : '4 à 12 semaines'}
                      </Text>
                    </View>
                    <View style={styles.geminiNote}>
                      <Text style={styles.geminiNoteTitle}>DÉFAUT OBSERVÉ</Text>
                      <Text style={styles.geminiNoteText}>{zone.problem}</Text>
                    </View>

                    {exercises.map((ex, j) => {
                      const meta = EQUIPMENT_META[ex.equipment];
                      const sets = adjustSetsForExperience(ex.sets, answers.experienceLevel);
                      return (
                        <View key={j} style={styles.exerciseRow}>
                          <View style={styles.exerciseIcon}>
                            <MaterialCommunityIcons name={meta.icon as any} size={17} color={colors.brand} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={styles.exerciseNameRow}>
                              <Text style={styles.exerciseName}>{ex.name}</Text>
                              <Text style={styles.exerciseSets}>{sets} × {ex.reps}</Text>
                            </View>
                            <Text style={styles.exerciseMeta}>{meta.label}</Text>
                            <Pressable
                              onPress={() => Linking.openURL(youtubeSearchUrl(ex.name))}
                              style={styles.videoLink}
                            >
                              <Ionicons name="logo-youtube" size={13} color={colors.danger} />
                              <Text style={styles.videoLinkText}>Voir des démonstrations</Text>
                            </Pressable>
                          </View>
                        </View>
                      );
                    })}
                  </Card>
                </FadeInUp>
              );
            })}
          </>
        ) : (
          <View style={styles.noProblemBanner}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={styles.noProblemText}>
              Aucun problème prioritaire détecté sur les muscles visibles de cette photo.
            </Text>
          </View>
        )}

        <GradientButton
          label="Voir mon programme"
          icon="arrow-forward"
          gradient={gradients.gym}
          onPress={() => navigation.navigate('WorkoutLocation')}
          style={{ marginTop: spacing.md }}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  photoBox: {
    alignSelf: 'center',
    marginTop: spacing.lg,
    borderRadius: radius.xl,
    overflow: 'hidden',
    // Fond sombre derrière les bandes laissées par une photo très allongée.
    backgroundColor: colors.bgSoft,
  },
  photo: { width: '100%', height: '100%' },
  topFade: { position: 'absolute', top: 0, left: 0, right: 0, height: 110 },
  bottomFade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 170 },
  photoTop: {
    position: 'absolute', top: spacing.md, left: spacing.md, right: spacing.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },
  expandHint: {
    position: 'absolute', top: '46%', alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 11, paddingVertical: 7,
    borderRadius: radius.pill,
  },
  expandHintText: { ...font.tiny, fontSize: 10, color: colors.white },
  photoBottom: { position: 'absolute', bottom: spacing.md, left: spacing.md, right: spacing.md },
  photoTitle: { ...font.h1, color: colors.white, marginBottom: spacing.sm },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statChip: {
    flexDirection: 'row', alignItems: 'baseline', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: radius.pill,
  },
  statValue: { ...font.bodyBold, color: colors.white },
  statLabel: { ...font.tiny, color: 'rgba(255,255,255,0.8)' },

  body: { padding: spacing.lg, gap: spacing.sm },
  warningBanner: {
    backgroundColor: '#FFF7E6', borderRadius: radius.md, padding: spacing.md,
    gap: 8, borderWidth: 1, borderColor: '#FFE7BA',
  },
  warningTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  warningText: { flex: 1, ...font.caption, color: '#805A00', fontWeight: '700' },
  warningDetail: { ...font.tiny, fontWeight: '500', color: '#805A00', opacity: 0.85 },
  retryButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.card, borderRadius: radius.pill, paddingVertical: 10,
  },
  retryText: { ...font.tiny, color: colors.text },

  sectionTitle: { ...font.h3, color: colors.text, marginTop: spacing.sm },
  summaryCard: { backgroundColor: colors.card, borderColor: colors.cardBorder },
  summaryTitle: { ...font.bodyBold, color: colors.text, marginBottom: spacing.xs },
  summaryText: { ...font.body, color: colors.subtext, lineHeight: 21 },

  placeToggle: {
    flexDirection: 'row', alignSelf: 'flex-start', backgroundColor: colors.card,
    borderRadius: radius.pill, padding: 3, marginBottom: -spacing.xs,
  },
  placeBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill },
  placeBtnActive: { backgroundColor: colors.brand },
  placeText: { ...font.tiny, color: colors.subtext },
  placeTextActive: { color: colors.white },

  noProblemBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: `${colors.success}12`, borderRadius: radius.md, padding: spacing.md,
  },
  noProblemText: { flex: 1, ...font.caption, fontWeight: '600', color: colors.text },

  problemCard: { gap: 0, backgroundColor: colors.card, borderColor: colors.cardBorder },
  problemHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.sm },
  problemNumber: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: colors.danger,
    alignItems: 'center', justifyContent: 'center',
  },
  problemNumberText: { ...font.bodyBold, color: colors.white, fontSize: 15 },
  problemTitle: { ...font.h3, color: colors.text },
  problemLevel: { ...font.tiny, fontWeight: '700', marginTop: 1 },
  severityBadge: {
    backgroundColor: colors.bgSoft, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill,
  },
  severityText: { ...font.tiny, color: colors.text },
  timelineRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: `${colors.brand}14`, borderRadius: radius.sm,
    paddingHorizontal: 9, paddingVertical: 7, marginBottom: spacing.xs,
  },
  timelineText: { ...font.tiny, color: colors.subtext, fontWeight: '600' },
  geminiNote: {
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(95, 13, 20, 0.28)',
    borderLeftWidth: 3,
    borderLeftColor: '#F04444',
  },
  geminiNoteTitle: {
    fontFamily: 'Marker Felt',
    fontSize: 12,
    letterSpacing: 1,
    color: '#F04444',
    fontWeight: '700',
  },
  geminiNoteText: {
    marginTop: 3,
    fontFamily: 'Marker Felt',
    fontSize: 15,
    lineHeight: 20,
    color: '#FF6A6A',
  },

  exerciseRow: {
    flexDirection: 'row', gap: spacing.sm,
    paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.cardBorder, marginTop: spacing.xs,
  },
  exerciseIcon: {
    width: 34, height: 34, borderRadius: 12, backgroundColor: `${colors.brand}10`,
    alignItems: 'center', justifyContent: 'center',
  },
  exerciseNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  exerciseName: { ...font.bodyBold, fontSize: 14, color: colors.text, flex: 1 },
  exerciseSets: { ...font.tiny, color: colors.subtext },
  exerciseMeta: { ...font.tiny, fontWeight: '500', color: colors.subtext, marginTop: 1 },
  videoLink: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  videoLinkText: { ...font.tiny, fontWeight: '700', color: colors.danger },
});
