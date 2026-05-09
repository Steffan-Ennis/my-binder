import { Ionicons } from '@expo/vector-icons';
import type { FC } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Touch, Type } from '@src/constants/theme';

export type LoginViewProps = {
  isSigningIn: boolean;
  errorMessage: string | null;
  onSignInPress: () => void;
};

const LoginView: FC<LoginViewProps> = ({ isSigningIn, errorMessage, onSignInPress }) => (
  <View style={styles.root}>
    <View style={styles.mast}>
      <Text style={styles.overline}>ULTRA · ESTABLISHED · 1972</Text>
      <View style={styles.glyph}>
        <Ionicons name="albums" size={56} color={Colors.dark.accent} />
      </View>
      <Text style={styles.title}>Collectors Album</Text>
      <Text style={styles.subtitle}>digital edition</Text>
    </View>

    <View style={styles.cta}>
      {errorMessage ? (
        <Text style={styles.error} accessibilityRole="alert">
          {errorMessage}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sign in with Google"
        accessibilityState={{ disabled: isSigningIn, busy: isSigningIn }}
        disabled={isSigningIn}
        onPress={onSignInPress}
        style={({ pressed }) => [
          styles.button,
          pressed && !isSigningIn ? styles.buttonPressed : null,
          isSigningIn ? styles.buttonDisabled : null,
        ]}
      >
        <Text style={styles.buttonLabel}>Sign in with Google</Text>
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
  mast: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  overline: {
    color: Colors.dark.accent,
    fontFamily: Type.overline.font,
    fontSize: Type.overline.size,
    lineHeight: Type.overline.lineHeight,
    letterSpacing: Type.overline.letterSpacing,
    fontWeight: Type.overline.weight,
  },
  glyph: {
    marginTop: Spacing.lg,
  },
  title: {
    color: Colors.dark.accent,
    fontFamily: Type.display.font,
    fontSize: Type.display.size,
    lineHeight: Type.display.lineHeight,
    fontWeight: Type.display.weight,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  subtitle: {
    color: Colors.dark.text,
    fontFamily: Type.subtitleItalic.font,
    fontSize: Type.subtitleItalic.size,
    lineHeight: Type.subtitleItalic.lineHeight,
    fontStyle: 'italic',
  },
  cta: {
    gap: Spacing.md,
  },
  error: {
    color: Colors.dark.error,
    fontFamily: Type.caption.font,
    fontSize: Type.caption.size,
    lineHeight: Type.caption.lineHeight,
    textAlign: 'center',
  },
  button: {
    backgroundColor: Colors.light.background,
    height: Touch.buttonHeight,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonLabel: {
    color: Colors.light.text,
    fontFamily: Type.bodyStrong.font,
    fontSize: Type.bodyStrong.size,
    lineHeight: Type.bodyStrong.lineHeight,
    fontWeight: Type.bodyStrong.weight,
  },
});

export default LoginView;
export { LoginView };
