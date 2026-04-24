import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../../theme';

interface Props {
  onBack: () => void;
}

export default function VerifyScreen({ onBack }: Props) {
  return (
    <View style={s.container}>
      <View style={s.iconRing}>
        <Ionicons name="mail-unread-outline" size={36} color={C.accent} />
      </View>

      <Text style={s.title}>Check your email</Text>
      <Text style={s.body}>
        We sent a verification link to your email address.{'\n\n'}
        Please confirm your email before signing in.
      </Text>

      <TouchableOpacity style={s.btn} activeOpacity={0.85} onPress={onBack}>
        <Text style={s.btnText}>Back to Sign In</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },

  iconRing: {
    width:           88,
    height:          88,
    borderRadius:    44,
    backgroundColor: C.accentBg,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    28,
  },

  title: {
    fontSize:    26,
    fontWeight:  '900',
    color:       C.text,
    letterSpacing: -0.5,
    marginBottom: 16,
    textAlign:   'center',
  },
  body: {
    fontSize:    14,
    color:       C.textSub,
    lineHeight:  22,
    textAlign:   'center',
    marginBottom: 40,
  },

  btn: {
    alignSelf:         'stretch',
    backgroundColor:   C.surface,
    borderRadius:      R.btn,
    paddingVertical:   16,
    alignItems:        'center',
    borderWidth:       1.5,
    borderColor:       C.border,
  },
  btnText: { fontSize: 15, fontWeight: '700', color: C.text },
});
