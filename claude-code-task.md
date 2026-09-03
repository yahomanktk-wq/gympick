# 작업: GymPick에 PostHog + Supabase 이벤트 트래킹 적용

아래 지시를 순서대로 실행해줘.

## 1. 패키지 설치
```
npx expo install posthog-react-native
```

## 2. 새 파일 생성: src/lib/analytics.ts
아래 내용 그대로 새 파일로 만들어줘:

```ts
// analytics.ts
// GymPick 앱 내 어디서든 import { track } from './analytics' 로 호출

import PostHog from 'posthog-react-native';
import { supabase } from './supabase'; // src/lib/supabase.ts (기존 GymPick supabase client)

let posthogClient: PostHog | null = null;

export function initAnalytics() {
  posthogClient = new PostHog(
    'YOUR_POSTHOG_PROJECT_API_KEY', // PostHog 프로젝트 설정에서 확인한 phc_ 로 시작하는 키로 교체 필요
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
```

## 3. App.tsx 수정
- 최상단 import 목록에 다음 줄 추가:
  ```ts
  import { initAnalytics, track } from './src/lib/analytics';
  ```
- `const Stack = createNativeStackNavigator();` 바로 다음 줄에 추가:
  ```ts
  initAnalytics();
  ```
- `export default function App() {` 함수 본문 맨 앞, `return (` 이전에 추가:
  ```tsx
  React.useEffect(() => {
    track('app_open');
  }, []);
  ```

## 4. src/lib/db/workouts.ts 수정
- 파일 최상단 `import { supabase } from '../supabase';` 다음 줄에 추가:
  ```ts
  import { track } from '../analytics';
  ```
- `insertWorkoutSet` 함수 안에서 `if (error || !data) throw new Error(error?.message ?? 'insertWorkoutSet failed');`
  다음 줄, `return rowToSet(data);` 이전에 추가:
  ```ts
  track('log_set', { entry_id: set.entryId, weight: set.weight, reps: set.reps });
  ```

## 5. src/screens/flow/MachineDetailModal.tsx 수정
- import 구역에 다음 줄 추가:
  ```ts
  import { track } from '../../lib/analytics';
  ```
- 컴포넌트 안에 있는 기존 `React.useEffect(() => { if (machine) setIsFav(...) }, [machine?.id]);` 블록 바로 다음에 새 useEffect 추가:
  ```tsx
  React.useEffect(() => {
    if (visible && machine) {
      track('view_machine', { machine_id: machine.id, brand: machine.brand });
    }
  }, [visible, machine?.id]);
  ```

## 6. 확인
- `npx expo start`로 앱 실행
- 기구 상세 화면 진입 시 콘솔에 에러 없이 동작하는지 확인
- PostHog 프로젝트 API 키(`YOUR_POSTHOG_PROJECT_API_KEY`)는 내가 직접 넣을 예정이니, 그 부분은 플레이스홀더로 남겨둬도 됨
