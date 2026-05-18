import { Ionicons } from '@expo/vector-icons';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Colors } from '@src/constants/theme';

import useStyles from './CatalogueFilterSheetView.theme';
import {
  COLOR_OPTIONS,
  CREATURE_TYPE_OPTIONS,
  FORMAT_OPTIONS,
  SUB_TYPE_OPTIONS,
  SUPER_TYPE_OPTIONS,
  type CatalogueFilterSheetViewProps,
  type ChipDimension,
  type ColorChip,
} from './types';

const SNAP_POINTS = ['78%'];

const Chip: FC<{
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}> = ({ label, selected, onPress, testID }) => {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
      hitSlop={4}
      testID={testID}
    >
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
        {label}
      </Text>
    </Pressable>
  );
};

const ColorChipPill: FC<{
  value: ColorChip;
  selected: boolean;
  onPress: () => void;
}> = ({ value, selected, onPress }) => {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Colour ${value}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.colorChip, selected && styles.colorChipSelected]}
      hitSlop={4}
      testID={`color-chip-${value}`}
    >
      <Text style={styles.colorChipLabel}>{value}</Text>
    </Pressable>
  );
};

const IOSToggle: FC<{ value: boolean; onPress: () => void }> = ({ value, onPress }) => {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={onPress}
      style={[styles.toggleTrack, value && styles.toggleTrackOn]}
      hitSlop={4}
      testID="missing-only-toggle"
    >
      <View
        style={[
          styles.toggleThumb,
          value && { alignSelf: 'flex-end' as const },
        ]}
      />
    </Pressable>
  );
};

const Section: FC<{
  label: string;
  options: ReadonlyArray<string>;
  selected: ReadonlyArray<string>;
  onToggle: (value: string) => void;
  testID: string;
}> = ({ label, options, selected, onToggle, testID }) => {
  const styles = useStyles();
  return (
    <View style={styles.section} testID={testID}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map((option) => (
          <Chip
            key={option}
            label={option}
            selected={selected.includes(option)}
            onPress={() => onToggle(option)}
            testID={`${testID}-chip-${option}`}
          />
        ))}
      </View>
    </View>
  );
};

const CatalogueFilterSheetView: FC<CatalogueFilterSheetViewProps> = ({
  open,
  draft,
  onToggleChip,
  onToggleColor,
  onSetCmcRange,
  onToggleMissingOnly,
  onApply,
  onClearAll,
  onClose,
}) => {
  const styles = useStyles();
  const sheetRef = useRef<BottomSheetModal>(null);

  useEffect(() => {
    if (open) sheetRef.current?.present();
    else sheetRef.current?.dismiss();
  }, [open]);

  const makeChipToggle = useCallback(
    (dimension: ChipDimension) => (value: string) => onToggleChip(dimension, value),
    [onToggleChip],
  );

  const toggleSet = useMemo(() => makeChipToggle('sets'), [makeChipToggle]);
  const toggleFormat = useMemo(() => makeChipToggle('formats'), [makeChipToggle]);
  const toggleSuperType = useMemo(() => makeChipToggle('superTypes'), [makeChipToggle]);
  const toggleSubType = useMemo(() => makeChipToggle('subTypes'), [makeChipToggle]);
  const toggleCreatureType = useMemo(
    () => makeChipToggle('creatureTypes'),
    [makeChipToggle],
  );

  const onChangeMin = useCallback(
    (text: string) => {
      const n = Number.parseInt(text, 10);
      onSetCmcRange(Number.isFinite(n) ? n : 0, draft.cmcMax);
    },
    [draft.cmcMax, onSetCmcRange],
  );
  const onChangeMax = useCallback(
    (text: string) => {
      const n = Number.parseInt(text, 10);
      onSetCmcRange(draft.cmcMin, Number.isFinite(n) ? n : 0);
    },
    [draft.cmcMin, onSetCmcRange],
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={SNAP_POINTS}
      backdropComponent={(props) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          onPress={onClose}
        />
      )}
      onDismiss={onClose}
    >
      <BottomSheetScrollView>
        <View style={styles.container} testID="catalogue-filter-sheet">
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Refine catalogue</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close filter sheet"
              onPress={onClose}
              style={styles.closeButton}
              hitSlop={8}
            >
              <Ionicons name="close" size={22} color={Colors.dark.accentSoft} />
            </Pressable>
          </View>

          <View style={styles.toggleRow} testID="missing-only-row">
            <View style={styles.toggleLabelGroup}>
              <Text style={styles.toggleLabel}>Missing only</Text>
              <Text style={styles.toggleHelper}>
                Only show printings you don’t already own.
              </Text>
            </View>
            <IOSToggle value={draft.missingOnly} onPress={onToggleMissingOnly} />
          </View>

          <Section
            label="SET"
            options={draft.sets}
            selected={draft.sets}
            onToggle={toggleSet}
            testID="filter-section-sets"
          />
          <Section
            label="FORMAT LEGALITY"
            options={FORMAT_OPTIONS}
            selected={draft.formats}
            onToggle={toggleFormat}
            testID="filter-section-formats"
          />
          <Section
            label="CARD SUPER TYPE"
            options={SUPER_TYPE_OPTIONS}
            selected={draft.superTypes}
            onToggle={toggleSuperType}
            testID="filter-section-super-types"
          />
          <Section
            label="CARD SUB TYPE"
            options={SUB_TYPE_OPTIONS}
            selected={draft.subTypes}
            onToggle={toggleSubType}
            testID="filter-section-sub-types"
          />
          <Section
            label="CREATURE TYPE"
            options={CREATURE_TYPE_OPTIONS}
            selected={draft.creatureTypes}
            onToggle={toggleCreatureType}
            testID="filter-section-creature-types"
          />

          <View style={styles.section} testID="filter-section-cmc">
            <Text style={styles.sectionLabel}>CMC RANGE</Text>
            <View style={styles.cmcRow}>
              <TextInput
                accessibilityLabel="Minimum mana value"
                value={String(draft.cmcMin)}
                onChangeText={onChangeMin}
                keyboardType="number-pad"
                style={styles.cmcInput}
                testID="cmc-min-input"
              />
              <Text style={styles.cmcSeparator}>—</Text>
              <TextInput
                accessibilityLabel="Maximum mana value"
                value={String(draft.cmcMax)}
                onChangeText={onChangeMax}
                keyboardType="number-pad"
                style={styles.cmcInput}
                testID="cmc-max-input"
              />
            </View>
          </View>

          <View style={styles.section} testID="filter-section-colors">
            <Text style={styles.sectionLabel}>COLOUR IDENTITY</Text>
            <View style={styles.chipRow}>
              {COLOR_OPTIONS.map((color) => (
                <ColorChipPill
                  key={color}
                  value={color}
                  selected={draft.colors.includes(color)}
                  onPress={() => onToggleColor(color)}
                />
              ))}
            </View>
          </View>

          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear all filters"
              onPress={onClearAll}
              style={styles.ghostButton}
              hitSlop={4}
              testID="filter-clear-all"
            >
              <Text style={styles.ghostButtonLabel}>Clear all</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Apply filters"
              onPress={onApply}
              style={styles.primaryButton}
              hitSlop={4}
              testID="filter-apply"
            >
              <Text style={styles.primaryButtonLabel}>Apply</Text>
            </Pressable>
          </View>
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
};

export default CatalogueFilterSheetView;
