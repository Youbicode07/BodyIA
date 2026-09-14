import React, { useEffect, useRef } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Animated, View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CoachDashboardScreen } from '../screens/CoachDashboardScreen';
import { BodyHomeScreen } from '../screens/BodyHomeScreen';
import { ProgramScreen } from '../screens/ProgramScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { FollowUpGateScreen } from '../screens/FollowUpGateScreen';
import { useCoach } from '../context/CoachContext';
import { colors, gradients, shadow, font } from '../theme/colors';

const Tab = createBottomTabNavigator();

/**
 * Onglet animé.
 *
 * L'icône passe du contour au plein et se soulève légèrement quand l'onglet
 * devient actif : on sait où l'on est sans avoir à lire l'étiquette. Un point
 * sous l'icône marque l'onglet courant.
 */
function TabItem({
  icon,
  label,
  focused,
}: {
  icon: string;
  label: string;
  focused: boolean;
}) {
  const anim = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: focused ? 1 : 0,
      useNativeDriver: true,
      friction: 7,
      tension: 140,
    }).start();
  }, [focused, anim]);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -2] });
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  return (
    <View style={styles.tabItem}>
      <Animated.View style={{ transform: [{ translateY }, { scale }] }}>
        <Ionicons
          name={(focused ? icon : `${icon}-outline`) as any}
          size={22}
          color={focused ? colors.brand : colors.faint}
        />
      </Animated.View>
      <Text style={[styles.tabLabel, focused && { color: colors.brand }]} numberOfLines={1}>
        {label}
      </Text>
      <Animated.View style={[styles.dot, { opacity: anim, backgroundColor: colors.brand }]} />
    </View>
  );
}

/** Bouton central de scan : l'action principale de l'app, donc au centre. */
function ScanButton() {
  return (
    <LinearGradient
      colors={gradients.brand}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.fab, shadow.floating]}
    >
      <Ionicons name="scan" size={25} color={colors.white} />
    </LinearGradient>
  );
}

export function MainTabs({ navigation }: any) {
  // La barre respecte l'encoche du bas (iPhone) sans forcer de hauteur fixe,
  // qui rognait les libellés sur certains Android.
  const insets = useSafeAreaInsets();
  const { followUpDue, isReady } = useCoach();

  // Le suivi à 15 jours est OBLIGATOIRE : tant qu'il n'est pas honoré,
  // l'application entière est remplacée par l'écran de reprise de photo.
  // Le limiter à l'onglet Corps, comme avant, laissait consulter partout
  // ailleurs un programme calé sur une analyse périmée.
  if (isReady && followUpDue) {
    return <FollowUpGateScreen navigation={navigation} />;
  }

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: [
          styles.tabBar,
          { height: 62 + insets.bottom, paddingBottom: insets.bottom },
        ],
        tabBarItemStyle: { paddingTop: 8 },
      }}
    >
      {/* Ordre : le coach d'abord (progression, prochaine séance), puis le
          corps, le scan au centre, le programme à suivre, le compte en dernier. */}
      <Tab.Screen
        name="Coach"
        component={CoachDashboardScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabItem icon="sparkles" label="Coach" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Corps"
        component={BodyHomeScreen}
        options={{ tabBarIcon: ({ focused }) => <TabItem icon="body" label="Corps" focused={focused} /> }}
      />
      <Tab.Screen
        name="Scanner"
        component={CoachDashboardScreen}
        options={{ tabBarIcon: () => <ScanButton /> }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate('MealCapture');
          },
        }}
      />
      <Tab.Screen
        name="Programme"
        component={ProgramScreen}
        options={{ tabBarIcon: ({ focused }) => <TabItem icon="barbell" label="Programme" focused={focused} /> }}
      />
      <Tab.Screen
        name="Profil"
        component={ProfileScreen}
        options={{ tabBarIcon: ({ focused }) => <TabItem icon="person" label="Profil" focused={focused} /> }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.bg,
    borderTopWidth: 0,
    borderTopColor: colors.cardBorder,
    elevation: 16,
    shadowColor: colors.black,
  },
  // Largeur souple : avec cinq onglets, une largeur fixe débordait sur les
  // petits écrans.
  tabItem: { alignItems: 'center', justifyContent: 'center', gap: 2, width: 62 },
  tabLabel: { ...font.tiny, fontSize: 9.5, color: colors.faint },
  dot: { width: 4, height: 4, borderRadius: 2, marginTop: 1 },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
    borderWidth: 4,
    borderColor: colors.bg,
  },
});
