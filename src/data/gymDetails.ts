import { MachineReview } from './types';
import { getMachineReviews } from './machineReviews';

// --- Types

export interface DayHours {
  day:     string;
  hours:   string;
  closed?: boolean;
}

export interface PricingTier {
  label: string;
  price: string;
  note?: string;
}

export interface GymNotice {
  title: string;
  body:  string;
  date:  string;
}

export interface GymDetailData {
  id:      string;
  phone:   string;
  hours:   DayHours[];
  pricing: PricingTier[];
  notices: GymNotice[];
}

export interface MachineComment {
  id:     string;
  user:   string;
  initials: string;
  text:   string;
  date:   string;
  rating: number;
}

// --- Shared comment pool
// Used by MachineDetailModal - cycled by (machineId hash) % pool.length

export const COMMENT_POOL: MachineComment[] = [
  { id: 'c1',  user: 'Daniel K.',  initials: 'DK', rating: 5, date: 'Mar 3, 2026',  text: 'Best machine in the gym. Great range of motion and smooth cable tension throughout.' },
  { id: 'c2',  user: 'Sora Y.',    initials: 'SY', rating: 4, date: 'Feb 28, 2026', text: 'Solid build quality. Wish the seat was a bit more adjustable but does the job perfectly.' },
  { id: 'c3',  user: 'Marcus T.',  initials: 'MT', rating: 5, date: 'Feb 22, 2026', text: 'Really feel the target muscle working. Can\'t imagine training without this now.' },
  { id: 'c4',  user: 'Ji-hyun P.', initials: 'JP', rating: 3, date: 'Feb 18, 2026', text: 'Good machine but the weight stack clicks at the higher end. Still usable though.' },
  { id: 'c5',  user: 'Emma R.',    initials: 'ER', rating: 5, date: 'Feb 12, 2026', text: 'Incredibly smooth. The ergonomics are well-designed — my form improved within a week.' },
  { id: 'c6',  user: 'Noah L.',    initials: 'NL', rating: 4, date: 'Feb 5, 2026',  text: 'Great for isolation work. Always well-maintained at this gym. Highly recommend.' },
  { id: 'c7',  user: 'Minji C.',   initials: 'MC', rating: 5, date: 'Jan 30, 2026', text: 'My go-to machine every leg day. The platform angle is perfect for quad activation.' },
  { id: 'c8',  user: 'Tyler B.',   initials: 'TB', rating: 4, date: 'Jan 25, 2026', text: 'Consistent tension all the way through the rep. No dead spots. Really impressed.' },
];

/**
 * Returns up to 3 comments for a given machine.
 *
 * Priority:
 *  1. If machineReviews.ts has 3+ reviews for this machine, map them to
 *     MachineComment shape and return the first 3 (newest-first).
 *  2. Otherwise fall back to the deterministic COMMENT_POOL slice.
 */
export function getMachineComments(machineId: string): MachineComment[] {
  const reviews: MachineReview[] = getMachineReviews(machineId);
  if (reviews.length >= 3) {
    return reviews.slice(0, 3).map(r => ({
      id:       r.id,
      user:     r.userName,
      initials: r.userInitials,
      text:     r.text,
      date:     r.createdAt,
      rating:   r.rating,
    }));
  }
  // Fallback: deterministic slice from the shared pool
  const seed = machineId.charCodeAt(machineId.length - 1);
  const start = seed % (COMMENT_POOL.length - 2);
  return COMMENT_POOL.slice(start, start + 3);
}

// --- Gym detail data

export const GYM_DETAILS: Record<string, GymDetailData> = {
  g01: {
    id: 'g01',
    phone: '+82 2-555-1001',
    hours: [
      { day: 'Mon', hours: '05:30 – 23:00' },
      { day: 'Tue', hours: '05:30 – 23:00' },
      { day: 'Wed', hours: '05:30 – 23:00' },
      { day: 'Thu', hours: '05:30 – 23:00' },
      { day: 'Fri', hours: '05:30 – 22:00' },
      { day: 'Sat', hours: '07:00 – 20:00' },
      { day: 'Sun', hours: '08:00 – 18:00' },
    ],
    pricing: [
      { label: 'Day Pass',   price: '₩15,000', note: 'Locker included'       },
      { label: '1 Month',    price: '₩89,000',  note: 'Unlimited access'     },
      { label: '3 Months',   price: '₩230,000', note: '≈ ₩76,667/mo'        },
      { label: 'Annual',     price: '₩750,000', note: '≈ ₩62,500/mo'        },
    ],
    notices: [
      { title: 'New Equipment',  body: 'Three new Hammer Strength cable stations added to the free-weight zone this month.', date: 'Mar 1, 2026'  },
      { title: 'Holiday Hours',  body: 'Reduced operating hours during public holidays. Check the front desk for specifics.',  date: 'Feb 15, 2026' },
    ],
  },
  g02: {
    id: 'g02',
    phone: '+82 2-555-1002',
    hours: [
      { day: 'Mon', hours: '06:00 – 22:00' },
      { day: 'Tue', hours: '06:00 – 22:00' },
      { day: 'Wed', hours: '06:00 – 22:00' },
      { day: 'Thu', hours: '06:00 – 22:00' },
      { day: 'Fri', hours: '06:00 – 21:00' },
      { day: 'Sat', hours: '08:00 – 19:00' },
      { day: 'Sun', hours: '09:00 – 17:00' },
    ],
    pricing: [
      { label: 'Day Pass',  price: '₩12,000', note: 'Cardio zone only'   },
      { label: '1 Month',   price: '₩79,000',  note: 'Full access'       },
      { label: '3 Months',  price: '₩200,000', note: '≈ ₩66,667/mo'     },
      { label: 'Annual',    price: '₩680,000', note: '≈ ₩56,667/mo'     },
    ],
    notices: [
      { title: 'HIIT Class Schedule', body: 'New morning HIIT classes added Mon, Wed, Fri at 07:00. Booking opens 48 h before.', date: 'Feb 20, 2026' },
    ],
  },
  g03: {
    id: 'g03',
    phone: '+82 2-555-1003',
    hours: [
      { day: 'Mon', hours: '07:00 – 21:00' },
      { day: 'Tue', hours: '07:00 – 21:00' },
      { day: 'Wed', hours: '07:00 – 21:00' },
      { day: 'Thu', hours: '07:00 – 21:00' },
      { day: 'Fri', hours: '07:00 – 20:00' },
      { day: 'Sat', hours: '09:00 – 18:00' },
      { day: 'Sun', hours: '10:00 – 16:00', closed: true },
    ],
    pricing: [
      { label: 'Single Session', price: '₩20,000', note: 'Studio access'   },
      { label: '10 Sessions',    price: '₩170,000', note: '₩17,000 each'   },
      { label: 'Monthly',        price: '₩110,000', note: 'Unlimited'       },
    ],
    notices: [
      { title: 'Sunday Closure',  body: 'CoreForge Studio is closed every Sunday for instructor training and deep cleaning.', date: 'Jan 10, 2026' },
      { title: 'Reformer Class',  body: 'Introductory Reformer Pilates class every Tuesday at 19:00. Limited to 8 participants.', date: 'Mar 2, 2026' },
    ],
  },
  g04: {
    id: 'g04',
    phone: '+82 2-555-1004',
    hours: [
      { day: 'Mon', hours: '05:00 – 24:00' },
      { day: 'Tue', hours: '05:00 – 24:00' },
      { day: 'Wed', hours: '05:00 – 24:00' },
      { day: 'Thu', hours: '05:00 – 24:00' },
      { day: 'Fri', hours: '05:00 – 23:00' },
      { day: 'Sat', hours: '06:00 – 22:00' },
      { day: 'Sun', hours: '07:00 – 20:00' },
    ],
    pricing: [
      { label: 'Day Pass',  price: '₩18,000', note: 'Full facility access' },
      { label: '1 Month',   price: '₩99,000',  note: 'Unlimited'           },
      { label: '3 Months',  price: '₩260,000', note: '≈ ₩86,667/mo'       },
      { label: 'Annual',    price: '₩850,000', note: '≈ ₩70,833/mo'       },
    ],
    notices: [
      { title: 'Powerlifting Meet',   body: 'Hosting an inter-gym powerlifting meet on Mar 22. Registration at the front desk.', date: 'Mar 5, 2026' },
      { title: 'Late Night Access',   body: 'Keycard required for entry after 22:00. Apply at reception during staffed hours.',  date: 'Feb 1, 2026'  },
    ],
  },
  g05: {
    id: 'g05',
    phone: '+82 2-555-1005',
    hours: [
      { day: 'Mon', hours: '06:00 – 22:00' },
      { day: 'Tue', hours: '06:00 – 22:00' },
      { day: 'Wed', hours: '06:00 – 22:00' },
      { day: 'Thu', hours: '06:00 – 22:00' },
      { day: 'Fri', hours: '06:00 – 21:00' },
      { day: 'Sat', hours: '08:00 – 20:00' },
      { day: 'Sun', hours: '09:00 – 18:00' },
    ],
    pricing: [
      { label: 'Day Pass',  price: '₩10,000', note: 'Community rate'   },
      { label: '1 Month',   price: '₩65,000',  note: 'Best value'      },
      { label: '3 Months',  price: '₩170,000', note: '≈ ₩56,667/mo'   },
      { label: 'Annual',    price: '₩580,000', note: '≈ ₩48,333/mo'   },
    ],
    notices: [
      { title: 'New Cybex Cable',  body: 'A VR3 functional cable station has been installed in the main floor area.', date: 'Feb 25, 2026' },
    ],
  },
  g06: {
    id: 'g06',
    phone: '+82 2-555-1006',
    hours: [
      { day: 'Mon', hours: '05:30 – 22:00' },
      { day: 'Tue', hours: '05:30 – 22:00' },
      { day: 'Wed', hours: '05:30 – 22:00' },
      { day: 'Thu', hours: '05:30 – 22:00' },
      { day: 'Fri', hours: '05:30 – 21:00' },
      { day: 'Sat', hours: '07:00 – 19:00' },
      { day: 'Sun', hours: '08:00 – 17:00', closed: true },
    ],
    pricing: [
      { label: 'Drop-in',    price: '₩22,000', note: 'Includes coaching'   },
      { label: '1 Month',    price: '₩120,000', note: 'Unlimited sessions'  },
      { label: '3 Months',   price: '₩320,000', note: '≈ ₩106,667/mo'     },
    ],
    notices: [
      { title: 'Closed Sundays',  body: 'Apex Performance is closed every Sunday for team training sessions and facility prep.', date: 'Jan 5, 2026'  },
      { title: 'Olympic Lifting', body: 'Olympic lifting seminar on Mar 15. Open to all levels. Pre-registration required.',     date: 'Mar 3, 2026'  },
    ],
  },
  g07: {
    id: 'g07',
    phone: '+82 2-555-1007',
    hours: [
      { day: 'Mon', hours: '06:00 – 22:00' },
      { day: 'Tue', hours: '06:00 – 22:00' },
      { day: 'Wed', hours: '06:00 – 22:00' },
      { day: 'Thu', hours: '06:00 – 22:00' },
      { day: 'Fri', hours: '06:00 – 21:00' },
      { day: 'Sat', hours: '08:00 – 18:00' },
      { day: 'Sun', hours: '09:00 – 16:00' },
    ],
    pricing: [
      { label: 'Day Pass', price: '₩8,000',  note: 'Neighbourhood rate' },
      { label: '1 Month',  price: '₩55,000',  note: 'Unlimited'         },
      { label: '3 Months', price: '₩145,000', note: '≈ ₩48,333/mo'     },
      { label: 'Annual',   price: '₩490,000', note: '≈ ₩40,833/mo'     },
    ],
    notices: [
      { title: 'Maintenance', body: 'Squat racks area closed for floor refinishing Jan 20–21. Full access resumes Jan 22.', date: 'Jan 18, 2026' },
    ],
  },
  g08: {
    id: 'g08',
    phone: '+82 2-555-1008',
    hours: [
      { day: 'Mon', hours: '05:00 – 23:00' },
      { day: 'Tue', hours: '05:00 – 23:00' },
      { day: 'Wed', hours: '05:00 – 23:00' },
      { day: 'Thu', hours: '05:00 – 23:00' },
      { day: 'Fri', hours: '05:00 – 22:00' },
      { day: 'Sat', hours: '07:00 – 21:00' },
      { day: 'Sun', hours: '08:00 – 20:00' },
    ],
    pricing: [
      { label: 'Day Pass',  price: '₩14,000', note: 'All zones'             },
      { label: '1 Month',   price: '₩82,000',  note: 'Unlimited + recovery' },
      { label: '3 Months',  price: '₩215,000', note: '≈ ₩71,667/mo'        },
      { label: 'Annual',    price: '₩720,000', note: '≈ ₩60,000/mo'        },
    ],
    notices: [
      { title: 'Recovery Suite Open', body: 'New recovery zone with ice bath and infrared sauna now open on level 2.', date: 'Mar 4, 2026' },
      { title: 'Parking Validation',  body: 'Members receive 2 h free parking with any membership tier. Show your card.',   date: 'Feb 10, 2026' },
    ],
  },
};
