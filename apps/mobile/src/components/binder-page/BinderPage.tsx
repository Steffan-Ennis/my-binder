import { type FC, useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import { SLOTS_PER_BINDER_PAGE, computeSlotSize, type SlotSize } from "@src/utils/pageMath";
import CardPocket, {CardPocketProps} from "@src/components/card-pocket/CardPocket";
import { Spacing } from "@src/constants/theme";
import useStyles from "./BinderPage.theme";

// 3×3 layout constants. The card aspect matches a standard MTG card (5:7); the
// gap is shared with the grid style so the measured fit and the rendered gutters
// agree exactly.
const COLS = 3;
const ROWS = 3;
const GRID_GAP = Spacing.xs;
const CARD_ASPECT = 5 / 7;

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
  // Measured grid box. Pockets are sized off this so the 3×3 fits the viewport on
  // both axes (the previous width-only `32%` sizing overflowed wide screens).
  const [box, setBox] = useState<SlotSize>({ width: 0, height: 0 });

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBox((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  };

  const slot = computeSlotSize(box, {
    cols: COLS,
    rows: ROWS,
    gap: GRID_GAP,
    aspect: CARD_ASPECT,
  });

  // Pin the block to exactly three columns. `flexWrap` alone would pack more than
  // three narrow cards per row on a wide/short viewport; constraining the block
  // width to 3 cards + 2 gaps forces a true 3×3, then `styles.grid` centres it.
  const blockWidth = slot.width * COLS + GRID_GAP * (COLS - 1);

  return (
    <View onLayout={handleLayout} style={styles.grid} testID={`binder-page-${pageIndex + 1}`}>
      <View style={[styles.block, { width: blockWidth }]}>
        { Array.from({ length: SLOTS_PER_BINDER_PAGE }).map((_, slotIdx) =>
          <CardPocket key={slotIdx} slotIndex={slotIdx} isLoading={isLoading} card={cards[slotIdx]} size={slot} onPress={onCardPress} />
        )}
      </View>
    </View>
  )
}

export default BinderPage
