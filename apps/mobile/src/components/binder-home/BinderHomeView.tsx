import { Ionicons } from '@expo/vector-icons';
import type { Card } from '@my-binder/core';
import { Image } from 'expo-image';
import type { FC } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import PagerView, {PagerViewProps} from 'react-native-pager-view';

import { Colors, Radius, Spacing, Touch, Type } from '@src/constants/theme';
import { SLOTS_PER_BINDER_PAGE } from '@src/utils/pageMath';

const RING_COUNT = 3;
const TRANSLUCENT_BUTTON_BG = 'rgba(0,0,0,0.32)';

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

const renderPocket = (card: Card | undefined, slotIndex: number, isLoading: boolean) => {
  if (!isLoading && card?.frontFaceImageUrl) {
    return (
      <View key={slotIndex} style={styles.pocket} testID="pocket-occupied">
        <Image
          source={{ uri: card.frontFaceImageUrl }}
          style={styles.pocketImage}
          contentFit="cover"
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
              <Ionicons
                name="albums"
                size={28}
                color={Colors.dark.accent}
                style={styles.mastheadIcon}
              />
              <View style={styles.mastheadText}>
                <Text style={styles.overline}>MY-BINDER</Text>
                <Text style={styles.title}>My Binder</Text>
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
                renderPocket(undefined, slot, true),
              )}
            </View>
          ) : (
            <PagerView
              style={styles.pager}
              testID="binder-pager"
              initialPage={currentPage - 1}
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
                      renderPocket(pageCards[slot], slot, false),
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  headerBar: {
    backgroundColor: Colors.dark.background,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mastheadGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  mastheadIcon: {
    marginRight: Spacing.sm,
  },
  mastheadText: {
    flexShrink: 1,
  },
  overline: {
    fontFamily: Type.overline.font,
    fontSize: Type.overline.size,
    lineHeight: Type.overline.lineHeight,
    letterSpacing: Type.overline.letterSpacing,
    color: Colors.dark.accent,
    fontWeight: Type.overline.weight,
  },
  title: {
    fontFamily: Type.subtitleItalic.font,
    fontSize: Type.subtitleItalic.size,
    lineHeight: Type.subtitleItalic.lineHeight,
    fontStyle: 'italic',
    color: Colors.dark.text,
    fontWeight: Type.subtitleItalic.weight,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  iconButton: {
    width: Touch.minTarget,
    height: Touch.minTarget,
    borderRadius: Radius.pill,
    backgroundColor: TRANSLUCENT_BUTTON_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvas: {
    flex: 1,
    backgroundColor: Colors.dark.tabBarBackground,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  summaryCaption: {
    fontFamily: Type.overline.font,
    fontSize: Type.overline.size,
    lineHeight: Type.overline.lineHeight,
    letterSpacing: Type.overline.letterSpacing,
    color: Colors.dark.textOnAccent,
    textAlign: 'center',
    marginBottom: Spacing.md,
    fontWeight: Type.overline.weight,
  },
  binderPage: {
    flex: 1,
    backgroundColor: Colors.dark.surfaceInverted,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    paddingLeft: Spacing.xxl,
  },
  ringColumn: {
    position: 'absolute',
    left: Spacing.xs,
    top: 0,
    bottom: 0,
    justifyContent: 'space-around',
    paddingVertical: Spacing.xxxl,
  },
  ring: {
    width: Spacing.sm,
    height: Spacing.sm,
    borderRadius: Radius.pill,
    backgroundColor: Colors.dark.border,
  },
  grid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignContent: 'space-between',
  },
  pocket: {
    width: '32%',
    aspectRatio: 5 / 7,
    borderRadius: Radius.md,
    overflow: 'hidden',
    marginBottom: Spacing.xs,
  },
  pocketEmpty: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.dark.pocketEmpty,
    backgroundColor: 'transparent',
  },
  pocketImage: {
    width: '100%',
    height: '100%',
  },
  errorState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  errorMessage: {
    fontFamily: Type.body.font,
    fontSize: Type.body.size,
    lineHeight: Type.body.lineHeight,
    color: Colors.dark.textOnAccent,
    textAlign: 'center',
  },
  retryButton: {
    minHeight: Touch.minTarget,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.pill,
    backgroundColor: Colors.dark.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryLabel: {
    fontFamily: Type.bodyStrong.font,
    fontSize: Type.bodyStrong.size,
    color: Colors.dark.accent,
    fontWeight: Type.bodyStrong.weight,
  },
  pageNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.md,
  },
  pillButton: {
    width: Touch.buttonHeight,
    height: Touch.buttonHeight,
    borderRadius: Radius.pill,
    backgroundColor: Colors.dark.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillButtonDisabled: {
    opacity: 0.4,
  },
  pager: {
    flex: 1,
  },
  pageNumber: {
    fontFamily: Type.subtitleItalic.font,
    fontSize: Type.subtitleItalic.size,
    lineHeight: Type.subtitleItalic.lineHeight,
    fontStyle: 'italic',
    color: Colors.dark.textOnAccent,
    fontWeight: Type.subtitleItalic.weight,
  },
  pageOf: {
    fontFamily: Type.overline.font,
    fontSize: Type.overline.size,
    lineHeight: Type.overline.lineHeight,
    letterSpacing: Type.overline.letterSpacing,
    color: Colors.dark.textMuted,
    fontWeight: Type.overline.weight,
  },
  searchInputRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontFamily: Type.body.font,
    fontSize: Type.body.size,
    color: Colors.dark.text,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  activeIndicator: {
    width: Spacing.xs,
    height: Spacing.xs,
    borderRadius: Radius.pill,
    backgroundColor: Colors.dark.accent,
  },
});

export default BinderHomeView;
