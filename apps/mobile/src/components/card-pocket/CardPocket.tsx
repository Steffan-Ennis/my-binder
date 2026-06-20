import type {FC} from "react";
import useStyles from "./CardPocket.theme";
import { Card as CardSlot} from "@src/components/card";
import { Pressable, View } from "react-native";
import type { Card } from "@my-binder/core";
import type { SlotSize } from "@src/utils/pageMath";

export type CardPocketProps = {
  card?: Pick<Card, 'id'>,
  slotIndex: number,
  isLoading: boolean,
  // Concrete pocket footprint computed by `BinderPage` from the measured grid box.
  // Applied identically to the empty, loading, and occupied branches so every
  // pocket on the page shares one footprint and the 3×3 stays even.
  size: SlotSize,
  // Spec 020 — fired with the printing id when a *populated* pocket is tapped.
  // Empty / loading pockets never receive it, so they never open the sheet
  // (Edge Case "Tap during page load").
  onPress?: (printingId: string) => void,
}

const CardPocket: FC<CardPocketProps> = ({ card, isLoading, slotIndex, size, onPress }) => {
  const styles = useStyles();
  if (!isLoading && card) {
    const slot = <CardSlot key={card.id} id={card.id} footprint="pocket" />;
    if (!onPress) return <View style={[styles.pocket, size]}>{slot}</View>;
    return (
      <Pressable
        style={[styles.pocket, size]}
        accessibilityRole="button"
        accessibilityLabel="Open card details"
        onPress={() => onPress(card.id)}
        testID={`pocket-press-${card.id}`}
      >
        {slot}
      </Pressable>
    );
  }
  return (
    <View
      key={slotIndex}
      style={[styles.pocket, styles.pocketEmpty, size]}
      testID="pocket-empty"
    />
  );
};

export default CardPocket
