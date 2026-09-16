import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { FadeInUp } from '../components/FadeInUp';
import { useUser } from '../context/UserContext';
import {
  appleBlocker,
  googleBlocker,
  signInWithApple,
  signInWithGoogle,
} from '../services/socialAuth';
import { API_CONFIGURED } from '../services/api';
import { colors, spacing, radius, font, gradients } from '../theme/colors';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

export function AuthScreen({ navigation, route }: any) {
  const { signIn } = useUser();

  const [busy, setBusy] = useState<'google' | 'apple' | 'email' | null>(null);
  const [showForm, setShowForm] = useState(false);
  /**
   * Créer un compte ou se connecter à un compte existant.
   *
   * Cette distinction n'existait pas : l'ancien écran « créait » toujours un
   * profil à partir d'un simple prénom. Quelqu'un qui réinstallait
   * l'application repartait donc de zéro, et rien n'empêchait deux personnes de
   * revendiquer la même identité.
   */
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // null = disponible, chaîne = raison de l'indisponibilité, undefined = pas encore vérifié.
  const [appleReason, setAppleReason] = useState<string | null | undefined>(undefined);

  // « Se connecter avec Apple » n'est proposé que si l'appareil sait vraiment
  // le faire : un bouton qui échoue à l'appui vaut moins qu'un bouton absent.
  useEffect(() => {
    let alive = true;
    if (Platform.OS !== 'ios') {
      setAppleReason('non-ios');
      return;
    }
    appleBlocker().then((reason) => {
      if (alive) setAppleReason(reason);
    });
    return () => {
      alive = false;
    };
  }, []);

  /**
   * L'écran sert à trois endroits, d'où le paramètre `returnTo` :
   *   • 'onboarding' — au tout début du parcours : on enchaîne sur le
   *     questionnaire. C'est ce qui permet de rattacher les réponses au compte
   *     dès la première question, et donc de ne plus jamais les redemander.
   *   • 'back'       — depuis l'onglet Profil : on revient d'où l'on vient.
   *   • par défaut   — fin de parcours : on entre dans l'application.
   */
  const goNext = () => {
    const returnTo = route?.params?.returnTo;
    if (returnTo === 'back' && navigation.canGoBack()) navigation.goBack();
    else if (returnTo === 'onboarding') navigation.replace('OnboardingStep', { index: 0 });
    else navigation.navigate('MainTabs');
  };

  const handleGoogle = async () => {
    // Le blocage est expliqué au lieu d'ouvrir une fenêtre qui échouera.
    const blocker = googleBlocker();
    if (blocker) {
      Alert.alert('Connexion Google', blocker);
      return;
    }
    setBusy('google');
    try {
      const profile = await signInWithGoogle();
      if (!profile) return; // fenêtre fermée par l'utilisateur
      // `idToken` est la pièce maîtresse : c'est lui que le serveur vérifie
      // auprès de Google. Sans lui, le compte resterait local à ce téléphone.
      await signIn({ ...profile, provider: 'google' });
      goNext();
    } catch (err) {
      Alert.alert('Connexion Google échouée', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const handleApple = async () => {
    // Revérifié à l'appui : au premier rendu, la vérification asynchrone peut
    // ne pas être encore revenue, et on ne veut jamais lancer un flux dont on
    // sait qu'il échouera.
    const reason = appleReason === undefined ? await appleBlocker() : appleReason;
    setAppleReason(reason);
    if (reason) {
      Alert.alert('Connexion Apple', reason);
      return;
    }
    setBusy('apple');
    try {
      const profile = await signInWithApple();
      if (!profile) return; // annulation
      await signIn({ ...profile, provider: 'apple' });
      goNext();
    } catch (err) {
      Alert.alert('Connexion Apple échouée', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const handleEmail = async () => {
    const cleanName = name.trim();
    const cleanEmail = email.trim();

    if (mode === 'register' && cleanName.length < 2) {
      Alert.alert('Nom manquant', 'Indique au moins ton prénom.');
      return;
    }
    // Sans serveur, l'application fonctionne en local : l'adresse reste
    // facultative et aucun mot de passe n'est demandé, puisqu'il n'y aurait
    // personne pour le vérifier.
    if (API_CONFIGURED) {
      if (!EMAIL_RE.test(cleanEmail)) {
        Alert.alert('E-mail invalide', 'Saisis une adresse valide pour retrouver ton compte.');
        return;
      }
      if (password.length < MIN_PASSWORD) {
        Alert.alert(
          'Mot de passe trop court',
          `Choisis un mot de passe d'au moins ${MIN_PASSWORD} caractères.`,
        );
        return;
      }
    } else if (cleanEmail && !EMAIL_RE.test(cleanEmail)) {
      Alert.alert('E-mail invalide', "Vérifie l'adresse saisie, ou laisse le champ vide.");
      return;
    }

    setBusy('email');
    try {
      await signIn({
        name: cleanName || cleanEmail.split('@')[0],
        email: cleanEmail || undefined,
        provider: 'email',
        password: API_CONFIGURED ? password : undefined,
        register: mode === 'register',
      });
      goNext();
    } catch (err) {
      Alert.alert(
        mode === 'register' ? 'Création impossible' : 'Connexion impossible',
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <FadeInUp>
          <LinearGradient
            colors={gradients.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.icon}
          >
            <Ionicons name="person-circle" size={34} color={colors.white} />
          </LinearGradient>
          <Text style={styles.title}>
            {mode === 'login' && showForm ? 'Content de te revoir' : 'Crée ton profil'}
          </Text>
          <Text style={styles.subtitle}>
            {API_CONFIGURED
              ? 'Ton questionnaire, tes analyses et ton programme sont sauvegardés sur ton compte. ' +
                'Change de téléphone, réinstalle : tout revient à la connexion.'
              : 'Tes réponses, ton analyse corporelle et ton programme seront rattachés à ce profil ' +
                'et conservés sur ce téléphone.'}
          </Text>
        </FadeInUp>

        <View style={styles.buttons}>
          {Platform.OS === 'ios' ? (
            <FadeInUp delay={80}>
              <Pressable
                onPress={handleApple}
                disabled={busy !== null}
                style={[styles.authButton, styles.appleButton, Boolean(appleReason) && styles.dimmed]}
              >
                {busy === 'apple' ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <>
                    <Ionicons name="logo-apple" size={19} color={colors.white} />
                    <Text style={[styles.authLabel, { color: colors.white }]}>
                      Continuer avec Apple
                    </Text>
                  </>
                )}
              </Pressable>
            </FadeInUp>
          ) : null}

          <FadeInUp delay={110}>
            <Pressable
              onPress={handleGoogle}
              disabled={busy !== null}
              style={[styles.authButton, styles.googleButton, googleBlocker() && styles.dimmed]}
            >
              {busy === 'google' ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <>
                  <Ionicons name="logo-google" size={19} color={colors.text} />
                  <Text style={styles.authLabel}>Continuer avec Google</Text>
                </>
              )}
            </Pressable>
          </FadeInUp>

          <FadeInUp delay={170}>
            <View style={styles.separatorRow}>
              <View style={styles.separator} />
              <Text style={styles.separatorText}>ou</Text>
              <View style={styles.separator} />
            </View>
          </FadeInUp>

          {showForm ? (
            <FadeInUp>
              <View style={styles.form}>
                {/* Créer / Se connecter : deux intentions différentes, deux
                    validations différentes. Les confondre était précisément ce
                    qui faisait perdre son compte à qui réinstallait l'app. */}
                <View style={styles.tabs}>
                  {(['register', 'login'] as const).map((value) => (
                    <Pressable
                      key={value}
                      onPress={() => setMode(value)}
                      style={[styles.tab, mode === value && styles.tabActive]}
                    >
                      <Text style={[styles.tabText, mode === value && styles.tabTextActive]}>
                        {value === 'register' ? 'Créer un compte' : 'Se connecter'}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {mode === 'register' ? (
                  <>
                    <Text style={styles.fieldLabel}>Prénom ou pseudo</Text>
                    <TextInput
                      value={name}
                      onChangeText={setName}
                      placeholder="user"
                      placeholderTextColor={colors.faint}
                      style={styles.input}
                      autoCapitalize="words"
                      returnKeyType="next"
                    />
                  </>
                ) : null}

                <Text style={[styles.fieldLabel, mode === 'register' && { marginTop: spacing.sm }]}>
                  E-mail{' '}
                  {!API_CONFIGURED ? <Text style={styles.optional}>(facultatif)</Text> : null}
                </Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="user@gmail.com"
                  placeholderTextColor={colors.faint}
                  style={styles.input}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  returnKeyType="next"
                />

                {API_CONFIGURED ? (
                  <>
                    <Text style={[styles.fieldLabel, { marginTop: spacing.sm }]}>Mot de passe</Text>
                    <View style={styles.passwordRow}>
                      <TextInput
                        value={password}
                        onChangeText={setPassword}
                        placeholder={`${MIN_PASSWORD} caractères minimum`}
                        placeholderTextColor={colors.faint}
                        style={[styles.input, { flex: 1 }]}
                        autoCapitalize="none"
                        autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                        secureTextEntry={!showPassword}
                        returnKeyType="done"
                        onSubmitEditing={handleEmail}
                      />
                      <Pressable
                        onPress={() => setShowPassword((v) => !v)}
                        hitSlop={10}
                        style={styles.eye}
                      >
                        <Ionicons
                          name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                          size={19}
                          color={colors.faint}
                        />
                      </Pressable>
                    </View>
                  </>
                ) : null}

                <Pressable onPress={handleEmail} disabled={busy !== null} style={styles.createButton}>
                  {busy === 'email' ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={18} color={colors.white} />
                      <Text style={[styles.authLabel, { color: colors.white }]}>
                        {mode === 'register' ? 'Créer mon profil' : 'Me connecter'}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            </FadeInUp>
          ) : (
            <FadeInUp delay={280}>
              <Pressable onPress={() => setShowForm(true)} style={[styles.authButton, styles.outline]}>
                <Ionicons name="mail-outline" size={19} color={colors.text} />
                <Text style={styles.authLabel}>Continuer avec un e-mail</Text>
              </Pressable>
            </FadeInUp>
          )}

          <FadeInUp delay={330}>
            <Pressable onPress={goNext} style={styles.skip}>
              <Text style={styles.skipText}>
                {route?.params?.returnTo === 'onboarding' ? 'Continuer sans compte' : 'Plus tard'}
              </Text>
            </Pressable>
            {route?.params?.returnTo === 'onboarding' ? (
              <Text style={styles.skipHint}>
                Sans compte, tes données restent sur ce téléphone uniquement.
              </Text>
            ) : null}
          </FadeInUp>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: spacing.lg, justifyContent: 'center' },
  icon: {
    width: 76, height: 76, borderRadius: radius.lg, alignSelf: 'center',
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
  title: { ...font.h1, color: colors.text, textAlign: 'center' },
  subtitle: {
    ...font.body, color: colors.subtext, textAlign: 'center',
    marginTop: spacing.sm, paddingHorizontal: spacing.sm, lineHeight: 21,
  },
  buttons: { marginTop: spacing.xl },
  authButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 16, borderRadius: radius.pill, marginBottom: spacing.sm,
  },
  appleButton: { backgroundColor: colors.black },
  googleButton: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.cardBorder },
  outline: { backgroundColor: colors.card },
  // Un fournisseur non disponible reste visible mais visiblement en retrait :
  // l'appui explique pourquoi, plutôt que de ne rien faire.
  dimmed: { opacity: 0.55 },
  authLabel: { ...font.bodyBold, fontSize: 15, color: colors.text },

  separatorRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginVertical: spacing.sm,
  },
  separator: { flex: 1, height: 1, backgroundColor: colors.cardBorder },
  separatorText: { ...font.tiny, color: colors.faint },

  form: { marginBottom: spacing.sm },
  tabs: {
    flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.pill,
    padding: 4, marginBottom: spacing.md,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: radius.pill, alignItems: 'center' },
  tabActive: { backgroundColor: colors.brand },
  tabText: { ...font.caption, fontWeight: '700', color: colors.subtext },
  tabTextActive: { color: colors.white },

  fieldLabel: { ...font.tiny, color: colors.faint, textTransform: 'uppercase', marginBottom: 5 },
  optional: { color: colors.faint, textTransform: 'none' },
  input: {
    backgroundColor: colors.card, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 14,
    ...font.body, color: colors.text,
    borderWidth: 1, borderColor: colors.cardBorder,
  },
  passwordRow: { flexDirection: 'row', alignItems: 'center' },
  eye: { position: 'absolute', right: spacing.md },
  createButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.brand, borderRadius: radius.pill,
    paddingVertical: 16, marginTop: spacing.md,
  },
  skip: { alignItems: 'center', paddingVertical: spacing.sm },
  skipText: { ...font.caption, color: colors.faint, fontWeight: '600' },
  skipHint: {
    ...font.tiny, fontWeight: '500', color: colors.faint,
    textAlign: 'center', marginTop: -spacing.xs,
  },
});
