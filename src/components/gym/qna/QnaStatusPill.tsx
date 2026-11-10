import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C, R } from '../../../theme';

// 2026-11-09: Q&A '답변 대기' / '답변 완료' 표시
// Text에 둥근 배경·overflow를 직접 주면 iOS에서 글자가 통째로 잘려 빈칸만 남아서 View로 감싼다.

export default function QnaStatusPill({ done, long }: { done: boolean; long?: boolean }) {
  return (
    <View style={[s.pill, done && s.pillDone]}>
      <Text style={[s.text, done && s.textDone]}>
        {done ? (long ? '트레이너 답변 완료' : '답변 완료') : '답변 대기'}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  pill:     { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.pill, backgroundColor: C.surfaceHigh },
  pillDone: { backgroundColor: C.accent },
  text:     { color: C.textSub, fontSize: 10, fontWeight: '800' },
  textDone: { color: C.bg },
});
