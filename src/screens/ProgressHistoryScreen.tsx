import React, { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { FadeInUp } from '../components/FadeInUp';
import { ScreenHeader } from '../components/ScreenHeader';
import { EmptyIllustration } from '../components/EmptyIllustration';
import { useUser } from '../context/UserContext';
import { muscleLabel } from '../data/muscleGroups';
import {
  HistoryEntry,
  ProgressStatus,
  compareAnalyses,
  loadHistory,
  nextCheckInDate,
} from '../services/analysisHistory';
import { colors, spacing, radius, font } from '../theme/colors';

const STATUS_META: Record<ProgressStatus, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  amelioration: { label: 'Amélioration', color: colors.success, icon: 'trending-up' },
  stable: { label: 'Stable', color: colors.subtext, icon: 'remove' },
  a_travailler: { label: 'À poursuivre', color: colors.danger, icon: 'trending-down' },
};

function formatDate(at: number): string {
  return new Date(at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function daysBetween(a: number, b: number): number {
  return Math.round(Math.abs(a - b) / (24 * 60 * 60 * 1000));
}

/**
 * Historique des analyses corporelles et suivi de la progression.
 *
 * Chaque entrée (sauf la première, qui sert de référence) est comparée à
 * l'analyse précédente, zone par zone : amélioration, stabilité, ou besoin de
 * poursuivre l'effort. Rien de tout cela n'est réinventé par l'IA à chaque
 * lecture — c'est une comparaison déterministe entre deux mesures déjà
 * enregistrées, donc toujours cohérente d'un affichage à l'autre.
 */
export function ProgressHistoryScreen({ navigation }: any) {
  const { user } = useUser();
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);

  useEffect(() => {
    let alive = true;
    loadHistory(user?.id).then((h) => {
      if (alive) setHistory(h);
    });
    return () => {
      alive = false;
    };
  }, [user?.id]);

  if (history === null) return null;

  if (history.length === 0) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Ma progression" onBack={() => navigation.goBack()} />
        <View style={styles.empty}>
          <EmptyIllustration kind="body" width={150} color={colors.brand} />
          <Text style={styles.emptyTitle}>Aucun suivi pour le moment</Text>
          <Text style={styles.emptyText}>
            Lance une analyse corporelle pour commencer à suivre ta progression dans le temps.
          </Text>
          <Pressable onPress={() => navigation.navigate('PhotoCapture')} style={styles.emptyButton}>
            <Ionicons name="camera" size={16} color={colors.white} />
            <Text style={styles.emptyButtonText}>Lancer une analyse</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const latest = history[0];
  const nextCheckIn = nextCheckInDate(latest.date);
  const daysUntilNext = Math.ceil((nextCheckIn - Date.now()) / (24 * 60 * 60 * 1000));

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader
        title="Ma progression"
        subtitle={`${history.length} analyse${history.length > 1 ? 's' : ''} enregistrée${history.length > 1 ? 's' : ''}`}
        onBack={() => navigation.goBack()}
      />

      {/* Prochain rendez-vous de suivi */}
      <Card style={styles.nextCard}>
        <View style={styles.nextIcon}>
          <Ionicons name="calendar" size={18} color={colors.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.nextTitle}>
            {daysUntilNext > 0
              ? `Prochain suivi dans ${daysUntilNext} jour${daysUntilNext > 1 ? 's' : ''}`
              : 'Ton suivi est prêt'}
          </Text>
          <Text style={styles.nextText}>
            {daysUntilNext > 0
              ? `Recommandé le ${formatDate(nextCheckIn)}, dans les mêmes conditions de prise de vue.`
              : 'Reprends une photo dans les mêmes conditions pour comparer ton évolution.'}
          </Text>
        </View>
        {daysUntilNext <= 0 ? (
          <Pressable onPress={() => navigation.navigate('PhotoCapture')} style={styles.nextButton}>
            <Ionicons name="camera" size={16} color={colors.white} />
          </Pressable>
        ) : null}
      </Card>

      {history.map((entry, i) => {
        const previous = history[i + 1];
        const progress = previous ? compareAnalyses(previous, entry) : null;
        const improved = progress?.filter((p) => p.status === 'amelioration').length ?? 0;
        const needsWork = progress?.filter((p) => p.status === 'a_travailler').length ?? 0;

        return (
          <FadeInUp key={entry.id} delay={i * 50}>
            <Card style={styles.entryCard}>
              <View style={styles.entryHeader}>
                {entry.photoUri ? (
                  <Image source={{ uri: entry.photoUri }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, { backgroundColor: colors.card }]} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.entryDate}>{formatDate(entry.date)}</Text>
                  <Text style={styles.entryMeta}>
                    {entry.problems.length} problème{entry.problems.length > 1 ? 's' : ''} prioritaire
                    {entry.problems.length > 1 ? 's' : ''}
                    {i === history.length - 1 ? ' · analyse de référence' : ''}
                  </Text>
                  {previous ? (
                    <Text style={styles.entrySpan}>{daysBetween(entry.date, previous.date)} jours depuis la précédente</Text>
                  ) : null}
                </View>
              </View>

              {progress && progress.length > 0 ? (
                <>
                  <View style={styles.summaryRow}>
                    {improved > 0 ? (
                      <View style={[styles.summaryChip, { backgroundColor: `${colors.success}14` }]}>
                        <Ionicons name="trending-up" size={12} color={colors.success} />
                        <Text style={[styles.summaryChipText, { color: colors.success }]}>{improved} amélioration{improved > 1 ? 's' : ''}</Text>
                      </View>
                    ) : null}
                    {needsWork > 0 ? (
                      <View style={[styles.summaryChip, { backgroundColor: `${colors.danger}14` }]}>
                        <Ionicons name="trending-down" size={12} color={colors.danger} />
                        <Text style={[styles.summaryChipText, { color: colors.danger }]}>{needsWork} à poursuivre</Text>
                      </View>
                    ) : null}
                  </View>

                  {progress.map((p) => {
                    const meta = STATUS_META[p.status];
                    return (
                      <View key={p.muscleGroup} style={styles.zoneRow}>
                        <Ionicons name={meta.icon} size={14} color={meta.color} />
                        <Text style={styles.zoneLabel}>{muscleLabel(p.muscleGroup)}</Text>
                        <Text style={[styles.zoneStatus, { color: meta.color }]}>
                          {p.isResolved
                            ? 'Résolu'
                            : p.isNew
                              ? 'Nouveau'
                              : p.previousSeverity !== undefined && p.currentSeverity !== undefined
                                ? `${p.previousSeverity} → ${p.currentSeverity}`
                                : meta.label}
                        </Text>
                      </View>
                    );
                  })}
                </>
              ) : (
                <View style={styles.problemsList}>
                  {entry.problems.map((p) => (
                    <View key={p.muscleGroup} style={styles.zoneRow}>
                      <Ionicons name="alert-circle-outline" size={14} color={colors.danger} />
                      <Text style={styles.zoneLabel}>{muscleLabel(p.muscleGroup)}</Text>
                      {p.severityScore ? (
                        <Text style={styles.zoneStatus}>{p.severityScore}/10</Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              )}
            </Card>
          </FadeInUp>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({

  container: { flex: 1, backgroundColor: colors.bgSoft, padding: spacing.lg },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  emptyTitle: { ...font.h3, color: colors.text, marginTop: spacing.md },
  emptyText: { ...font.caption, color: colors.subtext, textAlign: 'center', paddingHorizontal: spacing.lg, lineHeight: 19 },
  emptyButton: {
    flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: spacing.md,
    backgroundColor: colors.brand, paddingHorizontal: spacing.lg, paddingVertical: 12, borderRadius: radius.pill,
  },
  emptyButtonText: { ...font.caption, fontWeight: '700', color: colors.white },

  nextCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  nextIcon: {
    width: 38, height: 38, borderRadius: 13, backgroundColor: `${colors.brand}14`,
    alignItems: 'center', justifyContent: 'center',
  },
  nextTitle: { ...font.bodyBold, fontSize: 14, color: colors.text },
  nextText: { ...font.tiny, fontWeight: '500', color: colors.subtext, marginTop: 2, lineHeight: 15 },
  nextButton: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: colors.brand,
    alignItems: 'center', justifyContent: 'center',
  },

  entryCard: { marginBottom: spacing.sm },
  entryHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  thumb: { width: 52, height: 52, borderRadius: radius.md },
  entryDate: { ...font.h3, fontSize: 15, color: colors.text },
  entryMeta: { ...font.tiny, fontWeight: '500', color: colors.subtext, marginTop: 1 },
  entrySpan: { ...font.tiny, fontSize: 10, color: colors.faint, marginTop: 1 },

  summaryRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm },
  summaryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill,
  },
  summaryChipText: { ...font.tiny, fontSize: 10, fontWeight: '700' },

  problemsList: { gap: 2 },
  zoneRow: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.cardBorder,
  },
  zoneLabel: { flex: 1, ...font.caption, color: colors.text },
  zoneStatus: { ...font.tiny, fontWeight: '700', color: colors.subtext },
});
