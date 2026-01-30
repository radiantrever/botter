import { Bot, session } from 'grammy';
import { MyContext, SessionData } from './context';
import { i18nMiddleware } from './i18nMiddleware';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.BOT_TOKEN) {
    throw new Error("BOT_TOKEN is missing");
}

export const bot = new Bot<MyContext>(process.env.BOT_TOKEN);

// Middleware
function initialSession(): SessionData {
    return {};
}
bot.use(session({ initial: initialSession }));
bot.use(i18nMiddleware);

// Error handling
bot.catch((err) => {
    console.error(`Error while handling update ${err.ctx.update.update_id}:`);
    console.error(err.error);
});

import { creatorHandler } from './handlers/creator';
import { subscriberHandler } from './handlers/subscriber';

// Register Handlers
bot.use(creatorHandler);
bot.use(subscriberHandler);

// Fallback for unknown messages
bot.on("message", (ctx) => {
    const context = ctx as any;
    return context.reply(context.t("fallback_message"), { parse_mode: "Markdown" });
});

// Launch function
export async function startBot() {
    console.log("Starting bot...");
    // Connect to DB and stuff here if needed
    await bot.start();
}
