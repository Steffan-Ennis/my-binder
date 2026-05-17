import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { type FC } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';

import { Colors } from '@src/constants/theme';

import useStyles from './CardView.theme';
import type { CardViewProps } from './types';


const CardView: FC<CardViewProps> = ({ onRetry, isLoading, imageUrl, isSuccess, error, pulseRef}) => {
  const styles = useStyles();

  if (isLoading) {
    return (
      <View style={styles.root} testID="card-loading">
        <View style={styles.frame}>
          <Animated.View style={[styles.skeleton, { opacity: pulseRef.current }]} />
        </View>
      </View>
    );
  }

  if (isSuccess) {
    return (
      <View style={styles.root} testID="card-loaded">
        <View testID={'pocket-occupied'} />
        <Image source={{ uri: imageUrl}} style={styles.image} />
      </View>
    );
  }

  if (error?.status === 404) {
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
          onPress={onRetry}
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
