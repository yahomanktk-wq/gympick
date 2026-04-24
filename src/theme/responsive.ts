import { Dimensions } from 'react-native';

const W = Dimensions.get('window').width;

export const isSmall  = W <= 360;
export const isLarge  = W >= 415;

/** Button / tap target height */
export const btnHeight    = isSmall ? 48 : isLarge ? 56 : 52;
/** Standard icon size */
export const iconSize     = isSmall ? 20 : isLarge ? 24 : 22;
/** Card horizontal padding */
export const cardPadH     = isSmall ? 12 : 16;
/** Card vertical padding */
export const cardPadV     = isSmall ? 12 : 16;
/** Horizontal screen margin */
export const screenPad    = isSmall ? 12 : 16;
/** Gap between grid items */
export const gridGap      = isSmall ? 8  : isLarge ? 12 : 10;
/** Section label font size */
export const sectionFontSize = isSmall ? 12 : 14;
