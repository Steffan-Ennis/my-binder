import type {FC} from "react";
import useStyles from "./CardPocket.theme";
import { Card as CardSlot} from "@src/components/card";
import { View } from "react-native";
import type { Card } from "@my-binder/core";

export type CardPocketProps = {
  card?: Card,
  slotIndex: number,
  isLoading: boolean
}

const CardPocket: FC<CardPocketProps> = ({ card, isLoading, slotIndex }) => {
  const styles = useStyles();
  if (!isLoading && card) {
    return <CardSlot key={card.id} id={card.id} footprint="pocket" />;
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
