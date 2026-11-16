import { createContext } from 'react';

// 지금 열려 있는 운동일지의 주인 id.
// 그 운동일지 안에서 연 오운완 상세의 닉네임은 같은 운동일지를 또 열지 않도록 링크를 끈다.
export const UserJournalContext = createContext<string | null>(null);
