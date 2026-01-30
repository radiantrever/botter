"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.i18nMiddleware = i18nMiddleware;
const i18n_1 = require("./i18n");
const user_repo_1 = require("../core/user.repo");
const userRepo = new user_repo_1.UserRepository();
async function i18nMiddleware(ctx, next) {
    // If session is new/empty (e.g. after restart), try to load from DB
    if (!ctx.session.languageSelected && ctx.from) {
        const user = await userRepo.findByTelegramId(BigInt(ctx.from.id));
        if (user && user.language) {
            ctx.session.language = user.language;
            ctx.session.languageSelected = true;
        }
    }
    // Attach translation function to context as a proxy or dynamic function
    ctx.t = (key, params) => {
        const lang = ctx.session.language || 'en';
        return (0, i18n_1.t)(lang, key, params);
    };
    await next();
}
