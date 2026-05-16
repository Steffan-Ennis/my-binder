import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useRef, type FC } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';

import { Colors } from '@src/constants/theme';

import useStyles from './CardView.theme';
import type { CardViewProps } from './types';

const PULSE_MIN = 0.6;
const PULSE_MAX = 1.0;
const PULSE_DURATION_MS = 600;

const CardView: FC<CardViewProps> = ({ state, footprint }) => {
  const styles = useStyles();
  const pulse = useRef(new Animated.Value(PULSE_MIN)).current;

  useEffect(() => {
    if (state.kind !== 'loading') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: PULSE_MAX,
          duration: PULSE_DURATION_MS,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: PULSE_MIN,
          duration: PULSE_DURATION_MS,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, state.kind]);

  if (state.kind === 'loading') {
    return (
      <View style={styles.root} testID="card-loading">
        <View style={styles.frame}>
          <Animated.View style={[styles.skeleton, { opacity: pulse }]} />
        </View>
      </View>
    );
  }

  if (state.kind === 'loaded') {
    const occupiedTestID = footprint === 'pocket' ? 'pocket-occupied' : undefined;
    return (
      <View style={styles.root} testID="card-loaded">
        {occupiedTestID ? <View testID={occupiedTestID} /> : null}
        <Image source={{ uri: state.imageUrl }} style={styles.image} />
      </View>
    );
  }

  if (state.kind === 'notFound') {
    return (
      <View style={styles.root} testID="card-not-found">
        <View style={styles.frame}>
          <Ionicons name="help-circle-outline" size={24} color={Colors.dark.textOnAccent} />
          <Text style={styles.fallbackCaption}>Card not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root} testID="card-error">
      <View style={styles.frame}>
        <Ionicons name="warning-outline" size={24} color={Colors.dark.textOnAccent} />
        <Text style={styles.fallbackCaption}>Couldn’t load</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry loading card"
          onPress={state.onRetry}
          style={styles.retryButton}
          testID="card-retry"
        >
          <Text style={styles.retryLabel}>Retry</Text>
        </Pressable>
      </View>
    </View>
  );
};

export default CardView;
