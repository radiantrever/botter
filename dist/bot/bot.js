"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bot = void 0;
exports.startBot = startBot;
const grammy_1 = require("grammy");
const i18nMiddleware_1 = require("./i18nMiddleware");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
if (!process.env.BOT_TOKEN) {
    throw new Error("BOT_TOKEN is missing");
}
exports.bot = new grammy_1.Bot(process.env.BOT_TOKEN);
// Middleware
function initialSession() {
    return {};
}
exports.bot.use((0, grammy_1.session)({ initial: initialSession }));
exports.bot.use(i18nMiddleware_1.i18nMiddleware);
// Error handling
exports.bot.catch((err) => {
    console.error(`Error while handling update ${err.ctx.update.update_id}:`);
    console.error(err.error);
});
const creator_1 = require("./handlers/creator");
const subscriber_1 = require("./handlers/subscriber");
// Register Handlers
exports.bot.use(creator_1.creatorHandler);
exports.bot.use(subscriber_1.subscriberHandler);
// Fallback for unknown messages
exports.bot.on("message", (ctx) => {
    const context = ctx;
    return context.reply(context.t("fallback_message"), { parse_mode: "Markdown" });
});
// Launch function
async function startBot() {
    console.log("Starting bot...");
    // Connect to DB and stuff here if needed
    await exports.bot.start();
}
