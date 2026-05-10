import type { FC } from 'react';
import Svg, { Circle, ClipPath, Defs, G, Rect } from 'react-native-svg';

const IconLarge: FC = () => (
  <Svg width={92} height={92} viewBox="0 0 256 256">
    <Defs>
      <ClipPath id="aboveBinderLogo">
        <Rect x={0} y={0} width={256} height={70} />
      </ClipPath>
    </Defs>

    <G clipPath="url(#aboveBinderLogo)">
      <G transform="rotate(-65, 85, 105)">
        <Rect
          x={85}
          y={25}
          width={50}
          height={80}
          rx={3.5}
          fill="rgba(245,225,180,1.0)"
          stroke="rgba(245,225,180,0.92)"
          strokeWidth={1.5}
        />
        <Rect
          x={88.5}
          y={28.5}
          width={43}
          height={73}
          rx={2}
          fill="rgba(20,10,10,0.4)"
        />
      </G>
      <G transform="rotate(-50, 85, 105)">
        <Rect
          x={85}
          y={25}
          width={50}
          height={80}
          rx={3.5}
          fill="rgba(245,225,180,0.8)"
          stroke="rgba(245,225,180,0.92)"
          strokeWidth={1.5}
        />
        <Rect
          x={88.5}
          y={28.5}
          width={43}
          height={73}
          rx={2}
          fill="rgba(20,10,10,0.4)"
        />
      </G>
      <G transform="rotate(-35, 85, 105)">
        <Rect
          x={85}
          y={25}
          width={50}
          height={80}
          rx={3.5}
          fill="rgba(245,225,180,0.6)"
          stroke="rgba(245,225,180,0.92)"
          strokeWidth={1.5}
        />
        <Rect
          x={88.5}
          y={28.5}
          width={43}
          height={73}
          rx={2}
          fill="rgba(20,10,10,0.4)"
        />
      </G>
    </G>

    <Rect
      x={20}
      y={70}
      width={140}
      height={160}
      rx={6}
      fill="rgba(245,225,180,0.18)"
      stroke="rgba(245,225,180,0.92)"
      strokeWidth={2}
    />
    <Rect x={146} y={70} width={14} height={160} fill="rgba(245,225,180,0.30)" />
    <Circle cx={153} cy={105} r={2.5} fill="rgba(245,225,180,0.92)" />
    <Circle cx={153} cy={150} r={2.5} fill="rgba(245,225,180,0.92)" />
    <Circle cx={153} cy={195} r={2.5} fill="rgba(245,225,180,0.92)" />
    <Rect
      x={35}
      y={180}
      width={100}
      height={35}
      rx={2}
      fill="rgba(245,225,180,0.12)"
      stroke="rgba(245,225,180,0.3)"
      strokeWidth={0.8}
    />
  </Svg>
);

export default IconLarge;
export { IconLarge };
