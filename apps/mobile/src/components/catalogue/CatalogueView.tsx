import { Ionicons } from '@expo/vector-icons';
import type { FC } from 'react';
import { Pressable, Text, View } from 'react-native';
import PagerView, { type PagerViewProps } from 'react-native-pager-view';

import { Card as CardSlot } from '@src/components/card';
import Masthead from '@src/components/masthead/Masthead';
import { SLOTS_PER_BINDER_PAGE } from '@src/utils/pageMath';

import useStyles, { type CatalogueViewStyles } from './CatalogueView.theme';
import type { CatalogueFilterPill, CatalogueViewProps } from './types';

const RING_COUNT = 3;
const SEARCH_PLACEHOLDER = 'Search the catalogue';

const FilterPill: FC<{
  pill: CatalogueFilterPill;
  styles: CatalogueViewStyles;
  onRemove: (id: string) => void;
}> = ({ pill, styles, onRemove }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={`Remove ${pill.label}`}
    onPress={() => onRemove(pill.id)}
    hitSlop={6}
    testID={`filter-pill-${pill.id}`}
    style={styles.filterPill}
  >
    <Text style={styles.filterPillLabel}>{pill.label}</Text>
    <Ionicons name="close" size={14} style={styles.filterPillIcon} />
  </Pressable>
);

const FilterOpenerPill: FC<{
  styles: CatalogueViewStyles;
  onPress: () => void;
}> = ({ styles, onPress }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel="Open filters"
    onPress={onPress}
    hitSlop={6}
    testID="filter-opener-pill"
    style={styles.filterOpenerPill}
  >
    <Ionicons name="options-outline" size={14} style={styles.filterOpenerIcon} />
    <Text style={styles.filterOpenerLabel}>Filters</Text>
  </Pressable>
);

const CatalogueView: FC<CatalogueViewProps> = ({
  pages,
  currentPage,
  totalPages,
  summaryCaption,
  hasNextPage,
  isLoading,
  isError,
  isEmpty,
  isSearchActive,
  searchQuery,
  hasActiveQuery,
  filterPills,
  onSearchOpen,
  onSearchChange,
  onSearchClose,
  onProfilePress,
  onPagerSelected,
  onRetryPress,
  onFilterSheetOpen,
  onFilterClear,
  onFilterPillRemove,
}) => {
  const styles = useStyles();

  const indicator =
    totalPages === null || hasNextPage
      ? `${currentPage} of many`
      : `${currentPage} of ${totalPages}`;

  const handlePageSelected: Required<PagerViewProps>['onPageSelected'] = (event) => {
    onPagerSelected(event.nativeEvent.position + 1);
  };

  const pillRowHasContent = filterPills.length > 0 || isSearchActive;
  const pillsSlot = (
    <View
      style={pillRowHasContent ? styles.filterPillRow : styles.filterPillRowSingle}
      testID="catalogue-filter-pill-row"
    >
      <FilterOpenerPill styles={styles} onPress={onFilterSheetOpen} />
      {filterPills.map((pill) => (
        <FilterPill
          key={pill.id}
          pill={pill}
          styles={styles}
          onRemove={onFilterPillRemove}
        />
      ))}
    </View>
  );

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
        filterPills={pillsSlot}
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
          ) : isEmpty ? (
            <View style={styles.errorState} testID="catalogue-empty-state">
              <Text style={styles.errorMessage}>no cards match these filters</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear filters"
                onPress={onFilterClear}
                style={styles.retryButton}
              >
                <Text style={styles.retryLabel}>Clear filters</Text>
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
