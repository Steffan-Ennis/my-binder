import { useMemo } from 'react';

export type ComingSoonFeature = 'search' | 'scan' | 'profile';

export type ComingSoonResult = {
  title: string;
  message: string;
  iconName: 'search' | 'scan-outline' | 'person-circle-outline';
};

const COPY: Record<ComingSoonFeature, ComingSoonResult> = {
  search: {
    title: 'Search',
    message: 'Browse the catalogue and price index. Coming soon.',
    iconName: 'search',
  },
  scan: {
    title: 'Scan',
    message: 'Add cards to your binder by scanning them with the camera. Coming soon.',
    iconName: 'scan-outline',
  },
  profile: {
    title: 'Profile',
    message: 'Account, sharing, and binder settings live here. Coming soon.',
    iconName: 'person-circle-outline',
  },
};

/**
 * Resolve the wireframe-aligned title/message/icon for an upcoming-feature placeholder tab.
 *
 * @param input - the `feature` to resolve
 * @returns `{ title, message, iconName }` matched to the v3 wireframe
 * @throws Error when the feature is not one of the known values
 *
 * @example
 *   const { title, message, iconName } = useComingSoon({ feature: 'scan' });
 */
export const useComingSoon = (input: { feature: ComingSoonFeature }): ComingSoonResult => {
  return useMemo(() =>{
    const comingSoonDetails = COPY[input.feature];
    if (!comingSoonDetails) {
      throw new Error(`useComingSoon: unrecognised feature "${input.feature}"`);
    }

    return comingSoonDetails
  }, [input.feature])
};
