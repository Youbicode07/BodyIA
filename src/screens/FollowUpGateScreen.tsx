import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GradientButton } from '../components/GradientButton';
import { EmptyIllustration } from '../components/EmptyIllustration';
import { useCoach } from '../context/CoachContext';
import { useSubscription } from '../context/SubscriptionContext';
import { canAnalyseBody } from '../services/entitlements';
import { SNOOZE_HOURS } from '../services/analysisHistory';
import { muscleLabel } from '../data/muscleGroups';
import { colors, spacing, radius, font, gradients } from '../theme/colors';

/**
 * SUIVI OBLIGATOIRE À 15 JOURS
 * ============================
 *
 * Le contrôle n'existait que sur l'onglet Corps : on pouvait continuer à
 * utiliser toute l'application avec une analyse vieille de deux mois, et le
 * programme affiché restait calé sur des zones qui n'étaient peut-être plus
 * les bonnes. L'écran de suivi est maintenant posé devant l'application
 * entière.
 *
 * Une soupape reste nécessaire : si le service IA est en panne, un blocage
 * total empêcherait aussi de consulter sa nutrition du jour. Le report de
 * 24 h ne dispense pas du suivi, il évite seulement qu'une panne externe
 * rende l'application inutilisable.
 */
export function FollowUpGateScreen({ navigation }: any) {
  const { history, snoozeCheckIn, stats } = useCoach();
  const { isPremium } = useSubscription();
  const insets = useSafeAreaInsets();

  // Le suivi est la fonction payante par excellence : c'est la comparaison
  // dans le temps. On le dit franchement ici plutôt que de laisser l'utilisateur
  // découvrir le mur une fois la photo prise.
  const gate = canAnalyseBody(isPremium, history.length);

  const latest = history[0];
  const daysLate = latest
    ? Math.max(0, Math.floor((Date.now() - latest.date) / (24 * 60 * 60 * 1000)) - 15)
    : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]}>
      <View style={styles.badge}>
        <Ionicons name="camera" size={13} color={colors.warning} />
        <Text style={styles.badgeText}>SUIVI OBLIGATOIRE</Text>
      </View>

      <View style={styles.middle}>
        {latest?.photoUri ? (
          <View style={styles.photoWrap}>
            <Image source={{ uri: latest.photoUri }} style={styles.photo} />
            <View style={styles.photoTag}>
              <Text style={styles.photoTagText}>Il y a {15 + daysLate} jours</Text>
            </View>
          </View>
        ) : (
          <EmptyIllustration kind="body" width={150} color={colors.brand} />
        )}

        <Text style={styles.title}>C'est l'heure de ta nouvelle photo</Text>
        <Text style={styles.text}>
          Quinze jours se sont écoulés depuis ta dernière analyse. L'IA a besoin d'une photo
          récente pour comparer, mesurer ce qui a changé et adapter ton programme.
        </Text>

        {/* Ce qui sera comparé : donner ces repères rend l'obligation
            compréhensible plutôt qu'arbitraire. */}
        <View style={styles.recap}>
          <View style={styles.recapRow}>
            <Ionicons name="barbell-outline" size={15} color={colors.brand} />
            <Text style={styles.recapText}>
              {stats.totalSessions} séance{stats.totalSessions > 1 ? 's' : ''} enregistrée
              {stats.totalSessions > 1 ? 's' : ''} depuis le début
            </Text>
          </View>
          {latest && latest.problems.length > 0 ? (
            <View style={styles.recapRow}>
              <Ionicons name="alert-circle-outline" size={15} color={colors.danger} />
              <Text style={styles.recapText}>
                Zones à revérifier : {latest.problems.map((p) => muscleLabel(p.muscleGroup)).join(', ')}
              </Text>
            </View>
          ) : null}
          <View style={styles.recapRow}>
            <Ionicons name="bulb-outline" size={15} color={colors.warning} />
            <Text style={styles.recapText}>
              Même distance, même lumière et même tenue que la dernière fois : sinon la comparaison
              mesure l'éclairage, pas tes muscles.
            </Text>
          </View>
        </View>
      </View>

      {gate.allowed ? (
        <GradientButton
          label="Prendre ma nouvelle photo"
          icon="camera"
          gradient={gradients.muscle}
          onPress={() => navigation.navigate('PhotoCapture')}
        />
      ) : (
        <>
          <Text style={styles.premiumNote}>
            Le suivi comparatif fait partie de BodyAI Premium : c'est lui qui mesure ce qui a
            changé depuis ta première analyse.
          </Text>
          <GradientButton
            label="Débloquer mon suivi"
            icon="sparkles"
            gradient={gradients.muscle}
            onPress={() => navigation.navigate('Paywall')}
          />
        </>
      )}

      {/* Sortie visible, et non un lien discret en bas de page. Le suivi reste
          obligatoire, mais une panne du service IA ou une journée sans
          possibilité de se photographier ne doit jamais rendre l'application
          inutilisable, y compris pour consulter sa nutrition du jour. */}
      <Pressable onPress={snoozeCheckIn} style={styles.snooze}>
        <Ionicons name="time-outline" size={16} color={colors.subtext} />
        <Text style={styles.snoozeText}>Plus tard ({SNOOZE_HOURS} h)</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.lg },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    backgroundColor: `${colors.warning}1A`,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  badgeText: { ...font.tiny, fontSize: 10, letterSpacing: 1, color: colors.warning },
  premiumNote: {
    ...font.caption, color: colors.subtext, textAlign: 'center',
    marginBottom: spacing.sm, lineHeight: 18,
  },

  middle: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  photoWrap: { width: 150, height: 190, borderRadius: radius.lg, overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  photoTag: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    backgroundColor: 'rgba(11,18,32,0.75)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  photoTagText: { ...font.tiny, fontSize: 9.5, color: colors.white },

  title: { ...font.h1, fontSize: 25, color: colors.text, textAlign: 'center' },
  text: { ...font.body, color: colors.subtext, textAlign: 'center', lineHeight: 21 },

  recap: {
    alignSelf: 'stretch',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  recapRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  recapText: { flex: 1, ...font.tiny, fontWeight: '500', color: colors.subtext, lineHeight: 16 },

  snooze: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: spacing.sm,
    paddingVertical: 15,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
  },
  snoozeText: { ...font.caption, fontWeight: '700', color: colors.subtext },
});
