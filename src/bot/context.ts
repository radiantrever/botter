import { Context, SessionFlavor } from 'grammy';

export interface SessionData {
    language?: 'uz' | 'en' | 'ru';
    languageSelected?: boolean;
    startPayload?: string;
    step?: string; // For wizard steps (e.g. 'creating_plan_name')
    tempPlan?: {
        channelId?: number;
        name?: string;
        price?: number;
        duration?: number;
    };
    withdrawAmount?: number;
    referrerId?: bigint;
}

export type MyContext = Context & SessionFlavor<SessionData>;
