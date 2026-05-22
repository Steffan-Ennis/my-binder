import type {FC} from "react";
import useStyles from "./CardPocket.theme";
import { Card as CardSlot} from "@src/components/card";
import { Pressable, View } from "react-native";
import type { Card } from "@my-binder/core";

export type CardPocketProps = {
  card?: Pick<Card, 'id'>,
  slotIndex: number,
  isLoading: boolean,
  // Spec 020 — fired with the printing id when a *populated* pocket is tapped.
  // Empty / loading pockets never receive it, so they never open the sheet
  // (Edge Case "Tap during page load").
  onPress?: (printingId: string) => void,
}

const CardPocket: FC<CardPocketProps> = ({ card, isLoading, slotIndex, onPress }) => {
  const styles = useStyles();
  if (!isLoading && card) {
    const slot = <CardSlot key={card.id} id={card.id} footprint="pocket" />;
    if (!onPress) return slot;
    return (
      <Pressable
        style={{
          width: '30%',
          height: '25%',
        }}
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
      style={[styles.pocket, styles.pocketEmpty]}
      testID="pocket-empty"
    />
  );
};

export default CardPocket
