import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { ScreenHeader } from '../components/ScreenHeader';
import { GradientButton } from '../components/GradientButton';
import { GEMINI_API_KEY, MODEL_CANDIDATES, pingGemini, testModel } from '../services/gemini';
import {
  GOOGLE_ANDROID_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
  IS_EXPO_GO,
  googleBlocker,
  googleModuleAvailable,
} from '../services/socialAuth';
import { API_CONFIGURED, API_URL, apiRequest, loadToken, subscriptionApi } from '../services/api';
import { colors, spacing, radius, font } from '../theme/colors';

type StepState = 'pending' | 'running' | 'ok' | 'fail';

type Step = {
  key: string;
  label: string;
  state: StepState;
  detail?: string;
};

const INITIAL: Step[] = [
  { key: 'key', label: 'Clé Gemini chargée dans l\'app', state: 'pending' },
  { key: 'network', label: 'Connexion aux serveurs Google', state: 'pending' },
  { key: 'models', label: 'Modèles réellement disponibles', state: 'pending' },
  { key: 'vision', label: 'Analyse d\'une image test', state: 'pending' },
  // Les briques qui échouaient sans jamais dire pourquoi sur un vrai
  // téléphone : la connexion Google, le serveur, la base et le paiement.
  { key: 'google', label: 'Connexion Google (configuration)', state: 'pending' },
  { key: 'server', label: 'Serveur BodyAI et base de données', state: 'pending' },
  { key: 'session', label: 'Session et sauvegarde en ligne', state: 'pending' },
  { key: 'payments', label: 'Paiement', state: 'pending' },
];

/**
 * Écran de diagnostic : exécute la même chaîne d'appels que l'analyse photo,
 * étape par étape, et affiche précisément laquelle échoue. Sans lui, un échec
 * se résume à « service indisponible », ce qui ne permet pas de corriger.
 */
export function DiagnosticScreen({ navigation }: any) {
  const [steps, setSteps] = useState<Step[]>(INITIAL);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  const update = (key: string, state: StepState, detail?: string) =>
    setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, state, detail } : s)));

  const runDiagnostic = async () => {
    setRunning(true);
    setDone(false);
    setSteps(INITIAL);

    // 1. La clé arrive-t-elle jusqu'au code de l'app ?
    update('key', 'running');
    if (!GEMINI_API_KEY) {
      update('key', 'fail', "Aucune clé reçue. Vérifie .env à la racine puis relance avec : npx expo start -c");
      setRunning(false);
      setDone(true);
      return;
    }
    update('key', 'ok', `Clé de ${GEMINI_API_KEY.length} caractères, débute par ${GEMINI_API_KEY.slice(0, 6)}…`);

    // 2. Le téléphone joint-il l'API ? (échoue si pas de réseau, ou clé refusée)
    update('network', 'running');
    const ping = await pingGemini();
    if (!ping.ok) {
      update('network', 'fail', ping.error);
      setRunning(false);
      setDone(true);
      return;
    }
    update('network', 'ok', 'Le téléphone atteint bien l\'API Gemini.');

    // 3. Quels modèles répondent vraiment à cette clé ?
    update('models', 'running');
    update('models', 'ok', `${ping.modelCount} modèles visibles sur ce compte.`);

    // 4. Le test décisif : une vraie analyse d'image.
    update('vision', 'running');
    const results: string[] = [];
    let anyOk = false;

    for (const model of MODEL_CANDIDATES) {
      const r = await testModel(model);
      if (r.ok) {
        results.push(`✓ ${model} — ${r.ms} ms`);
        anyOk = true;
      } else {
        results.push(`✗ ${model} — ${r.error}`);
      }
    }

    update(
      'vision',
      anyOk ? 'ok' : 'fail',
      results.join('\n'),
    );

    // 5. Connexion Google : on vérifie la CONFIGURATION, pas le compte — ouvrir
    //    une fenêtre de connexion au milieu d'un diagnostic serait intrusif.
    update('google', 'running');
    const short = (value: string) => (value ? `${value.slice(0, 16)}…` : 'ABSENT');
    const gBlocker = googleBlocker();
    update(
      'google',
      gBlocker ? 'fail' : 'ok',
      [
        `Identifiant Web     : ${short(GOOGLE_WEB_CLIENT_ID)}`,
        `Identifiant iOS     : ${short(GOOGLE_IOS_CLIENT_ID)}`,
        `Identifiant Android : ${short(GOOGLE_ANDROID_CLIENT_ID)}`,
        `Module natif        : ${googleModuleAvailable() ? 'présent' : 'ABSENT de cette build'}`,
        `Environnement       : ${IS_EXPO_GO ? 'Expo Go (connexion impossible)' : 'build native'}`,
        gBlocker ?? 'Prêt.',
      ].join('\n'),
    );

    // 6. Le serveur et sa base : c'est lui qui rend les données durables.
    update('server', 'running');
    if (!API_CONFIGURED) {
      const sansServeur =
        "API_URL absente de .env : l'application fonctionne uniquement en local. " +
        "Ni sauvegarde en ligne, ni abonnement encaissable. Renseigne l'adresse du " +
        'backend déployé, puis relance avec « npx expo start -c ».';
      update('server', 'fail', sansServeur);
      update('session', 'fail', 'Impossible sans serveur configuré.');
      update('payments', 'fail', 'Impossible sans serveur configuré.');
      setRunning(false);
      setDone(true);
      return;
    }

    try {
      const health = await apiRequest<any>('/health', { auth: false });
      const dbOk = health?.database && !String(health.database).startsWith('erreur');
      update(
        'server',
        dbOk ? 'ok' : 'fail',
        [
          `Adresse             : ${API_URL}`,
          `Base de données     : ${health?.database ?? 'inconnue'}`,
          `Secret de session   : ${health?.sessionSecret ? 'configuré' : 'ABSENT — sessions perdues à chaque redémarrage'}`,
          `Google côté serveur : ${health?.googleAuth ? 'configuré' : 'ABSENT — GOOGLE_WEB_CLIENT_ID manquant dans backend/.env'}`,
        ].join('\n'),
      );
    } catch (err) {
      update('server', 'fail', err instanceof Error ? err.message : String(err));
    }

    // 7. La session : sans elle, rien n'est sauvegardé en ligne.
    update('session', 'running');
    const token = await loadToken();
    if (!token) {
      update('session', 'fail', 'Aucune session : connecte-toi pour activer la sauvegarde en ligne.');
    } else {
      try {
        const me = await apiRequest<any>('/api/auth/me');
        update(
          'session',
          'ok',
          [
            `Connecté : ${me?.user?.name ?? '?'} (${me?.user?.provider ?? '?'})`,
            `Identifiant serveur : ${me?.user?.id ?? '?'}`,
            'Tes données sont sauvegardées en ligne.',
          ].join('\n'),
        );
      } catch (err) {
        update('session', 'fail', err instanceof Error ? err.message : String(err));
      }
    }

    // 8. Paiement : un prestataire est-il réellement configuré ?
    update('payments', 'running');
    try {
      const cfg = await subscriptionApi.plans();
      update(
        'payments',
        cfg.configured ? 'ok' : 'fail',
        [
          `Prestataire : ${cfg.provider ?? 'aucun'}`,
          `Formules    : ${(cfg.plans ?? []).map((p: any) => `${p.id} ${p.price}`).join(' · ') || 'aucune'}`,
          cfg.configured
            ? 'Paiement opérationnel.'
            : (cfg.error ?? 'Clés du prestataire absentes de backend/.env (CMI ou Stripe).'),
        ].join('\n'),
      );
    } catch (err) {
      update('payments', 'fail', err instanceof Error ? err.message : String(err));
    }

    setRunning(false);
    setDone(true);
  };

  const shareReport = () => {
    const report = steps
      .map((s) => `[${s.state.toUpperCase()}] ${s.label}${s.detail ? `\n${s.detail}` : ''}`)
      .join('\n\n');
    Share.share({ message: `Diagnostic BodyAI\n\n${report}` });
  };

  const iconFor = (state: StepState) => {
    if (state === 'ok') return { name: 'checkmark-circle' as const, color: colors.success };
    if (state === 'fail') return { name: 'close-circle' as const, color: colors.danger };
    if (state === 'running') return { name: 'ellipsis-horizontal-circle' as const, color: colors.brand };
    return { name: 'ellipse-outline' as const, color: colors.faint };
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader
        title="Diagnostic"
        subtitle="IA, Google, serveur, base de données et paiement"
        onBack={() => navigation.goBack()}
      />

      <Card style={styles.introCard}>
        <Ionicons name="pulse" size={22} color={colors.brand} />
        <Text style={styles.introText}>
          Ce test reproduit exactement ce que fait l'application : l'analyse photo, la
          configuration de la connexion Google et le serveur de paiement. Chaque étape en rouge
          indique précisément ce qui manque, et où le corriger.
        </Text>
      </Card>

      {steps.map((step) => {
        const icon = iconFor(step.state);
        return (
          <Card key={step.key} style={styles.stepCard}>
            <View style={styles.stepHeader}>
              {step.state === 'running' ? (
                <ActivityIndicator size="small" color={colors.brand} />
              ) : (
                <Ionicons name={icon.name} size={20} color={icon.color} />
              )}
              <Text style={styles.stepLabel}>{step.label}</Text>
            </View>
            {step.detail ? <Text style={styles.stepDetail}>{step.detail}</Text> : null}
          </Card>
        );
      })}

      <GradientButton
        label={running ? 'Test en cours…' : 'Lancer le diagnostic'}
        icon="play"
        onPress={runDiagnostic}
        disabled={running}
        style={{ marginTop: spacing.md }}
      />

      {done ? (
        <Pressable onPress={shareReport} style={styles.shareBtn}>
          <Ionicons name="share-outline" size={16} color={colors.brand} />
          <Text style={styles.shareText}>Partager le rapport</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgSoft },
  introCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  introText: { flex: 1, ...font.caption, color: colors.subtext, lineHeight: 19 },
  stepCard: { marginBottom: spacing.sm },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepLabel: { ...font.bodyBold, fontSize: 14, color: colors.text, flex: 1 },
  stepDetail: {
    ...font.tiny,
    fontWeight: '500',
    color: colors.subtext,
    marginTop: spacing.sm,
    lineHeight: 17,
    fontFamily: undefined,
  },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: spacing.md, marginTop: spacing.sm,
  },
  shareText: { ...font.caption, color: colors.brand, fontWeight: '700' },
});
