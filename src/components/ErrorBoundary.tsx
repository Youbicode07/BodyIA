import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../theme/colors';

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Filet de sécurité de l'application.
 *
 * Sans lui, une seule erreur de rendu — un champ inattendu renvoyé par l'IA,
 * une photo illisible — fait disparaître toute l'interface : écran rouge en
 * développement, application fermée chez l'utilisateur, sans explication ni
 * moyen de repartir.
 *
 * Ici, l'erreur est contenue : on explique ce qui s'est passé, on donne le
 * détail technique (utile pour corriger), et surtout un bouton pour reprendre
 * sans avoir à tuer l'application.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[BodyAI] Erreur non rattrapée :', error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.container}>
        <View style={styles.icon}>
          <Ionicons name="warning" size={30} color={colors.warning} />
        </View>
        <Text style={styles.title}>Un problème est survenu</Text>
        <Text style={styles.subtitle}>
          L'application a rencontré une erreur inattendue. Tes données enregistrées sont intactes.
        </Text>

        <ScrollView style={styles.detailBox} contentContainerStyle={{ padding: spacing.md }}>
          <Text style={styles.detail}>{error.message || String(error)}</Text>
        </ScrollView>

        <Pressable onPress={this.reset} style={styles.button}>
          <Ionicons name="refresh" size={17} color={colors.white} />
          <Text style={styles.buttonText}>Réessayer</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: colors.bg, padding: spacing.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  icon: {
    width: 66, height: 66, borderRadius: 22, backgroundColor: `${colors.warning}18`,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
  title: { ...font.h1, color: colors.text, textAlign: 'center' },
  subtitle: {
    ...font.body, color: colors.subtext, textAlign: 'center',
    marginTop: spacing.sm, lineHeight: 21,
  },
  detailBox: {
    maxHeight: 160, alignSelf: 'stretch', marginTop: spacing.lg,
    backgroundColor: colors.bgSoft, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.cardBorder,
  },
  detail: { ...font.tiny, fontWeight: '500', color: colors.subtext, lineHeight: 16 },
  button: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.brand, borderRadius: radius.pill,
    paddingVertical: 15, paddingHorizontal: spacing.xl, marginTop: spacing.lg,
  },
  buttonText: { ...font.bodyBold, fontSize: 15, color: colors.white },
});
