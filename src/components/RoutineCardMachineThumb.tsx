import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';

interface Props {
  uri: string;
}

/**
 * 루틴카드(운동 기록 요약)에서 쓰는 64×64 머신 썸네일.
 * expo-image의 memory-disk 캐시를 타므로, 같은 화면 안에서 미리보기/공유용
 * 캡처 뷰가 동일한 machine-images URL을 참조해도 최초 1회만 네트워크 요청이
 * 발생하고 이후에는 캐시에서 재사용된다.
 */
export default function RoutineCardMachineThumb({ uri }: Props) {
  return (
    <View style={s.box}>
      <Image
        source={{ uri }}
        style={s.image}
        contentFit="contain"
        cachePolicy="memory-disk"
      />
    </View>
  );
}

const s = StyleSheet.create({
  box: {
    width:           64,
    height:          64,
    borderRadius:    10,
    overflow:        'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth:     1,
    borderColor:     '#E5E5E5',
  },
  image: { width: '100%', height: '100%' },
});
