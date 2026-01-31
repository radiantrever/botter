import { Composer, InlineKeyboard } from 'grammy';
import { MyContext } from '../context';
import { MyContextWithI18n } from '../i18nMiddleware';
import { PartnerService } from '../../core/partner.service';
import { CreatorService } from '../../core/creator.service';

const composer = new Composer<MyContext>();
const partnerService = new PartnerService();
const creatorService = new CreatorService();

const MIN_WITHDRAWAL = 10000;

async function renderPartnerDashboard(
  ctx: MyContextWithI18n,
  edit: boolean
) {
  if (!ctx.from) return;
  const summary = await partnerService.getPartnerSummary(BigInt(ctx.from.id));

  const keyboard = new InlineKeyboard();
  let text: string;

  if (summary.approvedPartners.length === 0) {
    text = ctx.t('partner_no_approvals');
    if (summary.pendingCount > 0) {
      text += `\n\n${ctx.t('partner_pending_note', {
        pending: summary.pendingCount.toLocaleString(),
      })}`;
    }

    keyboard.text(ctx.t('referral_btn'), 'referral_program').row();
    keyboard.text(ctx.t('main_menu_btn'), 'main_menu');
  } else {
    text = ctx.t('partner_dashboard_title', {
      earnings: summary.totalEarnings.toLocaleString(),
      balance: summary.availableBalance.toLocaleString(),
      conversions: summary.totalConversions.toLocaleString(),
      active: summary.activeReferrals.toLocaleString(),
      new_today: summary.newToday.toLocaleString(),
    });

    if (summary.pendingCount > 0) {
      text += `\n\n${ctx.t('partner_pending_note', {
        pending: summary.pendingCount.toLocaleString(),
      })}`;
    }

    keyboard.text(ctx.t('partner_analytics_btn'), 'partner_analytics').row();
    keyboard.text(ctx.t('partner_links_btn'), 'partner_links').row();
    keyboard.text(ctx.t('partner_wallet_btn'), 'partner_wallet').row();
    keyboard.text(ctx.t('main_menu_btn'), 'main_menu');
  }

  if (edit) {
    await ctx.editMessageText(text, {
      reply_markup: keyboard,
      parse_mode: 'Markdown',
    });
    return;
  }

  await ctx.reply(text, { reply_markup: keyboard, parse_mode: 'Markdown' });
}

composer.command('partner', async ctx => {
  const context = ctx as MyContextWithI18n;
  await renderPartnerDashboard(context, false);
});

composer.callbackQuery('partner_dashboard', async ctx => {
  const context = ctx as MyContextWithI18n;
  await ctx.answerCallbackQuery();
  await renderPartnerDashboard(context, true);
});

composer.callbackQuery('partner_analytics', async ctx => {
  const context = ctx as MyContextWithI18n;
  await ctx.answerCallbackQuery();
  if (!ctx.from) return;

  try {
    const analytics = await partnerService.getPartnerAnalytics(
      BigInt(ctx.from.id)
    );

    if (analytics.approvedPartners.length === 0) {
      const keyboard = new InlineKeyboard().text(
        context.t('back_dashboard_btn'),
        'partner_dashboard'
      );
      await ctx.editMessageText(context.t('partner_no_approvals'), {
        reply_markup: keyboard,
        parse_mode: 'Markdown',
      });
      return;
    }

    let text = context.t('partner_analytics_title', {
      earnings: analytics.totalEarnings.toLocaleString(),
      conversions: analytics.totalConversions.toLocaleString(),
      active: analytics.activeReferrals.toLocaleString(),
      new_today: analytics.newToday.toLocaleString(),
    });

    if (analytics.channels.length === 0) {
      text += `\n\n${context.t('partner_no_links')}`;
    } else {
      const maxChannels = 10;
      for (const channel of analytics.channels.slice(0, maxChannels)) {
        text += `\n${context.t('partner_channel_line', {
          title: channel.title,
          conversions: channel.conversions.toLocaleString(),
          earnings: channel.earnings.toLocaleString(),
          active: channel.active.toLocaleString(),
        })}`;
      }
    }

    const keyboard = new InlineKeyboard().text(
      context.t('back_dashboard_btn'),
      'partner_dashboard'
    );

    await ctx.editMessageText(text, {
      reply_markup: keyboard,
      parse_mode: 'Markdown',
    });
  } catch (e) {
    console.error(e);
    await ctx.reply(context.t('error_loading'));
  }
});

composer.callbackQuery('partner_links', async ctx => {
  const context = ctx as MyContextWithI18n;
  await ctx.answerCallbackQuery();
  if (!ctx.from) return;

  try {
    const links = await partnerService.getPartnerLinks(BigInt(ctx.from.id));
    const keyboard = new InlineKeyboard().text(
      context.t('back_dashboard_btn'),
      'partner_dashboard'
    );

    if (links.length === 0) {
      await ctx.editMessageText(context.t('partner_no_links'), {
        reply_markup: keyboard,
        parse_mode: 'Markdown',
      });
      return;
    }

    const me = await ctx.api.getMe();
    let text = context.t('partner_links_title');
    const maxLinks = 10;

    for (const item of links.slice(0, maxLinks)) {
      const link = `https://t.me/${me.username}?start=c_${item.channelId}_ref_${ctx.from.id}`;
      text += `\n- ${item.channelTitle}: \`${link}\``;
    }

    await ctx.editMessageText(text, {
      reply_markup: keyboard,
      parse_mode: 'Markdown',
    });
  } catch (e) {
    console.error(e);
    await ctx.reply(context.t('error_loading'));
  }
});

composer.callbackQuery('partner_wallet', async ctx => {
  const context = ctx as MyContextWithI18n;
  await ctx.answerCallbackQuery();
  if (!ctx.from) return;

  try {
    await creatorService.registerCreator(
      BigInt(ctx.from.id),
      ctx.from.username,
      ctx.from.first_name,
      ctx.from.last_name
    );

    const balance = await creatorService.getBalance(BigInt(ctx.from.id));

    const text = context.t('partner_wallet_title', {
      amount: balance.toLocaleString(),
    });

    const keyboard = new InlineKeyboard()
      .text(context.t('withdraw_btn'), 'partner_withdraw_start')
      .row()
      .text(context.t('payout_history_btn'), 'partner_payout_history')
      .row()
      .text(context.t('back_dashboard_btn'), 'partner_dashboard');

    await ctx.editMessageText(text, {
      reply_markup: keyboard,
      parse_mode: 'Markdown',
    });
  } catch (e) {
    console.error(e);
    await ctx.reply(context.t('error_loading'));
  }
});

composer.callbackQuery('partner_payout_history', async ctx => {
  const context = ctx as MyContextWithI18n;
  await ctx.answerCallbackQuery();
  if (!ctx.from) return;

  try {
    const history = await creatorService.getPayoutHistory(BigInt(ctx.from.id));

    let text = context.t('full_history_title');

    if (history.length === 0) {
      text += '\n\n*No records found.*';
    } else {
      text += '\n\n';
      for (const p of history) {
        const statusIcon =
          p.status === 'PAID' ? '✅' : p.status === 'REJECTED' ? '❌' : '⏳';
        text += `${statusIcon} ${p.amount.toLocaleString()} UZS - ${p.requestedAt.toLocaleDateString()} (${p.status})\n`;
      }
    }

    const keyboard = new InlineKeyboard().text(
      context.t('back_dashboard_btn'),
      'partner_wallet'
    );

    await ctx.editMessageText(text, {
      reply_markup: keyboard,
      parse_mode: 'Markdown',
    });
  } catch (e) {
    console.error(e);
    await ctx.reply(context.t('error_loading'));
  }
});

composer.callbackQuery('partner_withdraw_start', async ctx => {
  const context = ctx as MyContextWithI18n;
  await ctx.answerCallbackQuery();
  if (!ctx.from) return;

  await creatorService.registerCreator(
    BigInt(ctx.from.id),
    ctx.from.username,
    ctx.from.first_name,
    ctx.from.last_name
  );

  const balance = await creatorService.getBalance(BigInt(ctx.from.id));
  if (balance <= 0) {
    await ctx.reply(context.t('insufficient_balance'));
    return;
  }

  ctx.session.step = 'partner_withdrawing_amount';
  await ctx.reply(context.t('enter_withdraw_amount'));
});

composer.on('message:text', async (ctx, next) => {
  const context = ctx as MyContextWithI18n;
  const step = ctx.session.step;
  if (!step) return next();

  if (step === 'partner_withdrawing_amount') {
    const amount = parseInt(ctx.message.text);
    if (isNaN(amount) || amount <= 0)
      return ctx.reply(context.t('invalid_number'));

    if (amount < MIN_WITHDRAWAL) {
      return ctx.reply(context.t('min_withdrawal_error'));
    }

    const balance = await creatorService.getBalance(BigInt(ctx.from!.id));
    if (amount > balance) return ctx.reply(context.t('insufficient_balance'));

    ctx.session.withdrawAmount = amount;
    ctx.session.step = 'partner_withdrawing_card';
    await ctx.reply(context.t('enter_card_number'));
    return;
  }

  if (step === 'partner_withdrawing_card') {
    const cardNumber = ctx.message.text.replace(/\s+/g, '');
    if (cardNumber.length < 16) return ctx.reply(context.t('invalid_number'));

    const amount = ctx.session.withdrawAmount!;

    try {
      await creatorService.requestPayout(
        BigInt(ctx.from!.id),
        amount,
        cardNumber
      );
      await ctx.reply(
        context.t('withdraw_success', { amount: amount.toLocaleString() }),
        {
          reply_markup: new InlineKeyboard().text(
            context.t('back_dashboard_btn'),
            'partner_dashboard'
          ),
        }
      );
    } catch (e: any) {
      await ctx.reply(`${context.t('payment_error')}: ${e.message}`);
    }

    ctx.session.step = undefined;
    ctx.session.withdrawAmount = undefined;
    return;
  }

  return next();
});

export const partnerHandler = composer;
