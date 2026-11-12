// Placeholder photos for the signed-out screens (see assets/onboarding/README.md).

// Metro turns each require into an asset id (a number), which expo-image takes as a source.
export const onboardingPhotos = {
  morning: require('../../../assets/onboarding/morning.jpg') as number,
  ootd: require('../../../assets/onboarding/ootd.jpg') as number,
  evening: require('../../../assets/onboarding/evening.jpg') as number,
  selfie: require('../../../assets/onboarding/selfie.jpg') as number,
  food: require('../../../assets/onboarding/food.jpg') as number,
  whereami: require('../../../assets/onboarding/whereami.jpg') as number,
  afternoon: require('../../../assets/onboarding/afternoon.jpg') as number,
  whoamiwith: require('../../../assets/onboarding/whoamiwith.jpg') as number,
  busy: require('../../../assets/onboarding/busy.jpg') as number,
};
export type OnboardingPhoto = keyof typeof onboardingPhotos;
