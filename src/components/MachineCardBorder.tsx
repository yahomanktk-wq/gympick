import React from 'react';
import { View } from 'react-native';

interface Props {
  children:      React.ReactNode;
  borderColor?:  string;
  borderWidth?:  number;
  borderRadius?: number;
  width?:        number;
}

export default function MachineCardBorder({
  children,
  borderColor  = '#000000',
  borderWidth  = 2,
  borderRadius = 16,
  width,
}: Props) {
  return (
    <View style={{ borderColor, borderWidth, borderRadius, width }}>
      {children}
    </View>
  );
}
