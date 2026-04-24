import { Gym } from './types';

export const GYMS: Gym[] = [
  {
    id: 'g01',
    name: 'IronHub Fitness',
    location: 'Gangnam-gu, Seoul',
    description:
      'Premium strength training facility with top-tier equipment, dedicated lifting platforms, and expert coaching staff.',
    machineIds: ['m01', 'm02', 'm03', 'm04', 'm05', 'm20'],
  },
  {
    id: 'g02',
    name: 'PulseZone Gym',
    location: 'Mapo-gu, Seoul',
    description:
      'High-energy cardio and HIIT-focused gym packed with the latest functional and conditioning equipment.',
    machineIds: ['m07', 'm08', 'm09', 'm10', 'm11'],
  },
  {
    id: 'g03',
    name: 'CoreForge Studio',
    location: 'Yongsan-gu, Seoul',
    description:
      'Boutique studio specialising in core training, pilates-inspired machines, and functional mobility work.',
    machineIds: ['m01', 'm16', 'm17', 'm18', 'm19', 'm21'],
  },
  {
    id: 'g04',
    name: 'MaxLift Arena',
    location: 'Songpa-gu, Seoul',
    description:
      'Spacious powerlifting and bodybuilding gym with a full free-weight section and competition-grade bars.',
    machineIds: ['m01', 'm04', 'm05', 'm06', 'm12', 'm13', 'm20'],
  },
  {
    id: 'g05',
    name: 'FlexPoint Club',
    location: 'Seodaemun-gu, Seoul',
    description:
      'All-round community gym with a wide variety of machines and classes catering to every fitness level.',
    machineIds: ['m01', 'm02', 'm04', 'm07', 'm08', 'm22', 'm23'],
  },
  {
    id: 'g06',
    name: 'Apex Performance',
    location: 'Seocho-gu, Seoul',
    description:
      'Athletic performance centre built for sport-specific conditioning, Olympic lifting, and CrossFit training.',
    machineIds: ['m01', 'm10', 'm11', 'm12', 'm14', 'm15'],
  },
  {
    id: 'g07',
    name: 'Momentum Fitness',
    location: 'Nowon-gu, Seoul',
    description:
      'Neighbourhood gym offering solid strength equipment, open floor space, and affordable memberships.',
    machineIds: ['m03', 'm06', 'm12', 'm13', 'm20', 'm21'],
  },
  {
    id: 'g08',
    name: 'UrbanSweat Gym',
    location: 'Jongno-gu, Seoul',
    description:
      'Modern multi-purpose gym combining cardio decks, strength zones, and recovery facilities under one roof.',
    machineIds: ['m02', 'm07', 'm09', 'm16', 'm17', 'm20', 'm22'],
  },
];
