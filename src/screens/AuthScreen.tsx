import React, { useState } from 'react';
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
import { googleBlocker, signInWithGoogle } from '../services/socialAuth';
import { colors, spacing, radius, font, gradients } from '../theme/colors';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthScreen({ navigation, route }: any) {
  const { signIn } = useUser();

  const [busy, setBusy] = useState<'google' | 'email' | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  // L'écran sert à deux endroits : pendant l'inscription (on continue vers la
  // suite) et depuis l'onglet Profil (on revient d'où l'on vient).
  const goNext = () => {
    if (route?.params?.returnTo === 'back' && navigation.canGoBack()) navigation.goBack();
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
      await signIn({ ...profile, provider: 'google' });
      goNext();
    } catch (err) {
      Alert.alert('Connexion Google échouée', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const handleEmail = async () => {
    const cleanName = name.trim();
    const cleanEmail = email.trim();
    if (cleanName.length < 2) {
      Alert.alert('Nom manquant', 'Indique au moins ton prénom pour créer ton profil.');
      return;
    }
    if (cleanEmail && !EMAIL_RE.test(cleanEmail)) {
      Alert.alert('E-mail invalide', "Vérifie l'adresse saisie, ou laisse le champ vide.");
      return;
    }
    setBusy('email');
    try {
      await signIn({ name: cleanName, email: cleanEmail || undefined, provider: 'email' });
      goNext();
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
          <Text style={styles.title}>Crée ton profil</Text>
          <Text style={styles.subtitle}>
            Tes réponses, ton analyse corporelle et ton programme seront rattachés à ce profil et
            conservés sur ton téléphone.
          </Text>
        </FadeInUp>

        <View style={styles.buttons}>
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

          {/* Création directe : fonctionne partout, tout de suite, sans dépendre
              d'un fournisseur externe ni d'une configuration. */}
          {showForm ? (
            <FadeInUp>
              <View style={styles.form}>
                <Text style={styles.fieldLabel}>Prénom ou pseudo</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Youssef"
                  placeholderTextColor={colors.faint}
                  style={styles.input}
                  autoCapitalize="words"
                  returnKeyType="next"
                />

                <Text style={[styles.fieldLabel, { marginTop: spacing.sm }]}>
                  E-mail <Text style={styles.optional}>(facultatif)</Text>
                </Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="ton@email.com"
                  placeholderTextColor={colors.faint}
                  style={styles.input}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  returnKeyType="done"
                  onSubmitEditing={handleEmail}
                />

                <Pressable
                  onPress={handleEmail}
                  disabled={busy !== null}
                  style={styles.createButton}
                >
                  {busy === 'email' ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={18} color={colors.white} />
                      <Text style={[styles.authLabel, { color: colors.white }]}>
                        Créer mon profil
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            </FadeInUp>
          ) : (
            <FadeInUp delay={280}>
              <Pressable onPress={() => setShowForm(true)} style={[styles.authButton, styles.outline]}>
                <Ionicons name="create-outline" size={19} color={colors.text} />
                <Text style={styles.authLabel}>Créer mon profil avec un e-mail</Text>
              </Pressable>
            </FadeInUp>
          )}

          <FadeInUp delay={330}>
            <Pressable onPress={goNext} style={styles.skip}>
              <Text style={styles.skipText}>Plus tard</Text>
            </Pressable>
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
  fieldLabel: { ...font.tiny, color: colors.faint, textTransform: 'uppercase', marginBottom: 5 },
  optional: { color: colors.faint, textTransform: 'none' },
  input: {
    backgroundColor: colors.card, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 14,
    ...font.body, color: colors.text,
    borderWidth: 1, borderColor: colors.cardBorder,
  },
  createButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.brand, borderRadius: radius.pill,
    paddingVertical: 16, marginTop: spacing.md,
  },
  skip: { alignItems: 'center', paddingVertical: spacing.sm },
  skipText: { ...font.caption, color: colors.faint, fontWeight: '600' },
});
