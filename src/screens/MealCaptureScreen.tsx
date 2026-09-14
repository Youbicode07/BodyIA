import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, Alert, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { GradientButton } from '../components/GradientButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, spacing, radius, font, gradients } from '../theme/colors';

export function MealCaptureScreen({ navigation }: any) {
  const [uri, setUri] = useState<string | null>(null);

  const pickPhoto = async (fromCamera: boolean) => {
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission requise', "Autorise l'accès pour continuer.");
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });

    if (!result.canceled) setUri(result.assets[0].uri);
  };

  const goNext = async () => {
    if (!uri) {
      Alert.alert('Photo requise', 'Prends ou choisis une photo de ton repas.');
      return;
    }
    navigation.navigate('MealAnalyzing', { photoUri: uri });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader
        title="Scanner un repas"
        subtitle="Calories et macros estimées par l'IA"
        onBack={() => navigation.goBack()}
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
            <LinearGradient colors={gradients.fire} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.placeholderIcon}>
              <Ionicons name="fast-food" size={32} color={colors.white} />
            </LinearGradient>
            <Text style={styles.placeholder}>Aucune photo</Text>
            <Text style={styles.placeholderSub}>Cadre bien l'assiette entière</Text>
          </>
        )}
      </View>

      <View style={styles.actions}>
        <Pressable onPress={() => pickPhoto(true)} style={styles.actionCard}>
          <View style={[styles.actionIcon, { backgroundColor: `${colors.calories}14` }]}>
            <Ionicons name="camera" size={22} color={colors.calories} />
          </View>
          <Text style={styles.actionLabel}>Prendre une photo</Text>
        </Pressable>

        <Pressable onPress={() => pickPhoto(false)} style={styles.actionCard}>
          <View style={[styles.actionIcon, { backgroundColor: `${colors.carbs}14` }]}>
            <Ionicons name="images" size={22} color={colors.carbs} />
          </View>
          <Text style={styles.actionLabel}>Depuis la galerie</Text>
        </Pressable>
      </View>

      <GradientButton
        label="Analyser le repas"
        icon="sparkles"
        gradient={gradients.fire}
        onPress={goNext}
        disabled={!uri}
        style={{ marginTop: spacing.lg }}
      />
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
    height: 320,
    borderRadius: radius.xl,
    backgroundColor: colors.bgSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    borderStyle: 'dashed',
  },
  photo: { width: '100%', height: '100%' },
  clearBtn: {
    position: 'absolute', top: spacing.sm, right: spacing.sm,
    width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(14,16,22,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  placeholderIcon: {
    width: 68, height: 68, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
  },
  placeholder: { ...font.caption, color: colors.text, fontWeight: '700' },
  placeholderSub: { ...font.tiny, fontWeight: '500', color: colors.faint, marginTop: 2 },

  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  actionCard: {
    flex: 1, alignItems: 'center', gap: 8,
    backgroundColor: colors.bgSoft, borderRadius: radius.md, paddingVertical: spacing.md,
    borderWidth: 1, borderColor: colors.cardBorder,
  },
  actionIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { ...font.caption, color: colors.text, fontWeight: '700' },
});
