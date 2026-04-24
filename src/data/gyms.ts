import { Gym } from './types';

// --- Gym core entity data
// Machine inventory lives in GYM_MACHINES (gymMachines.ts), not here.

const BASE_GYMS: Gym[] = [
  {
    id: 'g01',
    name: 'IronHub Fitness',
    location: '서울시 강남구',
    description:
      '최고급 장비와 전담 리프팅 플랫폼, 전문 코칭 스태프를 갖춘 프리미엄 스트렝스 트레이닝 센터입니다.',
  },
  {
    id: 'g02',
    name: 'PulseZone Gym',
    location: '서울시 마포구',
    description:
      '최신 기능성 장비를 갖추고 유산소·HIIT 중심 프로그램을 운영하는 활기찬 피트니스 센터입니다.',
  },
  {
    id: 'g03',
    name: 'CoreForge Studio',
    location: '서울시 용산구',
    description:
      '코어 트레이닝, 필라테스 기반 머신, 기능성 유연성 운동에 특화된 부티크 스튜디오입니다.',
  },
  {
    id: 'g04',
    name: 'MaxLift Arena',
    location: '서울시 송파구',
    description:
      '풀 프리웨이트 구역과 대회 수준의 바벨을 갖춘 파워리프팅·보디빌딩 전문 대형 헬스장입니다.',
  },
  {
    id: 'g05',
    name: 'FlexPoint Club',
    location: '서울시 서대문구',
    description:
      '다양한 머신과 클래스를 갖춰 모든 수준의 회원이 편리하게 이용할 수 있는 커뮤니티 헬스장입니다.',
  },
  {
    id: 'g06',
    name: 'Apex Performance',
    location: '서울시 서초구',
    description:
      '스포츠 특화 컨디셔닝, 올림픽 리프팅, 크로스핏 트레이닝을 위한 애슬레틱 퍼포먼스 센터입니다.',
  },
  {
    id: 'g07',
    name: 'Momentum Fitness',
    location: '서울시 노원구',
    description:
      '충분한 스트렝스 장비와 넓은 운동 공간, 합리적인 회원권을 제공하는 동네 밀착형 헬스장입니다.',
  },
  {
    id: 'g08',
    name: 'UrbanSweat Gym',
    location: '서울시 종로구',
    description:
      '유산소, 스트렝스, 회복 시설을 한 공간에 갖춘 현대적인 멀티 퍼포즈 헬스장입니다.',
  },
];

export const GYMS: Gym[] = BASE_GYMS;
