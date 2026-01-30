import { Composer, InlineKeyboard } from 'grammy';
import { MyContext } from '../context';
import { CreatorService } from '../../core/creator.service';
import { LedgerService } from '../../core/ledger.service';
import { SubscriberService } from '../../core/subscriber.service';
import { MyContextWithI18n } from '../i18nMiddleware';
import { handleStart } from './subscriber';

const composer = new Composer<MyContext>();
const creatorService = new CreatorService();
const subService = new SubscriberService();
const ledgerService = new LedgerService();

composer.command('dashboard', async (ctx) => {
    const context = ctx as MyContextWithI18n;
    if (!ctx.from) return;
    try {
        const creator = await creatorService.registerCreator(BigInt(ctx.from.id));
        const channels = creator.channels || [];

        let text = context.t("creator_dashboard_title");
        const keyboard = new InlineKeyboard();

        if (channels.length === 0) {
            text += context.t("no_channels");
        } else {
            text += context.t("select_channel");
            for (const ch of channels) {
                keyboard.text(`📺 ${ch.title}`, `manage_channel_${ch.id}`).row();
            }
        }

        keyboard.text(context.t("wallet_btn"), "wallet").row();
        keyboard.text(context.t("add_channel_btn"), "add_channel_info").row();
        keyboard.text(context.t("main_menu_btn"), "main_menu").row();

        await ctx.reply(text, { reply_markup: keyboard, parse_mode: "Markdown" });
    } catch (e: any) {
        console.error(e);
        await ctx.reply(`${context.t("error_loading")}: ${e.message || e}`);
    }
});

composer.callbackQuery(/manage_channel_(\d+)/, async (ctx) => {
    const context = ctx as MyContextWithI18n;
    const channelId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();

    const creator = await creatorService.registerCreator(BigInt(ctx.from!.id));
    const channel = creator.channels.find(c => c.id === channelId);

    if (!channel) return ctx.reply(context.t("channel_not_found"));

    const text = context.t("manage_channel_title", { title: channel.title });
    const keyboard = new InlineKeyboard()
        .text(context.t("add_plan_btn"), `create_plan_${channelId}`).row()
        .text(context.t("get_link_btn"), `get_link_${channelId}`).row()
        .text(context.t("back_dashboard_btn"), "dashboard");

    await ctx.editMessageText(text, { reply_markup: keyboard, parse_mode: "Markdown" });
});

composer.callbackQuery("dashboard", async (ctx) => {
    const context = ctx as MyContextWithI18n;
    await ctx.answerCallbackQuery();

    const creator = await creatorService.registerCreator(BigInt(ctx.from!.id));
    const channels = creator.channels || [];

    let text = context.t("creator_dashboard_title");
    const keyboard = new InlineKeyboard();

    if (channels.length === 0) {
        text += context.t("no_channels");
    } else {
        text += context.t("select_channel");
        for (const ch of channels) {
            keyboard.text(`📺 ${ch.title}`, `manage_channel_${ch.id}`).row();
        }
    }

    keyboard.text(context.t("wallet_btn"), "wallet").row();
    keyboard.text(context.t("analytics_btn"), "analytics").row();
    keyboard.text(context.t("manage_partners_btn"), "manage_partners").row();
    keyboard.text(context.t("add_channel_btn"), "add_channel_info").row();
    keyboard.text(context.t("main_menu_btn"), "main_menu").row();

    await ctx.editMessageText(text, { reply_markup: keyboard, parse_mode: "Markdown" });
});

composer.callbackQuery("manage_partners", async (ctx) => {
    const context = ctx as MyContextWithI18n;
    await ctx.answerCallbackQuery();

    try {
        const requests = await creatorService.getPartnerRequests(BigInt(ctx.from!.id));
        
        let text = context.t("partners_list_title");
        if (requests.length === 0) {
            text = context.t("no_partner_requests");
        }

        const keyboard = new InlineKeyboard();
        for (const req of requests) {
            const label = context.t("partner_request_item", { name: req.user.firstName || 'User', username: req.user.username || req.user.id.toString() });
            keyboard.text(`${label} (${req.channel.title})`, `view_partner_req_${req.id}`).row();
        }
        keyboard.text(context.t("back_dashboard_btn"), "dashboard");

        await ctx.editMessageText(text, { reply_markup: keyboard, parse_mode: "Markdown" });
    } catch (e) {
        console.error(e);
        await ctx.reply(context.t("error_loading"));
    }
});

composer.callbackQuery(/view_partner_req_(\d+)/, async (ctx) => {
    const context = ctx as MyContextWithI18n;
    const partnerId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();

    const keyboard = new InlineKeyboard()
        .text(context.t("approve_btn"), `approve_partner_${partnerId}`)
        .text(context.t("reject_btn"), `reject_partner_${partnerId}`).row()
        .text(context.t("back_dashboard_btn"), "manage_partners");

    await ctx.editMessageText("Choose action:", { reply_markup: keyboard });
});

composer.callbackQuery(/approve_partner_(\d+)/, async (ctx) => {
    const context = ctx as MyContextWithI18n;
    const partnerId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();

    try {
        const partner = await creatorService.approvePartner(BigInt(ctx.from!.id), partnerId);
        await ctx.editMessageText(context.t("partner_approved"), {
            reply_markup: new InlineKeyboard().text(context.t("back_dashboard_btn"), "manage_partners")
        });

        // Notify Partner
        const channel = await subService.getChannelDetails(partner.channelId);
        const me = await ctx.api.getMe();
        const link = `https://t.me/${me.username}?start=c_${partner.channelId}_ref_${partner.user.telegramId}`;
        
        try {
            await ctx.api.sendMessage(Number(partner.user.telegramId), context.t("partner_link_msg", { 
                channel: channel?.title || "Channel", 
                link
            }), { parse_mode: "Markdown" });
        } catch (notifyError) {
            console.error("Failed to notify partner:", notifyError);
        }

    } catch (e) {
        console.error(e);
        await ctx.reply(context.t("error_loading"));
    }
});

composer.callbackQuery(/reject_partner_(\d+)/, async (ctx) => {
    const context = ctx as MyContextWithI18n;
    const partnerId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();

    try {
        await creatorService.rejectPartner(BigInt(ctx.from!.id), partnerId);
        await ctx.editMessageText(context.t("partner_rejected"), {
            reply_markup: new InlineKeyboard().text(context.t("back_dashboard_btn"), "manage_partners")
        });
    } catch (e) {
        console.error(e);
        await ctx.reply(context.t("error_loading"));
    }
});

composer.callbackQuery("analytics", async (ctx) => {
    const context = ctx as MyContextWithI18n;
    await ctx.answerCallbackQuery();

    try {
        const stats = await creatorService.getAnalytics(BigInt(ctx.from!.id));
        const text = context.t("analytics_title", {
            revenue: stats.totalRevenue.toLocaleString(),
            active: stats.activeSubscribers.toLocaleString(),
            churn: stats.totalChurn.toLocaleString(),
            new_today: stats.newSubscribersToday.toLocaleString(),
            ref_count: stats.partnerConversions.toLocaleString(),
            ref_payouts: stats.partnerPayouts.toLocaleString()
        });

        const keyboard = new InlineKeyboard()
            .text(context.t("back_dashboard_btn"), "dashboard");

        await ctx.editMessageText(text, { reply_markup: keyboard, parse_mode: "Markdown" });
    } catch (e) {
        console.error(e);
        await ctx.reply(context.t("error_loading"));
    }
});

composer.callbackQuery("add_channel_info", async (ctx) => {
    const context = ctx as MyContextWithI18n;
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(context.t("no_channels"), {
        parse_mode: "Markdown",
        reply_markup: new InlineKeyboard().text(context.t("back_dashboard_btn"), "dashboard")
    });
});

composer.callbackQuery("wallet", async (ctx) => {
    const context = ctx as MyContextWithI18n;
    await ctx.answerCallbackQuery();

    try {
        const balance = await creatorService.getBalance(BigInt(ctx.from!.id));
        const history = await creatorService.getRecentPayouts(BigInt(ctx.from!.id), 7);

        let text = context.t("wallet_title", { amount: balance.toLocaleString() });

        if (history.length > 0) {
            text += "\n\n📋 **Recent Payouts (Last 7 days):**\n";
            for (const p of history) {
                const statusIcon = p.status === 'PAID' ? '✅' : (p.status === 'REJECTED' ? '❌' : '⏳');
                text += `${statusIcon} ${p.amount.toLocaleString()} UZS (${p.status}) - ${p.requestedAt.toLocaleDateString()}\n`;
            }
        }

        const keyboard = new InlineKeyboard()
            .text(context.t("withdraw_btn"), "withdraw_start").row()
            .text(context.t("payout_history_btn"), "payout_history").row()
            .text(context.t("back_dashboard_btn"), "dashboard");

        await ctx.editMessageText(text, { reply_markup: keyboard, parse_mode: "Markdown" });
    } catch (e) {
        console.error(e);
        await ctx.reply(context.t("error_loading"));
    }
});

composer.callbackQuery("payout_history", async (ctx) => {
    const context = ctx as MyContextWithI18n;
    await ctx.answerCallbackQuery();

    try {
        const history = await creatorService.getPayoutHistory(BigInt(ctx.from!.id));

        let text = context.t("full_history_title");

        if (history.length === 0) {
            text += "\n\n*No records found.*";
        } else {
            text += "\n\n";
            for (const p of history) {
                const statusIcon = p.status === 'PAID' ? '✅' : (p.status === 'REJECTED' ? '❌' : '⏳');
                text += `${statusIcon} ${p.amount.toLocaleString()} UZS - ${p.requestedAt.toLocaleDateString()} (${p.status})\n`;
            }
        }

        const keyboard = new InlineKeyboard()
            .text(context.t("back_dashboard_btn"), "wallet");

        await ctx.editMessageText(text, { reply_markup: keyboard, parse_mode: "Markdown" });
    } catch (e) {
        console.error(e);
        await ctx.reply(context.t("error_loading"));
    }
});

composer.callbackQuery("withdraw_start", async (ctx) => {
    const context = ctx as MyContextWithI18n;
    await ctx.answerCallbackQuery();

    const balance = await creatorService.getBalance(BigInt(ctx.from!.id));
    if (balance <= 0) {
        await ctx.reply(context.t("insufficient_balance"));
        return;
    }

    ctx.session.step = 'withdrawing_amount';
    await ctx.reply(context.t("enter_withdraw_amount"));
});

composer.callbackQuery(/get_link_(\d+)/, async (ctx) => {
    const context = ctx as MyContextWithI18n;
    const channelId = ctx.match[1];
    await ctx.answerCallbackQuery();
    const me = await ctx.api.getMe();
    const link = `https://t.me/${me.username}?start=c_${channelId}`;

    await ctx.reply(context.t("your_link_title", { link }), {
        parse_mode: "Markdown",
        reply_markup: new InlineKeyboard().text(context.t("back_dashboard_btn"), `manage_channel_${channelId}`)
    });
});

composer.command('register', async (ctx) => {
    const context = ctx as MyContextWithI18n;
    if (!ctx.from) return;
    try {
        await creatorService.registerCreator(
            BigInt(ctx.from.id),
            ctx.from.username,
            ctx.from.first_name,
            ctx.from.last_name
        );
        await ctx.reply(context.t("reg_success"), {
            parse_mode: "Markdown",
            reply_markup: new InlineKeyboard().text(context.t("go_dashboard_btn"), "dashboard")
        });
    } catch (e: any) {
        console.error(e);
        await ctx.reply(`${context.t("error_loading")}: ${e.message || e}`);
    }
});

// Handle forwarded messages to register channel
composer.on('message:forward_origin:channel', async (ctx) => {
    const context = ctx as MyContextWithI18n;
    if (!ctx.from) return;
    // We know it's a channel due to filter
    const origin = ctx.message.forward_origin as any;
    const channelId = origin.chat.id;
    const title = origin.chat.title || "Untitled Channel";

    try {
        // Verify admin rights
        let isAdmin = false;
        try {
            const admins = await ctx.api.getChatAdministrators(channelId);
            const me = await ctx.api.getMe();
            isAdmin = admins.some(a => a.user.id === me.id);
        } catch (adminErr: any) {
            if (adminErr.description?.includes("bot is not a member")) {
                await ctx.reply(context.t("not_admin"));
                return;
            }
            throw adminErr;
        }

        if (!isAdmin) {
            await ctx.reply(context.t("not_admin"));
            return;
        }

        // Register
        const creator = await creatorService.registerCreator(
            BigInt(ctx.from.id), ctx.from.username, ctx.from.first_name, ctx.from.last_name
        );
        if (!creator) throw new Error("Could not register creator.");

        const channel = await creatorService.registerChannel(creator.userId, BigInt(channelId), title);

        const keyboard = new InlineKeyboard()
            .text(context.t("add_plan_btn"), `create_plan_${channel.id}`).row()
            .text(context.t("go_dashboard_btn"), "dashboard");

        await ctx.reply(context.t("channel_reg_success", { title }), { reply_markup: keyboard });

    } catch (e) {
        console.error(e);
        await ctx.reply(`${context.t("error_loading")}: ${(e as Error).message}`);
    }
});

composer.callbackQuery(/create_plan_(\d+)/, async (ctx) => {
    const context = ctx as MyContextWithI18n;
    const channelId = parseInt(ctx.match[1]);
    await ctx.answerCallbackQuery();

    ctx.session.step = 'creating_plan_name';
    ctx.session.tempPlan = { channelId };
    await ctx.reply(context.t("create_plan_title"), { parse_mode: "Markdown" });
});

composer.on('message:text', async (ctx, next) => {
    const context = ctx as MyContextWithI18n;
    const step = ctx.session.step;
    if (!step) return next();

    if (step === 'creating_plan_name') {
        ctx.session.tempPlan!.name = ctx.message.text;
        ctx.session.step = 'creating_plan_price';
        await ctx.reply(context.t("enter_price"));
        return;
    }

    if (step === 'creating_plan_price') {
        const price = parseInt(ctx.message.text);
        if (isNaN(price)) return ctx.reply(context.t("invalid_number"));
        ctx.session.tempPlan!.price = price;
        ctx.session.step = 'creating_plan_duration';
        await ctx.reply(context.t("enter_duration"));
        return;
    }

    if (step === 'creating_plan_duration') {
        const days = parseInt(ctx.message.text);
        if (isNaN(days)) return ctx.reply(context.t("invalid_number"));

        const plan = ctx.session.tempPlan!;

        // Save Plan using service
        const newPlan = await creatorService.createPlan(plan.channelId!, plan.name!, plan.price!, days);

        const me = await ctx.api.getMe();
        const link = `https://t.me/${me.username}?start=c_${plan.channelId}`;

        await ctx.reply(context.t("plan_created", {
            name: newPlan.name,
            price: newPlan.price.toLocaleString(),
            days,
            link
        }), {
            parse_mode: "Markdown",
            reply_markup: new InlineKeyboard().text(context.t("go_dashboard_btn"), "dashboard")
        });

        ctx.session.step = undefined;
        ctx.session.tempPlan = undefined;
        return;
    }

    if (step === 'withdrawing_amount') {
        const amount = parseInt(ctx.message.text);
        if (isNaN(amount) || amount <= 0) return ctx.reply(context.t("invalid_number"));

        if (amount < 10000) {
            return ctx.reply(context.t("min_withdrawal_error"));
        }

        const balance = await creatorService.getBalance(BigInt(ctx.from!.id));
        if (amount > balance) return ctx.reply(context.t("insufficient_balance"));

        ctx.session.withdrawAmount = amount;
        ctx.session.step = 'withdrawing_card';
        await ctx.reply(context.t("enter_card_number"));
        return;
    }

    if (step === 'withdrawing_card') {
        const cardNumber = ctx.message.text.replace(/\s+/g, '');
        if (cardNumber.length < 16) return ctx.reply(context.t("invalid_number"));

        const amount = ctx.session.withdrawAmount!;

        try {
            await creatorService.requestPayout(BigInt(ctx.from!.id), amount, cardNumber);
            await ctx.reply(context.t("withdraw_success", { amount: amount.toLocaleString() }), {
                reply_markup: new InlineKeyboard().text(context.t("back_dashboard_btn"), "dashboard")
            });
        } catch (e: any) {
            await ctx.reply(`${context.t("payment_error")}: ${e.message}`);
        }

        ctx.session.step = undefined;
        ctx.session.withdrawAmount = undefined;
        return;
    }

    return next();
});

composer.command('balance', async (ctx) => {
    const context = ctx as MyContextWithI18n;
    if (!ctx.from) return;
    try {
        const balance = await creatorService.getBalance(BigInt(ctx.from.id));
        await ctx.reply(context.t("wallet_title", { amount: balance.toLocaleString() }), { parse_mode: "Markdown" });
    } catch (e) {
        console.error(e);
        await ctx.reply(context.t("error_loading"));
    }
});

composer.command('withdraw', async (ctx) => {
    const context = ctx as MyContextWithI18n;
    const balance = await creatorService.getBalance(BigInt(ctx.from!.id));
    if (balance <= 0) {
        await ctx.reply(context.t("insufficient_balance"));
        return;
    }
    ctx.session.step = 'withdrawing_amount';
    await ctx.reply(context.t("enter_withdraw_amount"));
});

composer.command('payouts', async (ctx) => {
    const context = ctx as MyContextWithI18n;
    if (!ctx.from) return;
    try {
        const history = await creatorService.getPayoutHistory(BigInt(ctx.from.id));

        let text = context.t("full_history_title");

        if (history.length === 0) {
            text += "\n\n*No records found.*";
        } else {
            text += "\n\n";
            for (const p of history) {
                const statusIcon = p.status === 'PAID' ? '✅' : (p.status === 'REJECTED' ? '❌' : '⏳');
                text += `${statusIcon} ${p.amount.toLocaleString()} UZS - ${p.requestedAt.toLocaleDateString()} (${p.status})\n`;
            }
        }

        const keyboard = new InlineKeyboard()
            .text(context.t("back_dashboard_btn"), "wallet");

        await ctx.reply(text, { reply_markup: keyboard, parse_mode: "Markdown" });
    } catch (e) {
        console.error(e);
        await ctx.reply(context.t("error_loading"));
    }
});

export const creatorHandler = composer;
