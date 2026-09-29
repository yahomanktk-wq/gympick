import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export interface OnboardingSlide {
  icon:  IoniconName;
  title: string;
  body:  string;
  image?: any;
  showManagedBadge?: boolean;
}

export interface ManualSection {
  icon:      IoniconName;
  iconColor: string;
  title:     string;
  body:      string;
}

export const MANAGER_ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    icon: 'happy-outline',
    image: require('../assets/onboarding/welcome.png'),
    title: '환영합니다, 매니저님 👋',
    body: '이제 짐픽에서\n내 헬스장을 직접 운영할 수 있어요.\n\n신청하신 정보로\n등록부터 시작해볼게요.',
  },
  {
    icon: 'barbell-outline',
    image: require('../assets/onboarding/machine.png'),
    title: "'머신'으로 헬스장을 찾아요",
    body: '직접 머신을 등록하고 관리하면\n머신이 바뀌어도 바로 반영할 수 있어요.\n\n등록한 헬스장에는 이 표시가 붙어\n유저가 믿고 볼 수 있어요.',
    showManagedBadge: true,
  },
  {
    icon: 'options-outline',
    image: require('../assets/onboarding/manage.png'),
    title: '이렇게 관리해요',
    body: '· 보유 머신 등록\n  우리 헬스장 머신을 추가해요\n\n· 추천 루틴\n  유저에게 보여줄 운동 루틴을 만들어요\n\n· 공지·요청\n  공지를 올리고 유저 제보를 확인해요',
  },
  {
    icon: 'stats-chart-outline',
    image: require('../assets/onboarding/data.png'),
    title: '데이터로 확인해요',
    body: '어떤 머신이 많이 쓰이는지,\n언제 붐비는지,\n회원이 다시 오는지\n한눈에 볼 수 있어요.',
  },
  {
    icon: 'rocket-outline',
    image: require('../assets/onboarding/start.png'),
    title: '지금 시작해볼까요?',
    body: '프로필 > 헬스장 관리에서\n등록을 완료하고 머신을 추가해보세요.\n\n이 가이드는\n프로필 > 도움말에서 다시 볼 수 있어요.',
  },
];

export const MANAGER_MANUAL_SECTIONS: ManualSection[] = [
  {
    icon: 'person-circle-outline',
    iconColor: '#C6FF00',
    title: '매니저로 할 수 있는 일',
    body: '헬스장 정보 관리, 보유 머신 등록, 추천 루틴 작성, 공지·요청 관리, 이용 통계 확인까지 직접 할 수 있어요.',
  },
  {
    icon: 'business-outline',
    iconColor: '#38bdf8',
    title: '헬스장 등록 완료하기 (최초 1회)',
    body: '먼저 "새 헬스장 등록"과 "기존 헬스장 찾아서 연결 요청" 중 하나를 선택해요. 우리 헬스장이 짐픽에 아직 없다면 새로 등록하고, 이미 등록되어 있다면 검색해서 연결 요청을 보내면 돼요(운영자 승인 후 매니저로 연결). 새로 등록할 경우 매니저 신청 때 낸 헬스장명·기본정보가 채워져 있어요. 위치·전화번호·운영시간을 확인·보완한 뒤 등록을 완료하면 유저에게 노출돼요. 등록 후 정보 수정은 어드민 승인 후 반영돼요.',
  },
  {
    icon: 'barbell-outline',
    iconColor: '#C6FF00',
    title: '보유 머신 등록하기 ★ 가장 중요',
    body: '머신 카드를 탭하면 추가, 다시 탭하면 제거돼요(체크 표시로 확인). 부위·브랜드 필터와 "선택됨" 토글로 빠르게 관리할 수 있어요. 유저가 머신으로 헬스장을 검색하기 때문에 가장 중요한 작업이에요.',
  },
  {
    icon: 'list-outline',
    iconColor: '#a78bfa',
    title: '추천 루틴 만들기',
    body: '보유 머신으로 루틴을 구성하면, 유저가 운동을 기록할 때 "헬스장 추천 루틴"으로 참고해요. 부위별로 만들어두면 좋아요.',
  },
  {
    icon: 'megaphone-outline',
    iconColor: '#ffb547',
    title: '공지사항 작성',
    body: '휴무, 이벤트, 신규 머신 입고 등을 유저에게 안내할 수 있어요.',
  },
  {
    icon: 'flag-outline',
    iconColor: '#ff7eb3',
    title: '요청·제보 확인',
    body: '유저가 보낸 정보 오류 제보와 등록 요청을 확인하고 처리할 수 있어요.',
  },
  {
    icon: 'stats-chart-outline',
    iconColor: '#5ba4ff',
    title: '이용 통계 보기',
    body: '헬스장 카드의 "이용 통계"에서 확인할 수 있어요: 머신별 이용 횟수, 기간별 추이, 부위별 인기 머신 TOP 10, 시간대·요일 피크, 머신 활성화율, 회원 리텐션, 머신별 평균 세트·무게.',
  },
  {
    icon: 'help-circle-outline',
    iconColor: '#34d399',
    title: '자주 묻는 질문',
    body: 'Q. 정보를 수정했는데 왜 바로 안 바뀌나요?\nA. 어드민 승인 대기 중이에요.\n\nQ. 머신이 목록에 없어요.\nA. 제보/문의로 추가 요청할 수 있어요.\n\nQ. 여러 헬스장을 관리할 수 있나요?\nA. 한 계정당 한 헬스장이에요.',
  },
];
