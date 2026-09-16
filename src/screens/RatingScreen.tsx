import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GradientButton } from '../components/GradientButton';
import { Card } from '../components/Card';
import { FadeInUp } from '../components/FadeInUp';
import { colors, spacing, radius, font } from '../theme/colors';

const REVIEWS = [
  { name: 'Karim', text: "L'analyse par photo est bluffante, j'ai enfin un programme clair." },
  { name: 'Léa', text: 'Scanner mes repas en 2 secondes a tout changé pour moi.' },
];

export function RatingScreen({ navigation }: any) {
  return (
    /**
     * ScrollView avec flexGrow: 1 plutot qu'une simple View.
     *
     * Le comportement reste identique tant que le contenu tient a l'ecran :
     * les ressorts `flex: 1` continuent de centrer le bloc. Des que le
     * contenu deborde — petit telephone, ou zoom texte systeme active pour
     * l'accessibilite — l'ecran defile au lieu de couper le bouton principal,
     * qui devenait alors inatteignable.
     */
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ flex: 1 }} />

      <FadeInUp>
        <View style={styles.stars}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Ionicons key={i} name="star" size={26} color={colors.carbs} />
          ))}
        </View>
        <Text style={styles.title}>Rejoins des milliers{'\n'}d'utilisateurs</Text>
        <Text style={styles.subtitle}>4,8 sur 5 · plus de 100 000 avis</Text>
      </FadeInUp>

      <View style={styles.reviews}>
        {REVIEWS.map((r, i) => (
          <FadeInUp key={i} delay={140 + i * 90}>
            <Card style={styles.reviewCard}>
              <View style={styles.reviewStars}>
                {[0, 1, 2, 3, 4].map((s) => (
                  <Ionicons key={s} name="star" size={11} color={colors.carbs} />
                ))}
              </View>
              <Text style={styles.reviewText}>« {r.text} »</Text>
              <Text style={styles.reviewName}>{r.name}</Text>
            </Card>
          </FadeInUp>
        ))}
      </View>

      <View style={{ flex: 1 }} />

      <GradientButton label="Continuer" icon="arrow-forward" onPress={() => navigation.navigate('Notifications')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, padding: spacing.lg },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginBottom: spacing.md },
  title: { ...font.h1, color: colors.text, textAlign: 'center' },
  subtitle: { ...font.caption, color: colors.subtext, textAlign: 'center', marginTop: 6 },
  reviews: { marginTop: spacing.xl, gap: spacing.sm },
  reviewCard: { marginBottom: spacing.sm },
  reviewStars: { flexDirection: 'row', gap: 2, marginBottom: 6 },
  reviewText: { ...font.body, color: colors.text, lineHeight: 20, fontStyle: 'italic' },
  reviewName: { ...font.tiny, color: colors.subtext, marginTop: 6 },
});
