import type { FC } from 'react';
import { Pressable, Text, View } from 'react-native';
import PagerView, { type PagerViewProps } from 'react-native-pager-view';

import { Card as CardSlot } from '@src/components/card';
import Masthead from '@src/components/masthead/Masthead';
import { SLOTS_PER_BINDER_PAGE } from '@src/utils/pageMath';

import useStyles from './CatalogueView.theme';
import type { CatalogueViewProps } from './types';

const RING_COUNT = 3;
const SEARCH_PLACEHOLDER = 'Search the catalogue';

const CatalogueView: FC<CatalogueViewProps> = ({
  pages,
  currentPage,
  totalPages,
  summaryCaption,
  hasNextPage,
  isLoading,
  isError,
  isSearchActive,
  searchQuery,
  hasActiveQuery,
  onSearchOpen,
  onSearchChange,
  onSearchClose,
  onProfilePress,
  onPagerSelected,
  onRetryPress,
}) => {
  const styles = useStyles();

  // FR-013 — open-ended uses the trailing word "many" in place of M.
  const indicator =
    totalPages === null || hasNextPage
      ? `${currentPage} of many`
      : `${currentPage} of ${totalPages}`;

  const handlePageSelected: Required<PagerViewProps>['onPageSelected'] = (event) => {
    onPagerSelected(event.nativeEvent.position + 1);
  };

  return (
    <View style={styles.root} testID="catalogue-root">
      <Masthead
        subtitle="Catalogue"
        searchPlaceholder={SEARCH_PLACEHOLDER}
        isSearchActive={isSearchActive}
        searchQuery={searchQuery}
        hasActiveQuery={hasActiveQuery}
        onSearchOpen={onSearchOpen}
        onSearchChange={onSearchChange}
        onSearchClose={onSearchClose}
        onProfilePress={onProfilePress}
      />

      <View style={styles.canvas}>
        <Text style={styles.summaryCaption}>{summaryCaption}</Text>

        <View style={styles.binderPage} testID="catalogue-page-surface">
          <View style={styles.ringColumn} pointerEvents="none">
            {Array.from({ length: RING_COUNT }).map((_, i) => (
              <View key={i} style={styles.ring} testID="catalogue-page-ring" />
            ))}
          </View>

          {isError ? (
            <View style={styles.errorState}>
              <Text style={styles.errorMessage}>
                We couldn’t load the catalogue.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retry loading the catalogue"
                onPress={onRetryPress}
                style={styles.retryButton}
              >
                <Text style={styles.retryLabel}>Retry</Text>
              </Pressable>
            </View>
          ) : isLoading || pages.length === 0 ? (
            <View style={styles.grid}>
              {Array.from({ length: SLOTS_PER_BINDER_PAGE }).map((_, slot) => (
                <View
                  key={slot}
                  style={[styles.pocket, styles.pocketSkeleton]}
                  testID="catalogue-skeleton-pocket"
                />
              ))}
            </View>
          ) : (
            <PagerView
              style={styles.pager}
              testID="catalogue-pager"
              offscreenPageLimit={1}
              onPageSelected={handlePageSelected}
            >
              {pages.map((page) => (
                <View
                  key={page.pageNumber}
                  style={styles.grid}
                  testID={`catalogue-page-${page.pageNumber}`}
                >
                  {Array.from({ length: SLOTS_PER_BINDER_PAGE }).map((_, slot) => {
                    const card = page.cards[slot];
                    if (card === undefined) {
                      return (
                        <View
                          key={slot}
                          style={[styles.pocket, styles.pocketEmpty]}
                          testID="catalogue-pocket-empty"
                        />
                      );
                    }
                    return (
                      <CardSlot
                        key={card.id}
                        id={card.id}
                        footprint="pocket"
                      />
                    );
                  })}
                </View>
              ))}
            </PagerView>
          )}
        </View>

        <View style={styles.pageNavigator}>
          <Text style={styles.pageOf} testID="catalogue-page-indicator">
            {indicator}
          </Text>
        </View>
      </View>
    </View>
  );
};

export default CatalogueView;
