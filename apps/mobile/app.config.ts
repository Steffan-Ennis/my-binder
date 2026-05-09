import type { ExpoConfig } from 'expo/config';

import appJson from './app.json';

type AppJson = { expo: ExpoConfig };

export default (): ExpoConfig => {
  const base = (appJson as AppJson).expo;

  return {
    ...base,

    android: {
      ...base.android,
      package: "com.steffan87.mybinder",
    },
    extra: {
      ...(base.extra ?? {}),
      apiBaseUrl: process.env.API_BASE_URL,
      googleIosClientId: process.env.GOOGLE_IOS_CLIENT_ID,
      googleAndroidClientId: process.env.GOOGLE_ANDROID_CLIENT_ID,
      googleWebClientId: process.env.GOOGLE_WEB_CLIENT_ID,
    },
  } as ExpoConfig;
};
