import { type FC } from "react";
import { View } from "react-native";
import {SLOTS_PER_BINDER_PAGE} from "@src/utils/pageMath";
import CardPocket, {CardPocketProps} from "@src/components/card-pocket/CardPocket";
import useStyles from "./BinderPage.theme";

type BinderPageProps = {
  pageIndex: number,
  cards: CardPocketProps['card'][]
  isLoading: boolean,
  // Spec 020 — threaded to each occupied pocket so a tap opens the detail sheet
  // for that printing (FR-001). Optional so existing callers (and the loading
  // placeholder page) stay press-free.
  onCardPress?: (printingId: string) => void,
}

const BinderPage: FC<BinderPageProps> = ({pageIndex, isLoading, cards, onCardPress}) => {
  const styles = useStyles()

  return (
    <View key={pageIndex} style={styles.grid} testID={`binder-page-${pageIndex + 1}`}>
    { Array.from({ length: SLOTS_PER_BINDER_PAGE }).map((_, slot) =>
      <CardPocket key={slot} slotIndex={slot} isLoading={isLoading} card={cards[slot]} onPress={onCardPress} />
    )}
  </View>
  )
}

export default BinderPage
