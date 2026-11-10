import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { C, R } from '../../../theme';
import { timeAgo } from '../../../lib/timeAgo';
import { memberDisplayName, type GymMemberRequestRow, type GymMemberRow } from '../../../lib/db/gymMembers';

// 2026-11-09: 관장님 회원 관리 — 가입 신청 줄 / 회원 줄

// 2026-11-09: '닉네임 · 가입 이름' (예전엔 닉네임이 없으면 '회원'으로만 보였음)
function NameLine({ item }: { item: { nickname: string | null; realName: string | null } }) {
  const { primary, secondary } = memberDisplayName(item);
  return (
    <Text style={s.name} numberOfLines={1}>
      {primary}{secondary ? <Text style={s.sub}>  {secondary}</Text> : null}
    </Text>
  );
}

export function MemberRequestItem({ item, busy, onApprove, onReject }: {
  item: GymMemberRequestRow;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <View style={s.row}>
      <View style={{ flex: 1 }}>
        <NameLine item={item} />
        <Text style={s.meta}>{timeAgo(item.createdAt)} 신청</Text>
      </View>
      <TouchableOpacity style={[s.smallBtn, s.rejectBtn]} onPress={onReject} disabled={busy} activeOpacity={0.8}>
        <Text style={s.rejectText}>거절</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[s.smallBtn, s.approveBtn]} onPress={onApprove} disabled={busy} activeOpacity={0.8}>
        <Text style={s.approveText}>승인</Text>
      </TouchableOpacity>
    </View>
  );
}

export function MemberItem({ item, onRemove }: { item: GymMemberRow; onRemove: () => void }) {
  return (
    <View style={s.row}>
      <View style={{ flex: 1 }}>
        <NameLine item={item} />
        <Text style={s.meta}>{item.joinedVia === 'code' ? 'QR·코드' : '가입 신청'} · {timeAgo(item.joinedAt)} 가입</Text>
      </View>
      <TouchableOpacity onPress={onRemove} hitSlop={8} activeOpacity={0.7}>
        <Text style={s.removeText}>내보내기</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  row:         { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  name:        { color: C.text, fontSize: 15, fontWeight: '700' },
  meta:        { color: C.textSub, fontSize: 12, marginTop: 2 },
  sub:         { color: C.textSub, fontSize: 13, fontWeight: '500' },
  smallBtn:    { paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.pill },
  approveBtn:  { backgroundColor: C.accent },
  approveText: { color: C.bg, fontWeight: '800', fontSize: 13 },
  rejectBtn:   { backgroundColor: C.surfaceHigh, borderWidth: 1, borderColor: C.border },
  rejectText:  { color: C.textSub, fontWeight: '700', fontSize: 13 },
  removeText:  { color: C.danger, fontSize: 13, fontWeight: '600' },
});
