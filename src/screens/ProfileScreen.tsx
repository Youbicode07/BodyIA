import React, { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Card } from '../components/Card';
import { SettingsRow } from '../components/SettingsRow';
import { FadeInUp } from '../components/FadeInUp';
import { useOnboarding } from '../context/OnboardingContext';
import { useUser } from '../context/UserContext';
import { useCoach } from '../context/CoachContext';
import { useSubscription } from '../context/SubscriptionContext';
import { API_CONFIGURED } from '../services/api';
import { SyncState, subscribeSync, syncNow } from '../services/sync';
import { buildProfileSections, profileCompletion } from '../services/profileSummary';
import { colors, spacing, radius, font, gradients } from '../theme/colors';

const GOAL_LABEL: Record<string, string> = {
  lose: 'Perdre du poids',
  maintain: 'Maintenir',
  gain: 'Prendre du muscle',
};

const PROVIDER_META: Record<string, { icon: string; label: string }> = {
  google: { icon: 'logo-google', label: 'Compte Google' },
  apple: { icon: 'logo-apple', label: 'Compte Apple' },
  email: { icon: 'mail-outline', label: 'Compte e-mail' },
};

/** Initiales affichées quand aucune photo de profil n'est disponible. */
function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function ProfileScreen({ navigation }: any) {
  const { answers, resetAnswers } = useOnboarding();
  const { user, signOut, isRemote, sessionExpired } = useUser();
  const { stats, program, history, resetCoachData } = useCoach();
  const { subscription, isPremium, trialDaysLeft, paymentsAvailable } = useSubscription();

  // État de la sauvegarde en ligne, mis à jour en direct par le service de
  // synchronisation : l'utilisateur doit pouvoir voir si ses données sont
  // réellement enregistrées, pas seulement l'espérer.
  const [sync, setSync] = useState<SyncState | null>(null);
  useEffect(() => subscribeSync(setSync), []);
  const [syncing, setSyncing] = useState(false);

  const runSync = async () => {
    setSyncing(true);
    await syncNow();
    setSyncing(false);
  };

  const goalLabel = answers.goal ? GOAL_LABEL[answers.goal] ?? answers.goal : 'Objectif non défini';
  const analysedZones = (answers.analysis?.zones ?? []).filter(
    (z) => z.visible !== false && !z.isGeneric,
  );
  const priorityCount = analysedZones.filter((z) => z.status === 'priority').length;

  const completion = profileCompletion(answers);
  const sections = buildProfileSections(answers, colors);
  const provider = user ? PROVIDER_META[user.provider] : undefined;

  const confirmSignOut = () =>
    Alert.alert('Se déconnecter', 'Ton profil sera retiré de cet appareil. Tes réponses sont conservées.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Se déconnecter', style: 'destructive', onPress: () => signOut() },
    ]);

  const confirmReset = () =>
    Alert.alert(
      'Refaire mon questionnaire',
      'Tes réponses, ton analyse corporelle, ton programme et ton journal de séances seront effacés. Cette action est définitive.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Tout effacer',
          style: 'destructive',
          onPress: async () => {
            // Le programme et l'historique doivent partir avec les réponses :
            // les conserver laisserait l'application réclamer un suivi
            // rattaché à un profil qui n'existe plus.
            await Promise.all([resetAnswers(), resetCoachData()]);
            navigation.navigate('OnboardingStep', { index: 0 });
          },
        },
      ],
    );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: spacing.xxl }}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={gradients.brand}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        {user?.photoUrl ? (
          <Image source={{ uri: user.photoUrl }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatar}>
            {user ? (
              <Text style={styles.avatarText}>{initials(user.name)}</Text>
            ) : (
              <Ionicons name="person" size={32} color={colors.white} />
            )}
          </View>
        )}

        <Text style={styles.name}>{user?.name ?? 'Profil non créé'}</Text>
        {user?.email ? <Text style={styles.email}>{user.email}</Text> : null}
        <Text style={styles.goal}>{goalLabel}</Text>

        {provider ? (
          <View style={styles.providerChip}>
            <Ionicons name={provider.icon as any} size={11} color={colors.white} />
            <Text style={styles.providerText}>{provider.label}</Text>
          </View>
        ) : (
          // Sans compte, l'action la plus utile est de le créer : on la met en avant.
          <Pressable
            onPress={() => navigation.navigate('Auth', { returnTo: 'back' })}
            style={styles.createChip}
          >
            <Ionicons name="person-add" size={13} color={colors.brand} />
            <Text style={styles.createChipText}>Créer mon profil</Text>
          </Pressable>
        )}
      </LinearGradient>

      <View style={styles.body}>
        <FadeInUp>
          <View style={styles.statsRow}>
            <Card style={styles.statCard}>
              <Ionicons name="flame" size={18} color={colors.calories} />
              <Text style={styles.statValue}>{answers.dailyCalorieGoal ?? 2000}</Text>
              <Text style={styles.statLabel}>kcal / jour</Text>
            </Card>
            <Card style={styles.statCard}>
              <Ionicons name="barbell" size={18} color={colors.brand} />
              <Text style={styles.statValue}>{answers.weightKg ?? '—'}</Text>
              <Text style={styles.statLabel}>kg</Text>
            </Card>
            <Card style={styles.statCard}>
              <Ionicons name="alert-circle" size={18} color={colors.danger} />
              <Text style={styles.statValue}>{priorityCount}</Text>
              <Text style={styles.statLabel}>à prioriser</Text>
            </Card>
          </View>
        </FadeInUp>

        {/* Ce que l'entraînement a réellement produit. Ces trois chiffres
            viennent du journal de séances, pas d'une estimation. */}
        {program ? (
          <FadeInUp delay={30}>
            <Pressable onPress={() => navigation.navigate('ProgressHistory')}>
              <Card style={styles.trainingCard}>
                <View style={styles.trainingItem}>
                  <Text style={styles.trainingValue}>{stats.totalSessions}</Text>
                  <Text style={styles.trainingLabel}>séances</Text>
                </View>
                <View style={styles.trainingDivider} />
                <View style={styles.trainingItem}>
                  <Text style={styles.trainingValue}>{stats.streakWeeks}</Text>
                  <Text style={styles.trainingLabel}>sem. d'affilée</Text>
                </View>
                <View style={styles.trainingDivider} />
                <View style={styles.trainingItem}>
                  <Text style={styles.trainingValue}>{history.length}</Text>
                  <Text style={styles.trainingLabel}>analyses</Text>
                </View>
              </Card>
            </Pressable>
          </FadeInUp>
        ) : null}

        {/* Complétion du profil : montre ce qu'il reste à renseigner plutôt
            que de laisser des sections vides sans explication. */}
        <FadeInUp delay={60}>
          <Card style={styles.completionCard}>
            <View style={styles.completionHeader}>
              <Text style={styles.completionTitle}>Profil complété</Text>
              <Text style={styles.completionValue}>{completion} %</Text>
            </View>
            <View style={styles.completionTrack}>
              <View style={[styles.completionFill, { width: `${completion}%` }]} />
            </View>
            {completion < 100 ? (
              <Text style={styles.completionHint}>
                {answers.analysis
                  ? 'Complète les informations manquantes pour affiner ton plan.'
                  : "Lance une analyse corporelle pour compléter ton profil."}
              </Text>
            ) : null}
          </Card>
        </FadeInUp>

        {/* Sauvegarde en ligne : dire clairement où vivent les données.
            Sans compte, elles ne quittent pas le téléphone — et une
            désinstallation les emporte. C'est une information que
            l'utilisateur doit avoir AVANT de la découvrir à ses dépens. */}
        <FadeInUp delay={70}>
          <Card style={styles.subCard}>
            <View style={styles.subHeader}>
              <View
                style={[
                  styles.subIcon,
                  { backgroundColor: isRemote ? 'rgba(14,165,165,0.16)' : 'rgba(245,158,11,0.16)' },
                ]}
              >
                <Ionicons
                  name={isRemote ? 'cloud-done' : 'phone-portrait-outline'}
                  size={19}
                  color={isRemote ? colors.success : colors.warning}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.subTitle}>
                  {isRemote ? 'Sauvegarde en ligne active' : 'Données sur ce téléphone uniquement'}
                </Text>
                <Text style={styles.subMeta}>
                  {sessionExpired
                    ? 'Session expirée : reconnecte-toi pour reprendre la sauvegarde.'
                    : isRemote
                      ? sync?.pending
                        ? `${sync.pending} modification${sync.pending > 1 ? 's' : ''} en attente d'envoi`
                        : sync?.lastSyncAt
                          ? `Synchronisé à ${new Date(sync.lastSyncAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
                          : 'Tout est à jour'
                      : !API_CONFIGURED
                        ? "Aucun serveur configuré dans cette build (API_URL absente de .env)."
                        : 'Connecte-toi pour retrouver tes données sur un autre téléphone.'}
                </Text>
              </View>
            </View>

            {sync?.lastError ? <Text style={styles.subNotice}>{sync.lastError}</Text> : null}

            {isRemote ? (
              <Pressable onPress={runSync} disabled={syncing} style={styles.subCta}>
                <Ionicons name={syncing ? 'sync' : 'cloud-upload-outline'} size={15} color={colors.white} />
                <Text style={styles.subCtaText}>
                  {syncing ? 'Synchronisation…' : 'Synchroniser maintenant'}
                </Text>
              </Pressable>
            ) : user && API_CONFIGURED ? (
              <Pressable
                onPress={() => navigation.navigate('Auth', { returnTo: 'back' })}
                style={styles.subCta}
              >
                <Ionicons name="cloud-upload-outline" size={15} color={colors.white} />
                <Text style={styles.subCtaText}>Activer la sauvegarde en ligne</Text>
              </Pressable>
            ) : null}
          </Card>
        </FadeInUp>

        {/* Abonnement : état réel du compte, jamais une promesse. Les styles
            existaient déjà dans cette feuille mais aucune carte ne les
            utilisait — la section était simplement absente de l'écran. */}
        <FadeInUp delay={80}>
          <Card style={styles.subCard}>
            <View style={styles.subHeader}>
              <View
                style={[
                  styles.subIcon,
                  { backgroundColor: isPremium ? 'rgba(14,165,165,0.16)' : 'rgba(124,58,237,0.16)' },
                ]}
              >
                <Ionicons
                  name={isPremium ? 'checkmark-circle' : 'sparkles'}
                  size={19}
                  color={isPremium ? colors.success : colors.gym}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.subTitle}>
                  {subscription.status === 'trial'
                    ? `Essai Premium · ${trialDaysLeft} j restants`
                    : subscription.status === 'active'
                      ? 'BodyAI Premium'
                      : subscription.status === 'expired'
                        ? 'Abonnement expiré'
                        : 'Plan gratuit'}
                </Text>
                <Text style={styles.subMeta}>
                  {isPremium && subscription.expiresAt
                    ? `Renouvellement le ${new Date(subscription.expiresAt).toLocaleDateString('fr-FR')}`
                    : isPremium
                      ? 'Toutes les fonctionnalités sont débloquées'
                      : '1 analyse corporelle · 3 scans de repas par jour'}
                </Text>
              </View>
            </View>

            {!isPremium ? (
              <Pressable onPress={() => navigation.navigate('Paywall')} style={styles.subCta}>
                <Ionicons name="lock-open" size={15} color={colors.white} />
                <Text style={styles.subCtaText}>
                  {subscription.status === 'expired' ? 'Réactiver Premium' : 'Passer à Premium'}
                </Text>
              </Pressable>
            ) : null}

            {!paymentsAvailable ? (
              <Text style={styles.subNotice}>
                Le paiement par carte n'est pas encore branché sur cette build : renseigne
                PAYMENTS_URL dans .env avec l'adresse du backend déployé.
              </Text>
            ) : null}
          </Card>
        </FadeInUp>

        {/* Toutes les réponses d'inscription, regroupées par thème. */}
        {sections.map((section, i) => (
          <FadeInUp key={section.title} delay={100 + i * 50}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Card padded={false}>
              <View style={styles.list}>
                {section.rows.map((row, j) => (
                  <SettingsRow
                    key={row.label}
                    icon={row.icon as any}
                    color={row.color}
                    label={row.label}
                    value={row.value}
                    isLast={j === section.rows.length - 1}
                  />
                ))}
              </View>
            </Card>
          </FadeInUp>
        ))}

        <Text style={styles.sectionTitle}>Mon compte</Text>
        <FadeInUp delay={300}>
          <Card padded={false}>
            <View style={styles.list}>
              <SettingsRow
                icon="create-outline"
                color={colors.brand}
                label="Modifier mes informations"
                onPress={() => navigation.navigate('ProfileEdit')}
              />
              <SettingsRow
                icon="camera-outline"
                color={colors.gym}
                label="Refaire mon analyse corporelle"
                onPress={() => navigation.navigate('PhotoCapture')}
              />
              <SettingsRow
                icon="card-outline"
                color={colors.brandAlt}
                label="Mon abonnement"
                value={isPremium ? 'Premium' : 'Gratuit'}
                onPress={() => navigation.navigate('Paywall')}
              />
              <SettingsRow
                icon="refresh-outline"
                color={colors.carbs}
                label="Refaire mon questionnaire"
                onPress={confirmReset}
              />
              <SettingsRow
                icon="pulse-outline"
                color={colors.success}
                label="Diagnostic (IA · Google · paiement)"
                value="tester"
                onPress={() => navigation.navigate('Diagnostic')}
                isLast={!user}
              />
              {user ? (
                <SettingsRow
                  icon="log-out-outline"
                  color={colors.danger}
                  label="Se déconnecter"
                  onPress={confirmSignOut}
                  isLast
                />
              ) : null}
            </View>
          </Card>
        </FadeInUp>

        <Text style={styles.version}>BodyAI · v1.0.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  trainingCard: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.md, marginBottom: spacing.sm,
  },
  trainingItem: { flex: 1, alignItems: 'center' },
  trainingValue: { ...font.h2, fontSize: 20, color: colors.brand },
  trainingLabel: { ...font.tiny, fontSize: 9.5, fontWeight: '500', color: colors.subtext, marginTop: 2 },
  trainingDivider: { width: 1, height: 28, backgroundColor: colors.cardBorder },

  container: { flex: 1, backgroundColor: colors.bgSoft },
  hero: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  avatar: {
    width: 78, height: 78, borderRadius: 39,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)',
  },
  avatarImage: {
    width: 78, height: 78, borderRadius: 39, marginBottom: spacing.sm,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)',
  },
  avatarText: { ...font.h1, color: colors.white },
  name: { ...font.h2, color: colors.white },
  email: { ...font.caption, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  goal: { ...font.caption, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  providerChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill,
  },
  providerText: { ...font.tiny, fontSize: 10, color: colors.white },
  createChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm,
    backgroundColor: colors.white,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill,
  },
  createChipText: { ...font.tiny, color: colors.brand },

  body: { padding: spacing.lg, marginTop: -spacing.md },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: spacing.md, gap: 4 },
  statValue: { ...font.h3, color: colors.text },
  statLabel: { ...font.tiny, fontWeight: '500', color: colors.subtext, textAlign: 'center' },

  completionCard: { gap: spacing.sm },
  completionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  completionTitle: { ...font.h3, fontSize: 15, color: colors.text },
  completionValue: { ...font.h3, fontSize: 15, color: colors.brand },
  completionTrack: {
    height: 7, borderRadius: 4, backgroundColor: colors.progressTrack, overflow: 'hidden',
  },
  completionFill: { height: '100%', borderRadius: 4, backgroundColor: colors.brand },
  completionHint: { ...font.tiny, fontWeight: '500', color: colors.subtext, lineHeight: 16 },

  subCard: { gap: spacing.sm },
  subHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  subIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  subTitle: { ...font.h3, fontSize: 15, color: colors.text },
  subMeta: { ...font.tiny, fontWeight: '500', color: colors.subtext, marginTop: 2 },
  subNotice: { ...font.tiny, fontWeight: '500', color: colors.faint, lineHeight: 15 },
  subCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: colors.brand, borderRadius: radius.pill, paddingVertical: 12,
  },
  subCtaText: { ...font.caption, fontWeight: '700', color: colors.white },

  sectionTitle: { ...font.h3, color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm },
  list: { paddingHorizontal: spacing.md },
  version: { ...font.tiny, fontWeight: '500', color: colors.faint, textAlign: 'center', marginTop: spacing.xl },
});
