import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  ScrollView,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BodyZoneOverlay, ZONE_STATUS_COLOR } from '../components/BodyZoneOverlay';
import { ZoomableView } from '../components/ZoomableView';
import { FadeInUp } from '../components/FadeInUp';
import { MedicalDisclaimer } from '../components/MedicalDisclaimer';
import { useOnboarding, WorkoutLocation } from '../context/OnboardingContext';
import { EQUIPMENT_META, MuscleZone, muscleLabel, youtubeSearchUrl } from '../data/muscleGroups';
import { adjustSetsForExperience, capExercises, filterByEquipment } from '../services/workoutGenerator';
import { PRIORITY_LEVEL_META } from '../theme/priorityMeta';
import { fitImage } from '../utils/imageFit';
import { colors, spacing, radius, font } from '../theme/colors';

/**
 * Photo en grand, annotée et explorable.
 *
 * Seuls les problèmes prioritaires (au maximum 3, déjà garantis par
 * capPriorityZones à l'analyse) sont dessinés sur la photo, numérotés dans le
 * même ordre que la fiche de détail — c'est ce qui rend l'annotation
 * clairement associée à ces problèmes précis, et non à n'importe quel muscle
 * par ailleurs correct. Le zoom permet de vérifier que chaque repère tombe
 * bien où il faut.
 */
export function BodyPhotoViewerScreen({ navigation }: any) {
  const { answers } = useOnboarding();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const zones = answers.analysis?.zones ?? [];
  const problems = useMemo(
    () => zones.filter((z) => z.visible !== false && !z.isGeneric && z.status === 'priority'),
    [zones],
  );

  const [selected, setSelected] = useState<MuscleZone | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  const [place, setPlace] = useState<WorkoutLocation>(answers.workoutLocation ?? 'gym');

  useEffect(() => {
    const uri = answers.bodyPhotoUri;
    if (!uri) return;
    let alive = true;
    Image.getSize(
      uri,
      (w, h) => {
        if (alive && w > 0 && h > 0) setNatural({ w, h });
      },
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [answers.bodyPhotoUri]);

  // La photo occupe tout l'écran : c'est ce qui rend les repères lisibles.
  const stageHeight = height;
  const content = fitImage(natural?.w ?? 0, natural?.h ?? 0, width, stageHeight, 'contain');

  const exercises = selected
    ? capExercises(filterByEquipment(place === 'gym' ? selected.exercisesGym : selected.exercisesHome, answers.equipment))
    : [];

  return (
    <View style={styles.container}>
      <ZoomableView
        width={width}
        height={stageHeight}
        initialScale={0.9}
        style={styles.imageStage}
        onScaleChange={(s) => setZoomed(s > 1.05)}
      >
        <View style={[StyleSheet.absoluteFill, styles.photoBackdrop]} />
        {answers.bodyPhotoUri ? (
          <Image
            source={{ uri: answers.bodyPhotoUri }}
            style={StyleSheet.absoluteFill}
            resizeMode="contain"
          />
        ) : null}

        <BodyZoneOverlay
          zones={zones}
          width={width}
          height={stageHeight}
          content={content}
          restrictToPriority
          onZonePress={setSelected}
          activeMuscle={selected?.muscleGroup as string | undefined}
        />
      </ZoomableView>

      {/* Barre du haut */}
      <View style={[styles.topBar, { top: insets.top + spacing.sm }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.roundBtn}>
          <Ionicons name="close" size={20} color={colors.white} />
        </Pressable>
        {problems.length > 0 ? (
          <View style={styles.chipBtn}>
            <Ionicons name="alert-circle" size={13} color={colors.white} />
            <Text style={styles.chipBtnText}>{problems.length} zones</Text>
          </View>
        ) : null}
      </View>

      {!zoomed && !selected ? (
        <View style={[styles.hint, { top: insets.top + 62 }]}>
          <Ionicons name="hand-left-outline" size={13} color={colors.white} />
          <Text style={styles.hintText}>
            Touche un repère pour son détail · pince ou double-tape pour zoomer
          </Text>
        </View>
      ) : null}

      {/* Sélecteur de problème en bas, quand aucun détail n'est ouvert */}
      {!selected ? (
        <View style={[styles.pickerWrap, { bottom: insets.bottom + spacing.md }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pickerRow}
          >
            {problems.map((zone, i) => (
              <Pressable
                key={zone.muscleGroup as string}
                onPress={() => setSelected(zone)}
                style={[styles.muscleChip, { borderColor: ZONE_STATUS_COLOR.priority }]}
              >
                <View style={styles.muscleNumber}>
                  <Text style={styles.muscleNumberText}>{i + 1}</Text>
                </View>
                <Text style={styles.muscleChipText}>{muscleLabel(zone.muscleGroup)}</Text>
              </Pressable>
            ))}
            {problems.length === 0 ? (
              <Text style={styles.emptyText}>Aucun problème prioritaire sur cette photo.</Text>
            ) : null}
          </ScrollView>
        </View>
      ) : null}

      {/* Détail du problème sélectionné */}
      {selected ? (
        <FadeInUp style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
          <View style={styles.sheetHandle} />

          <View style={styles.sheetHeader}>
            <View style={styles.sheetNumber}>
              <Text style={styles.sheetNumberText}>{problems.indexOf(selected) + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle}>{muscleLabel(selected.muscleGroup)}</Text>
              {selected.priorityLevel ? (
                <Text style={[styles.sheetStatus, { color: PRIORITY_LEVEL_META[selected.priorityLevel].color }]}>
                  {PRIORITY_LEVEL_META[selected.priorityLevel].label}
                  {selected.severityScore ? ` · ${selected.severityScore}/10` : ''}
                </Text>
              ) : null}
            </View>
            <Pressable onPress={() => setSelected(null)} hitSlop={12} style={styles.sheetClose}>
              <Ionicons name="close" size={18} color={colors.subtext} />
            </Pressable>
          </View>

          <ScrollView
            style={{ maxHeight: height * 0.5 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: spacing.sm }}
          >
            <View style={styles.geminiNote}>
              <Text style={styles.geminiNoteTitle}>DÉFAUT OBSERVÉ</Text>
              <Text style={styles.geminiNoteText}>{selected.problem}</Text>
            </View>
            <View style={styles.placeRow}>
              <Text style={styles.blockLabel}>Exercices</Text>
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
            </View>

            <View style={styles.timelineRow}>
              <Ionicons name="time-outline" size={15} color={colors.brand} />
              <Text style={styles.timelineText}>
                Progression visible estimée : {selected.estimatedWeeks
                  ? `${selected.estimatedWeeks} semaines`
                  : '4 à 12 semaines'}
              </Text>
            </View>

            {exercises.map((ex, i) => {
              const meta = EQUIPMENT_META[ex.equipment];
              const sets = adjustSetsForExperience(ex.sets, answers.experienceLevel);
              return (
                <View key={i} style={styles.exerciseRow}>
                  <View style={styles.exerciseIcon}>
                    <MaterialCommunityIcons name={meta.icon as any} size={17} color={colors.brand} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.exerciseNameRow}>
                      <Text style={styles.exerciseName}>{ex.name}</Text>
                      <Text style={styles.setsText}>{sets} × {ex.reps}</Text>
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

            <MedicalDisclaimer compact />
          </ScrollView>
        </FadeInUp>
      ) : null}

      {/* Dégradé bas pour détacher les commandes de la photo */}
      {!selected ? (
        <LinearGradient
          colors={['transparent', 'rgba(14,16,22,0.85)']}
          style={styles.bottomFade}
          pointerEvents="none"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDark },
  imageStage: { backgroundColor: colors.bgDark },
  photoBackdrop: { backgroundColor: colors.bgDark },

  topBar: {
    position: 'absolute', left: spacing.md, right: spacing.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  roundBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  chipBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: radius.pill,
  },
  chipBtnText: { ...font.tiny, color: colors.white },

  hint: {
    position: 'absolute', alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: radius.pill,
  },
  hintText: { ...font.tiny, fontSize: 10, fontWeight: '600', color: colors.white },

  bottomFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 190 },

  pickerWrap: { position: 'absolute', left: 0, right: 0 },
  pickerRow: { paddingHorizontal: spacing.md, gap: spacing.sm },
  muscleChip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1.5,
    paddingHorizontal: 13, paddingVertical: 9, borderRadius: radius.pill,
  },
  muscleNumber: {
    width: 18, height: 18, borderRadius: 9, backgroundColor: ZONE_STATUS_COLOR.priority,
    alignItems: 'center', justifyContent: 'center',
  },
  muscleNumberText: { ...font.tiny, fontSize: 10, color: colors.white },
  muscleChipText: { ...font.caption, fontWeight: '700', color: colors.white },
  emptyText: { ...font.caption, color: colors.white, paddingHorizontal: spacing.md },

  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm,
  },
  sheetHandle: {
    width: 38, height: 4, borderRadius: 2, backgroundColor: colors.cardBorder,
    alignSelf: 'center', marginBottom: spacing.md,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.md },
  sheetNumber: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: ZONE_STATUS_COLOR.priority,
    alignItems: 'center', justifyContent: 'center',
  },
  sheetNumberText: { ...font.bodyBold, color: colors.white, fontSize: 15 },
  sheetTitle: { ...font.h2, fontSize: 20, color: colors.text },
  sheetStatus: { ...font.tiny, marginTop: 1 },
  sheetClose: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center',
  },

  blockLabel: { ...font.tiny, color: colors.faint, textTransform: 'uppercase' },
  timelineRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: `${colors.brand}14`, borderRadius: radius.sm,
    paddingHorizontal: 9, paddingVertical: 7, marginBottom: spacing.sm,
  },
  timelineText: { ...font.tiny, color: colors.subtext, fontWeight: '600' },
  geminiNote: {
    marginTop: spacing.xs,
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

  placeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: spacing.lg, marginBottom: spacing.sm,
  },
  placeToggle: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.pill, padding: 3 },
  placeBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill },
  placeBtnActive: { backgroundColor: colors.white },
  placeText: { ...font.tiny, color: colors.subtext },
  placeTextActive: { color: colors.text },

  exerciseRow: {
    flexDirection: 'row', gap: spacing.sm,
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.cardBorder,
  },
  exerciseIcon: {
    width: 34, height: 34, borderRadius: 12, backgroundColor: `${colors.brand}10`,
    alignItems: 'center', justifyContent: 'center',
  },
  exerciseNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  exerciseName: { ...font.bodyBold, fontSize: 14, color: colors.text, flex: 1 },
  exerciseMeta: { ...font.tiny, fontWeight: '500', color: colors.subtext, marginTop: 1 },
  videoLink: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  videoLinkText: { ...font.tiny, fontWeight: '700', color: colors.danger },
  setsText: { ...font.tiny, color: colors.subtext },
});
