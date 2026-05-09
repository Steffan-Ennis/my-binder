import { Ionicons } from '@expo/vector-icons';
import type { FC } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing, Type } from '@src/constants/theme';

import type { ComingSoonResult } from './useComingSoon';

export type ComingSoonViewProps = {
  title: string;
  message: string;
  iconName: ComingSoonResult['iconName'];
};

const ComingSoonView: FC<ComingSoonViewProps> = ({ title, message, iconName }) => (
  <View style={styles.root} accessibilityRole="summary" accessibilityLabel={`${title} — coming soon`}>
    <Ionicons name={iconName} size={64} color={Colors.dark.accent} />
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.body}>{message}</Text>
  </View>
);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  title: {
    color: Colors.dark.text,
    fontFamily: Type.title.font,
    fontSize: Type.title.size,
    lineHeight: Type.title.lineHeight,
    fontWeight: Type.title.weight,
  },
  body: {
    color: Colors.dark.textMuted,
    fontFamily: Type.body.font,
    fontSize: Type.body.size,
    lineHeight: Type.body.lineHeight,
    textAlign: 'center',
  },
});

export default ComingSoonView;
export { ComingSoonView };
