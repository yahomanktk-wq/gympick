// analytics.ts
// GymPick 앱 내 어디서든 import { track } from './analytics' 로 호출

import PostHog from 'posthog-react-native';
import { supabase } from './supabase'; // src/lib/supabase.ts (기존 GymPick supabase client)

let posthogClient: PostHog | null = null;

export function initAnalytics() {
  posthogClient = new PostHog(
    'phc_q7mkeegwnDbcnpjy7quGo9iGdeuea6WvRCd27JLtf7DJ', // PostHog 프로젝트 설정에서 확인한 phc_ 로 시작하는 키로 교체 필요
    { host: 'https://us.i.posthog.com' } // 리전에 맞게 (eu면 https://eu.i.posthog.com)
  );
}

/**
 * 핵심 트래킹 함수. 이벤트 발생 지점마다 이거 하나만 호출하면
 * PostHog(빠른 대시보드용)과 Supabase user_events(정밀 쿼리용) 양쪽에 동시 기록됨.
 */
export async function track(eventType: string, props: Record<string, any> = {}) {
  try {
    posthogClient?.capture(eventType, props);
  } catch (err) {
    console.warn('[analytics] PostHog capture failed', err);
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { error } = await supabase.from('user_events').insert({
      user_id: user.id,
      event_type: eventType,
      event_props: props,
    });

    if (error) console.warn('[analytics] Supabase insert failed', error.message);
  } catch (err) {
    console.warn('[analytics] Supabase track failed', err);
  }
}
