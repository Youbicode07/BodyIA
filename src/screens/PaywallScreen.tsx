import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { FadeInUp } from '../components/FadeInUp';
import { GradientButton } from '../components/GradientButton';
import { useSubscription } from '../context/SubscriptionContext';
import { colors, spacing, radius, font, gradients } from '../theme/colors';

const BENEFITS: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string }[] = [
  {
    icon: 'body',
    title: 'Analyses corporelles illimitées',
    text: 'Tes 11 groupes musculaires évalués à chaque photo, aussi souvent que tu veux.',
  },
  {
    icon: 'barbell',
    title: 'Programme recalculé en continu',
    text: 'Chaque nouvelle analyse réécrit tes séances sur tes zones réellement en retard.',
  },
  {
    icon: 'flame',
    title: 'Scan de repas sans limite',
    text: 'Calories et macros en une photo, avec ton objectif journalier suivi au réel.',
  },
  {
    icon: 'trending-up',
    title: 'Suivi de progression complet',
    text: 'Historique zone par zone, bilan tous les 15 jours, évolution du poids.',
  },
];

/**
 * ÉCRAN D'ABONNEMENT
 *
 * Il n'annonce jamais un prix décidé par l'application : les montants
 * affichés viennent du serveur, dans la devise que le prestataire prélèvera
 * réellement. Quand le paiement n'est pas branché, l'écran le dit clairement
 * au lieu de faire semblant d'encaisser — un faux « paiement réussi » serait
 * la pire chose à livrer ici.
 */
export function PaywallScreen({ navigation, route }: any) {
  const {
    plans,
    checkout,
    restore,
    paymentsAvailable,
    blocker,
    loadingPlans,
    config,
    isPremium,
    subscription,
  } = useSubscription();

  const [selected, setSelected] = useState<string>(
    plans.find((p) => p.interval === 'year')?.id ?? plans[0]?.id ?? 'monthly',
  );
  const [busy, setBusy] = useState(false);

  // L'écran sert de porte d'entrée obligatoire (gate) ou de simple vitrine
  // depuis le profil. On ne laisse fermer que dans le second cas.
  const dismissible = route?.params?.dismissible !== false;

  const close = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('MainTabs');
  };

  const plan = plans.find((p) => p.id === selected) ?? plans[0];
  const trialDays = config?.capabilities?.trial ? (plan?.trialDays ?? 0) : 0;

  const onSubscribe = async () => {
    if (!paymentsAvailable) {
      Alert.alert('Paiement indisponible', blocker ?? 'Le paiement n\'est pas encore configuré.');
      return;
    }
    setBusy(true);
    const outcome = await checkout(selected);
    setBusy(false);

    switch (outcome.result) {
      case 'success':
        Alert.alert(
          'Abonnement activé',
          trialDays > 0
            ? `Ton essai de ${trialDays} jours commence maintenant. Tout est débloqué.`
            : 'Merci ! Toutes les fonctionnalités sont débloquées.',
          [{ text: 'Continuer', onPress: close }],
        );
        break;
      case 'pending':
        Alert.alert(
          'Paiement en cours de confirmation',
          "Ta banque n'a pas encore confirmé l'opération. Cela prend parfois une minute — " +
            'utilise « Restaurer mon abonnement » juste après.',
        );
        break;
      case 'cancelled':
        // Fermeture volontaire de la page de paiement : rien à signaler.
        break;
      case 'error':
        Alert.alert('Paiement impossible', outcome.message);
        break;
    }
  };

  const onRestore = async () => {
    setBusy(true);
    const ok = await restore();
    setBusy(false);
    Alert.alert(
      ok ? 'Abonnement restauré' : 'Aucun abonnement trouvé',
      ok
        ? 'Ton abonnement est de nouveau actif sur cet appareil.'
        : "Aucun paiement vérifiable n'est rattaché à ce compte sur cet appareil.",
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
        showsVerticalScrollIndicator={false}
      >
        {dismissible ? (
          <Pressable onPress={close} hitSlop={14} style={styles.close}>
            <Ionicons name="close" size={20} color={colors.subtext} />
          </Pressable>
        ) : null}

        <FadeInUp>
          <LinearGradient
            colors={gradients.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.badge}
          >
            <Ionicons name="sparkles" size={30} color={colors.white} />
          </LinearGradient>
          <Text style={styles.title}>BodyAI Premium</Text>
          <Text style={styles.subtitle}>
            {trialDays > 0
              ? `${trialDays} jours d'essai, puis tu décides. Annulable à tout moment.`
              : 'Toutes les analyses, le programme et le suivi, sans limite.'}
          </Text>
        </FadeInUp>

        {isPremium ? (
          <FadeInUp delay={80}>
            <View style={styles.activeCard}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={styles.activeTitle}>
                  {subscription.status === 'trial' ? 'Essai en cours' : 'Abonnement actif'}
                </Text>
                <Text style={styles.activeText}>
                  {subscription.expiresAt
                    ? `Valable jusqu'au ${new Date(subscription.expiresAt).toLocaleDateString('fr-FR')}`
                    : 'Toutes les fonctionnalités sont débloquées.'}
                </Text>
              </View>
            </View>
          </FadeInUp>
        ) : null}

        <View style={styles.benefits}>
          {BENEFITS.map((b, i) => (
            <FadeInUp key={b.title} delay={100 + i * 50}>
              <View style={styles.benefitRow}>
                <View style={styles.benefitIcon}>
                  <Ionicons name={b.icon} size={17} color={colors.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.benefitTitle}>{b.title}</Text>
                  <Text style={styles.benefitText}>{b.text}</Text>
                </View>
              </View>
            </FadeInUp>
          ))}
        </View>

        {loadingPlans ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.brand} />
            <Text style={styles.loadingText}>Récupération des tarifs…</Text>
          </View>
        ) : null}

        {/* Les prix viennent du serveur : c'est lui qui décide du montant et de
            la devise réellement prélevés. */}
        <View style={styles.plans}>
          {plans.map((p, i) => {
            const active = p.id === selected;
            const yearly = p.interval === 'year';
            return (
              <FadeInUp key={p.id} delay={300 + i * 60}>
                <Pressable
                  onPress={() => setSelected(p.id)}
                  style={[styles.plan, active && styles.planActive]}
                >
                  <View style={styles.planRadio}>
                    {active ? <View style={styles.planRadioDot} /> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.planName}>{yearly ? 'Annuel' : 'Mensuel'}</Text>
                    <Text style={styles.planPrice}>{p.price}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.planPerMonth}>{p.perMonth}</Text>
                    {yearly ? (
                      <View style={styles.saveTag}>
                        <Text style={styles.saveText}>ÉCONOMIE</Text>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              </FadeInUp>
            );
          })}
        </View>

        {/* Quand le paiement n'est pas branché, on le dit — plutôt que de
            laisser croire à un encaissement qui n'aura pas lieu. */}
        {blocker ? (
          <FadeInUp delay={400}>
            <View style={styles.notice}>
              <Ionicons name="information-circle" size={16} color={colors.warning} />
              <Text style={styles.noticeText}>{blocker}</Text>
            </View>
          </FadeInUp>
        ) : null}

        <FadeInUp delay={440}>
          {busy ? (
            <View style={styles.busy}>
              <ActivityIndicator color={colors.white} />
              <Text style={styles.busyText}>Ouverture du paiement sécurisé…</Text>
            </View>
          ) : (
            <GradientButton
              label={trialDays > 0 ? `Essayer ${trialDays} jours gratuitement` : 'M’abonner'}
              icon="lock-open"
              onPress={onSubscribe}
              disabled={!paymentsAvailable || isPremium}
              style={{ marginTop: spacing.md }}
            />
          )}

          <Pressable onPress={onRestore} disabled={busy} style={styles.restore}>
            <Text style={styles.restoreText}>Restaurer mon abonnement</Text>
          </Pressable>

          {dismissible ? (
            <Pressable onPress={close} style={styles.later}>
              <Text style={styles.laterText}>Plus tard</Text>
            </Pressable>
          ) : null}

          <Text style={styles.legal}>
            Paiement traité par {config?.provider ? config.provider.toUpperCase() : 'notre prestataire'} sur
            sa propre page sécurisée : ton numéro de carte n’entre jamais dans l’application.
            Abonnement résiliable à tout moment.
          </Text>
        </FadeInUp>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  close: { alignSelf: 'flex-end', padding: spacing.xs },
  badge: {
    width: 72, height: 72, borderRadius: radius.lg, alignSelf: 'center',
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
  title: { ...font.h1, color: colors.text, textAlign: 'center' },
  subtitle: {
    ...font.body, color: colors.subtext, textAlign: 'center',
    marginTop: spacing.xs, paddingHorizontal: spacing.md, lineHeight: 21,
  },

  activeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.success,
    padding: spacing.md, marginTop: spacing.md,
  },
  activeTitle: { ...font.bodyBold, color: colors.text },
  activeText: { ...font.tiny, fontWeight: '500', color: colors.subtext, marginTop: 2 },

  benefits: { marginTop: spacing.lg, gap: spacing.md },
  benefitRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  benefitIcon: {
    width: 34, height: 34, borderRadius: 12,
    backgroundColor: 'rgba(14,165,165,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  benefitTitle: { ...font.bodyBold, color: colors.text },
  benefitText: { ...font.caption, color: colors.subtext, marginTop: 2, lineHeight: 18 },

  loading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.lg },
  loadingText: { ...font.caption, color: colors.faint },

  plans: { marginTop: spacing.lg, gap: spacing.sm },
  plan: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.cardBorder, padding: spacing.md,
  },
  planActive: { borderColor: colors.brand, backgroundColor: 'rgba(14,165,165,0.08)' },
  planRadio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.brand,
    alignItems: 'center', justifyContent: 'center',
  },
  planRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand },
  planName: { ...font.bodyBold, color: colors.text },
  planPrice: { ...font.caption, color: colors.subtext, marginTop: 2 },
  planPerMonth: { ...font.bodyBold, fontSize: 14, color: colors.brand },
  saveTag: {
    marginTop: 4, backgroundColor: colors.brand,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill,
  },
  saveText: { ...font.tiny, fontSize: 9, color: colors.white },

  notice: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: 'rgba(245,158,11,0.12)', borderRadius: radius.md,
    padding: spacing.md, marginTop: spacing.md,
  },
  noticeText: { ...font.tiny, fontWeight: '500', color: colors.subtext, flex: 1, lineHeight: 16 },

  busy: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: colors.brand, borderRadius: radius.pill,
    paddingVertical: 17, marginTop: spacing.md,
  },
  busyText: { ...font.bodyBold, color: colors.white },

  restore: { alignItems: 'center', paddingVertical: spacing.sm, marginTop: spacing.xs },
  restoreText: { ...font.caption, fontWeight: '700', color: colors.brand },
  later: { alignItems: 'center', paddingVertical: spacing.xs },
  laterText: { ...font.caption, fontWeight: '600', color: colors.faint },
  legal: {
    ...font.tiny, fontWeight: '500', color: colors.faint,
    textAlign: 'center', marginTop: spacing.md, lineHeight: 15,
  },
});
