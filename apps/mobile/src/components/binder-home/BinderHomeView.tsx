import { Ionicons } from '@expo/vector-icons';
import type { Card } from '@my-binder/core';
import { Image } from 'expo-image';
import type { FC } from 'react';
import {
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import PagerView, {PagerViewProps} from 'react-native-pager-view';

import { Colors } from '@src/constants/theme';
import { SLOTS_PER_BINDER_PAGE } from '@src/utils/pageMath';

import useStyles from './BinderHomeView.theme';
import IconSmall from "@src/components/icons/IconSmall";

const RING_COUNT = 3;

export type BinderHomeViewProps = {
  cards: ReadonlyArray<Card>;
  matchedCards: ReadonlyArray<Card>;
  currentPage: number;
  totalPages: number;
  summaryCaption: string;
  noMatches: boolean;
  isLoading: boolean;
  isError: boolean;
  isSearchActive: boolean;
  searchQuery: string;
  onSearchOpen: () => void;
  onSearchChange: (text: string) => void;
  onSearchClear: () => void;
  onProfilePress: () => void;
  onRetryPress: () => void;
  hasActiveQuery: boolean;
  handlePagerSelected: Required<PagerViewProps>['onPageSelected']
};

export type CardPocketProps = {
  card?: Card,
  slotIndex: number,
  isLoading: boolean
}

const CardPocket: FC<CardPocketProps> = ({ card, isLoading, slotIndex }) => {
  const styles = useStyles();
  if (!isLoading && card?.frontFaceImageUrl) {
    return (
      <View key={card.id} style={styles.pocket} testID="pocket-occupied">
        <Image
          source={{ uri: card.frontFaceImageUrl }}
          style={styles.pocketImage}
        />
      </View>
    );
  }
  return (
    <View
      key={slotIndex}
      style={[styles.pocket, styles.pocketEmpty]}
      testID="pocket-empty"
    />
  );
};

const BinderHomeView: FC<BinderHomeViewProps> = ({
  matchedCards,
  currentPage,
  totalPages,
  summaryCaption,
  noMatches,
  isLoading,
  isError,
  isSearchActive,
  searchQuery,
  onSearchOpen,
  onSearchChange,
  onSearchClear,
  onProfilePress,
  onRetryPress,
  hasActiveQuery,
  handlePagerSelected
}) => {
  const styles = useStyles();
  return (
    <View style={styles.root} testID="binder-home-root">
      <View style={styles.headerBar}>
        {isSearchActive ? (
          <View style={styles.searchInputRow}>
            <Ionicons
              name="search"
              size={20}
              color={Colors.dark.accentSoft}
              style={styles.mastheadIcon}
            />
            <TextInput
              accessibilityLabel="Search this binder"
              autoFocus
              value={searchQuery}
              onChangeText={onSearchChange}
              placeholder="Search this binder"
              placeholderTextColor={Colors.dark.textMuted}
              style={styles.searchInput}
            />
            {hasActiveQuery ? (
              <View
                style={styles.activeIndicator}
                testID="binder-search-active-indicator"
              />
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={onSearchClear}
              style={styles.iconButton}
              hitSlop={8}
            >
              <Ionicons name="close" size={22} color={Colors.dark.accentSoft} />
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.mastheadGroup}>
              <IconSmall />
              <View style={styles.mastheadText}>
                <Text style={styles.overline}>MY-BINDER</Text>
                <Text style={styles.title}>Binder</Text>
              </View>
            </View>
            <View style={styles.headerActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Search the binder"
                onPress={onSearchOpen}
                style={styles.iconButton}
                hitSlop={8}
              >
                <Ionicons name="search" size={22} color={Colors.dark.accentSoft} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open profile"
                onPress={onProfilePress}
                style={styles.iconButton}
                hitSlop={8}
              >
                <Ionicons
                  name="person-circle-outline"
                  size={22}
                  color={Colors.dark.accentSoft}
                />
              </Pressable>
            </View>
          </>
        )}
      </View>

      <View style={styles.canvas}>
        <Text style={styles.summaryCaption}>{summaryCaption}</Text>

        <View style={styles.binderPage} testID="binder-page-surface">
          <View style={styles.ringColumn} pointerEvents="none">
            {Array.from({ length: RING_COUNT }).map((_, i) => (
              <View key={i} style={styles.ring} testID="binder-page-ring" />
            ))}
          </View>

          {isError ? (
            <View style={styles.errorState}>
              <Text style={styles.errorMessage}>
                We couldn’t load your binder.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retry loading binder"
                onPress={onRetryPress}
                style={styles.retryButton}
              >
                <Text style={styles.retryLabel}>Retry</Text>
              </Pressable>
            </View>
          ) : noMatches ? (
            <View style={styles.errorState}>
              <Text style={styles.errorMessage}>no matches in your binder</Text>
            </View>
          ) : isLoading || matchedCards.length === 0 ? (
            <View style={styles.grid}>
              {Array.from({ length: SLOTS_PER_BINDER_PAGE }).map((_, slot) =>
                <CardPocket slotIndex={0} isLoading={true} />,
              )}
            </View>
          ) : (
            <PagerView
              style={styles.pager}
              testID="binder-pager"
              offscreenPageLimit={1}
              onPageSelected={handlePagerSelected}
            >
              {Array.from({ length: totalPages }).map((_, pageIdx) => {
                const start = pageIdx * SLOTS_PER_BINDER_PAGE;
                const pageCards = matchedCards.slice(
                  start,
                  start + SLOTS_PER_BINDER_PAGE,
                );
                return (
                  <View key={pageIdx} style={styles.grid} testID={`binder-page-${pageIdx + 1}`}>
                    {Array.from({ length: SLOTS_PER_BINDER_PAGE }).map((_, slot) =>
                     <CardPocket slotIndex={slot} isLoading={isLoading} card={pageCards[slot]} />
                    )}
                  </View>
                );
              })}
            </PagerView>
          )}
        </View>

        <View style={styles.pageNavigator}>
          <View>
            <Text style={styles.pageOf}>{currentPage} of {totalPages}</Text>
          </View>
        </View>
      </View>

    </View>
  );
};

export default BinderHomeView;
