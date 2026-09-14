export type OnboardingMedia = {
  image: string;
  label: string;
};

export const onboardingMedia: Record<string, OnboardingMedia> = {
  default: {
    image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=85',
    label: 'COACHING EN MOUVEMENT',
  },
  goal: {
    image: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=85',
    label: 'TON OBJECTIF',
  },
  speed: {
    image: 'https://images.unsplash.com/photo-1538805060514-97d9cc17730c?auto=format&fit=crop&w=1200&q=85',
    label: 'PROGRESSION RÉALISTE',
  },
  body: {
    image: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=1200&q=85',
    label: 'ANALYSE DU PROFIL',
  },
};

export function getOnboardingMedia(stepId: string): OnboardingMedia {
  if (stepId === 'goal' || stepId === 'targetWeight' || stepId === 'realisticTarget') return onboardingMedia.goal;
  if (stepId === 'speed') return onboardingMedia.speed;
  if (stepId === 'heightWeight' || stepId === 'birthDate') return onboardingMedia.body;
  return onboardingMedia.default;
}
