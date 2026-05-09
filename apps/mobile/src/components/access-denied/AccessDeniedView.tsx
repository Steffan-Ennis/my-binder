import type { FC } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Touch, Type } from '@src/constants/theme';

export type AccessDeniedViewProps = {
  contactHref: string;
  onTryDifferentAccount: () => void;
};

const AccessDeniedView: FC<AccessDeniedViewProps> = ({ contactHref, onTryDifferentAccount }) => (
  <View style={styles.root}>
    <View style={styles.copy}>
      <Text style={styles.headline}>Access not yet granted</Text>
      <Text style={styles.body}>
        This Google account isn&apos;t on the my-binder allowlist yet. Reach out below if you
        believe you should have access, or sign in with a different Google account.
      </Text>
    </View>

    <View style={styles.actions}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Contact my-binder support"
        onPress={() => {
          void Linking.openURL(contactHref);
        }}
        style={({ pressed }) => [styles.contact, pressed ? styles.contactPressed : null]}
      >
        <Text style={styles.contactLabel}>Contact</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Try a different Google account"
        onPress={onTryDifferentAccount}
        style={({ pressed }) => [styles.try, pressed ? styles.tryPressed : null]}
      >
        <Text style={styles.tryLabel}>Try a different account</Text>
      </Pressable>
    </View>
  </View>
);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.giant,
    paddingBottom: Spacing.xl,
    justifyContent: 'space-between',
  },
  copy: {
    gap: Spacing.md,
  },
  headline: {
    color: Colors.dark.text,
    fontFamily: Type.title.font,
    fontSize: Type.title.size,
    lineHeight: Type.title.lineHeight,
    fontWeight: Type.title.weight,
    textAlign: 'center',
  },
  body: {
    color: Colors.dark.text,
    fontFamily: Type.body.font,
    fontSize: Type.body.size,
    lineHeight: Type.body.lineHeight,
    textAlign: 'center',
  },
  actions: {
    gap: Spacing.md,
  },
  contact: {
    backgroundColor: Colors.dark.accent,
    height: Touch.buttonHeight,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactPressed: {
    backgroundColor: Colors.dark.accentPressed,
  },
  contactLabel: {
    color: Colors.dark.textOnAccent,
    fontFamily: Type.bodyStrong.font,
    fontSize: Type.bodyStrong.size,
    fontWeight: Type.bodyStrong.weight,
  },
  try: {
    height: Touch.buttonHeight,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: Colors.dark.border,
    borderWidth: 1,
  },
  tryPressed: {
    opacity: 0.75,
  },
  tryLabel: {
    color: Colors.dark.text,
    fontFamily: Type.bodyStrong.font,
    fontSize: Type.bodyStrong.size,
    fontWeight: Type.bodyStrong.weight,
  },
});

export default AccessDeniedView;
export { AccessDeniedView };
