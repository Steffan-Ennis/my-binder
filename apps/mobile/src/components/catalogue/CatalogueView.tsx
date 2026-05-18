import { Ionicons } from '@expo/vector-icons';
import type { FC } from 'react';
import { Pressable, Text, View } from 'react-native';
import PagerView, { type PagerViewProps } from 'react-native-pager-view';

import { Card as CardSlot } from '@src/components/card';
import { CatalogueFilterSheetContainer } from '@src/components/catalogue-filter-sheet/CatalogueFilterSheetContainer';
import Masthead from '@src/components/masthead/Masthead';
import { Colors, Radius, Spacing, Type } from '@src/constants/theme';
import { SLOTS_PER_BINDER_PAGE } from '@src/utils/pageMath';

import useStyles from './CatalogueView.theme';
import type { CatalogueFilterPill, CatalogueViewProps } from './types';

const RING_COUNT = 3;
const SEARCH_PLACEHOLDER = 'Search the catalogue';

const FilterPill: FC<{ pill: CatalogueFilterPill; onRemove: (id: string) => void }> = ({
  pill,
  onRemove,
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={`Remove ${pill.label}`}
    onPress={() => onRemove(pill.id)}
    hitSlop={6}
    testID={`filter-pill-${pill.id}`}
    style={{
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xxs,
      borderRadius: Radius.pill,
      backgroundColor: Colors.dark.accent,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xxs,
    }}
  >
    <Text
      style={{
        fontFamily: Type.body.font,
        fontSize: 12,
        color: Colors.dark.textOnAccent,
        fontWeight: Type.bodyStrong.weight,
      }}
    >
      {pill.label}
    </Text>
    <Ionicons name="close" size={14} color={Colors.dark.textOnAccent} />
  </Pressable>
);

const FilterOpenerPill: FC<{ onPress: () => void }> = ({ onPress }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel="Open filters"
    onPress={onPress}
    hitSlop={6}
    testID="filter-opener-pill"
    style={{
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xxs,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: Colors.dark.accentSoft,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xxs,
    }}
  >
    <Ionicons name="options-outline" size={14} color={Colors.dark.accentSoft} />
    <Text
      style={{
        fontFamily: Type.body.font,
        fontSize: 12,
        color: Colors.dark.accentSoft,
        fontWeight: Type.bodyStrong.weight,
      }}
    >
      Filters
    </Text>
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
  filters,
  filterPills,
  filterSheetOpen,
  onSearchOpen,
  onSearchChange,
  onSearchClose,
  onProfilePress,
  onPagerSelected,
  onRetryPress,
  onFilterSheetOpen,
  onFilterSheetClose,
  onFilterApply,
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

  const pillsSlot =
    filterPills.length > 0 || isSearchActive ? (
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: Spacing.xxs,
          paddingHorizontal: Spacing.lg,
          paddingBottom: Spacing.xs,
        }}
        testID="catalogue-filter-pill-row"
      >
        <FilterOpenerPill onPress={onFilterSheetOpen} />
        {filterPills.map((pill) => (
          <FilterPill key={pill.id} pill={pill} onRemove={onFilterPillRemove} />
        ))}
      </View>
    ) : (
      <View
        style={{
          flexDirection: 'row',
          paddingHorizontal: Spacing.lg,
          paddingBottom: Spacing.xs,
        }}
        testID="catalogue-filter-pill-row"
      >
        <FilterOpenerPill onPress={onFilterSheetOpen} />
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

      <CatalogueFilterSheetContainer
        open={filterSheetOpen}
        committed={filters}
        onApply={onFilterApply}
        onClear={onFilterClear}
        onClose={onFilterSheetClose}
      />
    </View>
  );
};

export default CatalogueView;
