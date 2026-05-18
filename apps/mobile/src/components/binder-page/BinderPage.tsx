import { type FC } from "react";
import { View } from "react-native";
import {SLOTS_PER_BINDER_PAGE} from "@src/utils/pageMath";
import CardPocket from "@src/components/card-pocket/CardPocket";
import { Card } from "@my-binder/core";
import useStyles from "./BinderPage.theme";

type BinderPageProps = {
  pageIndex: number,
  cards: Card[]
  isLoading: boolean

}

const BinderPage: FC<BinderPageProps> = ({pageIndex, isLoading, cards}) => {
  const styles = useStyles()

  return (
    <View key={pageIndex} style={styles.grid} testID={`binder-page-${pageIndex + 1}`}>
    { Array.from({ length: SLOTS_PER_BINDER_PAGE }).map((_, slot) =>
      <CardPocket slotIndex={slot} isLoading={isLoading} card={cards[slot]} />
    )}
  </View>
  )
}

export default BinderPage
