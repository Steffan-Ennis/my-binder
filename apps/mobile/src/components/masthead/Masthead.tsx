import { Ionicons } from '@expo/vector-icons';
import type { FC } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { IconSmall } from '@src/components/icons/IconSmall';
import { Colors } from '@src/constants/theme';

import useStyles from './Masthead.theme';
import type { MastheadProps } from './types';

const Masthead: FC<MastheadProps> = ({
  subtitle,
  searchPlaceholder,
  isSearchActive,
  searchQuery,
  hasActiveQuery,
  onSearchOpen,
  onSearchChange,
  onSearchClose,
  onProfilePress,
  filterPills,
}) => {
  const styles = useStyles();
  const searchButtonLabel = `Search the ${subtitle.toLowerCase()}`;

  return (
    <View style={styles.root} testID="masthead-root">
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
              accessibilityLabel={searchPlaceholder}
              autoFocus
              value={searchQuery}
              onChangeText={onSearchChange}
              placeholder={searchPlaceholder}
              placeholderTextColor={Colors.dark.textMuted}
              style={styles.searchInput}
            />
            {hasActiveQuery ? (
              <View
                style={styles.activeIndicator}
                testID="search-active-indicator"
              />
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close search"
              onPress={onSearchClose}
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
                <Text style={styles.subtitle}>{subtitle}</Text>
              </View>
            </View>
            <View style={styles.headerActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={searchButtonLabel}
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
      {filterPills ? <View style={styles.filterPillSlot}>{filterPills}</View> : null}
    </View>
  );
};

export default Masthead;
