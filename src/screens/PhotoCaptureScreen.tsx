import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, Alert, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { GradientButton } from '../components/GradientButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { SkipStepButton } from '../components/SkipStepButton';
import { useOnboarding } from '../context/OnboardingContext';
import { useCoach } from '../context/CoachContext';
import { useSubscription } from '../context/SubscriptionContext';
import { canAnalyseBody } from '../services/entitlements';
import { colors, spacing, radius, font, gradients } from '../theme/colors';

const TIPS = [
  'Debout, de face, bras le long du corps',
  'En tenue de sport, corps entier visible',
  'Bonne lumière, fond dégagé',
];

export function PhotoCaptureScreen({ navigation }: any) {
  const { updateAnswers } = useOnboarding();
  const { history } = useCoach();
  const { isPremium } = useSubscription();
  const [uri, setUri] = useState<string | null>(null);

  // Le quota se compte sur les analyses REELLEMENT archivees, pas sur le
  // nombre de photos prises : une analyse qui a echoue ne doit rien consommer.
  const gate = canAnalyseBody(isPremium, history.length);

  const pickPhoto = async (fromCamera: boolean) => {
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission requise', "Autorise l'accès pour continuer.");
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.8, allowsEditing: true });

    if (!result.canceled) {
      setUri(result.assets[0].uri);
      updateAnswers({ bodyPhotoUri: result.assets[0].uri });
    }
  };

  const skipPhoto = () =>
    Alert.alert(
      'Passer la photo ?',
      `Sans photo, l'IA ne peut identifier aucun muscle en retard : ton programme
couvrira tout le corps de façon équilibrée.

Tu pourras lancer l'analyse quand tu veux depuis l'onglet Corps.`,
      [
        { text: 'Prendre une photo', style: 'cancel' },
        {
          text: 'Passer',
          onPress: () => {
            // On efface toute analyse precedente pour rester coherent : on ne
            // presente jamais une ancienne analyse comme celle du jour.
            updateAnswers({ analysisSkipped: true, analysis: undefined, bodyPhotoUri: undefined });
            navigation.navigate('WorkoutLocation');
          },
        },
      ],
    );

  const goNext = async () => {
    if (!uri) {
      Alert.alert('Photo requise', 'Prends ou choisis une photo pour continuer.');
      return;
    }
    if (!gate.allowed) {
      Alert.alert(gate.title, gate.message, [
        { text: 'Plus tard', style: 'cancel' },
        { text: 'Voir Premium', onPress: () => navigation.navigate('Paywall') },
      ]);
      return;
    }
    navigation.navigate('AnalysisLoading');
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader
        title="Ta photo"
        subtitle="L'IA analysera tes 11 groupes musculaires"
        onBack={() => navigation.goBack()}
        dark
      />

      <View style={styles.photoBox}>
        {uri ? (
          <>
            <Image source={{ uri }} style={styles.photo} />
            <Pressable onPress={() => setUri(null)} style={styles.clearBtn}>
              <Ionicons name="close" size={16} color={colors.white} />
            </Pressable>
          </>
        ) : (
          <>
            <LinearGradient colors={gradients.muscle} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.placeholderIcon}>
              <Ionicons name="body" size={34} color={colors.white} />
            </LinearGradient>
            <Text style={styles.placeholder}>Aucune photo</Text>
          </>
        )}
      </View>

      <View style={styles.tips}>
        {TIPS.map((tip, i) => (
          <View key={i} style={styles.tipRow}>
            <Ionicons name="checkmark-circle" size={15} color={colors.success} />
            <Text style={styles.tipText}>{tip}</Text>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        <Pressable onPress={() => pickPhoto(true)} style={styles.actionCard}>
          <View style={[styles.actionIcon, { backgroundColor: `${colors.brand}14` }]}>
            <Ionicons name="camera" size={22} color={colors.brand} />
          </View>
          <Text style={styles.actionLabel}>Prendre une photo</Text>
        </Pressable>

        <Pressable onPress={() => pickPhoto(false)} style={styles.actionCard}>
          <View style={[styles.actionIcon, { backgroundColor: `${colors.fats}14` }]}>
            <Ionicons name="images" size={22} color={colors.fats} />
          </View>
          <Text style={styles.actionLabel}>Depuis la galerie</Text>
        </Pressable>
      </View>

      <GradientButton
        label="Lancer l'analyse IA"
        icon="sparkles"
        onPress={goNext}
        disabled={!uri}
        style={{ marginTop: spacing.lg }}
      />

      {/* Sortie explicite : l'analyse est le cœur de l'app, mais elle ne doit
          jamais bloquer quelqu'un qui ne veut pas se photographier. */}
      <SkipStepButton onPress={skipPhoto} />

      <Text style={styles.privacy}>Ta photo reste sur ton téléphone et n'est utilisée que pour l'analyse.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  quotaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start',
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: radius.pill,
    marginBottom: spacing.md,
  },
  quotaText: { ...font.tiny, fontWeight: '700' },

  container: { flex: 1, backgroundColor: colors.bg },
  photoBox: {
    height: 380,
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 0,
  },
  photo: { width: '100%', height: '100%' },
  clearBtn: {
    position: 'absolute', top: spacing.sm, right: spacing.sm,
    width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(14,16,22,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  placeholderIcon: {
    width: 72, height: 72, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
  },
  placeholder: { ...font.caption, color: colors.subtext, fontWeight: '700' },

  tips: { marginTop: spacing.md, gap: 7 },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tipText: { ...font.caption, color: colors.subtext },

  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  actionCard: {
    flex: 1, alignItems: 'center', gap: 8,
    backgroundColor: colors.card, borderRadius: radius.lg, paddingVertical: spacing.md,
    borderWidth: 0,
  },
  actionIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { ...font.caption, color: colors.text, fontWeight: '700' },

  privacy: { ...font.tiny, fontWeight: '500', color: colors.subtext, textAlign: 'center', marginTop: spacing.md },
});
