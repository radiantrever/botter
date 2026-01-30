import { NextFunction } from 'grammy';
import { MyContext } from './context';
import { Language, t } from './i18n';
import { UserRepository } from '../core/user.repo';

const userRepo = new UserRepository();

export async function i18nMiddleware(ctx: MyContext, next: NextFunction) {
  // If session is new/empty (e.g. after restart), try to load from DB
  if (!ctx.session.languageSelected && ctx.from) {
    const user = await userRepo.findByTelegramId(BigInt(ctx.from.id));
    if (user && user.language) {
      ctx.session.language = user.language as Language;
      ctx.session.languageSelected = true;
    }
  }

  // Attach translation function to context as a proxy or dynamic function
  (ctx as any).t = (key: string, params?: Record<string, any>) => {
    const lang: Language = ctx.session.language || 'en';
    return t(lang, key as any, params);
  };

  await next();
}

// Type extension for ease of use in handlers (optional but helpful)
export interface I18nFlavor {
  t: (_key: string, _params?: Record<string, any>) => string;
}

export type MyContextWithI18n = MyContext & I18nFlavor;
