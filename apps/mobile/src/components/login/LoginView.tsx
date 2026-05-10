import { Ionicons } from '@expo/vector-icons';
import type { FC } from 'react';
import { Pressable, Text, View } from 'react-native';

import IconLarge from '@src/components/icons/IconLarge';

import useStyles from './LoginView.theme';

export type LoginViewProps = {
  isSigningIn: boolean;
  errorMessage: string | null;
  onSignInPress: () => void;
};

const LoginView: FC<LoginViewProps> = ({ isSigningIn, errorMessage, onSignInPress }) => {
  const styles = useStyles();
  return (
    <View style={styles.root}>
      <View style={styles.mast}>
        <View style={styles.glyph}>
          <IconLarge />
        </View>
        <Text style={styles.title}>My-Binder</Text>
        <Text style={styles.subtitle}>Digital Card Assistant</Text>
      </View>
      <View style={styles.buttonContainer}>
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
};

export default LoginView;
export { LoginView };
