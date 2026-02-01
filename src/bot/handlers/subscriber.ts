import { Composer, InlineKeyboard } from 'grammy';
import { MyContext } from '../context';
import { SubscriberService } from '../../core/subscriber.service';
import { TsPayClient } from '../../core/tspay';
import { LedgerService } from '../../core/ledger.service';
import { MyContextWithI18n } from '../i18nMiddleware';

const composer = new Composer<MyContext>();
const subService = new SubscriberService();
const tspay = new TsPayClient();
const ledgerService = new LedgerService();

composer.command('start', async ctx => {
  const payload = ctx.match; // "c_123"
  return handleStart(ctx as MyContextWithI18n, payload);
});

// Also handle if they paste the link as text
composer.on('message:text', async (ctx, next) => {
  const text = ctx.message.text;
  if (text.includes('?start=c_')) {
    const payload = text.split('?start=')[1];
    return handleStart(ctx as MyContextWithI18n, payload);
  }
  return next();
});

export async function handleStart(
  ctx: MyContextWithI18n,
  payload: string | undefined
) {
  if (!ctx.from) return;

  let referredBy: bigint | undefined;
  let actualPayload: string | undefined = payload;

  if (payload) {
    if (payload.startsWith('ref_')) {
      referredBy = BigInt(payload.split('_')[1]);
      actualPayload = undefined;
    } else if (payload.includes('_ref_')) {
      const parts = payload.split('_ref_');
      actualPayload = parts[0];
      referredBy = BigInt(parts[1]);
    }
  }

  if (referredBy) {
    ctx.session.referrerId = referredBy;
  }

  // Ensure user is registered in the database
  await subService.registerUser(
    BigInt(ctx.from.id),
    ctx.from.username,
    ctx.from.first_name,
    ctx.from.last_name,
    undefined
  );

  // Show language selector only if not selected yet
  if (!ctx.session.languageSelected) {
    ctx.session.startPayload = actualPayload;
    const keyboard = new InlineKeyboard()
      .text("🇺🇿 O'zbekcha", 'set_lang_uz')
      .text('🇬🇧 English', 'set_lang_en')
      .text('🇷🇺 Русский', 'set_lang_ru');

    await ctx.reply(ctx.t('select_language'), { reply_markup: keyboard });
    return;
  }

  if (!actualPayload) {
    // Basic Start (No payload)
    const text = ctx.t('welcome_basic');
    const keyboard = new InlineKeyboard()
      .text(ctx.t('creator_dashboard_btn'), 'dashboard')
      .text(ctx.t('partner_dashboard_btn'), 'partner_dashboard')
      .row()
      .text(ctx.t('referral_btn'), 'referral_program')
      .row()
      .text(ctx.t('how_to_sub_btn'), 'how_to_sub');

    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    return;
  }

  if (actualPayload.startsWith('b_')) {
    const bundleIdString = actualPayload.split('_')[1];
    const bundleId = parseInt(bundleIdString);
    if (isNaN(bundleId)) {
      await ctx.reply(ctx.t('invalid_link'));
      return;
    }

    try {
      const bundle = await subService.getBundleDetails(bundleId);
      if (!bundle) {
        await ctx.reply(ctx.t('bundle_not_found'), { parse_mode: 'Markdown' });
        return;
      }

      let text = ctx.t('bundle_choose_plan', { title: bundle.title });
      const keyboard = new InlineKeyboard();

      if (!bundle.plans || bundle.plans.length === 0) {
        text += ctx.t('no_bundle_plans');
      } else {
        for (const plan of bundle.plans) {
          keyboard
            .text(
              ctx.t('buy_plan_btn', {
                name: plan.name,
                price: plan.price.toLocaleString(),
              }),
              `buy_bundle_plan_${plan.id}`
            )
            .row();
        }
      }

      await ctx.reply(text, { reply_markup: keyboard, parse_mode: 'Markdown' });
    } catch (e) {
      console.error(e);
      await ctx.reply(ctx.t('error_loading'));
    }
    return;
  }

  if (!actualPayload.startsWith('c_')) {
    await ctx.reply(ctx.t('invalid_link'));
    return;
  }

  const channelIdString = actualPayload.split('_')[1];
  const channelId = parseInt(channelIdString);
  if (isNaN(channelId)) {
    await ctx.reply(ctx.t('invalid_link'));
    return;
  }

  try {
    const channel = await subService.getChannelDetails(channelId);
    if (!channel) {
      await ctx.reply(ctx.t('channel_not_found'), { parse_mode: 'Markdown' });
      return;
    }

    if (channel.isFree) {
      const text = ctx.t('free_channel_prompt', { title: channel.title });
      const keyboard = new InlineKeyboard()
        .text(ctx.t('free_channel_join_btn'), `join_free_${channel.id}`)
        .row()
        .text(ctx.t('partner_apply_btn'), `apply_partner_${channel.id}`);

      await ctx.reply(text, { reply_markup: keyboard, parse_mode: 'Markdown' });
      return;
    }

    // Display Plans & Partner Option
    let text = ctx.t('choose_plan', { title: channel.title });
    const keyboard = new InlineKeyboard();

    if (!channel.plans || channel.plans.length === 0) {
      text += ctx.t('no_plans');
    } else {
      for (const plan of channel.plans) {
        keyboard
          .text(
            ctx.t('buy_plan_btn', {
              name: plan.name,
              price: plan.price.toLocaleString(),
            }),
            `buy_plan_${plan.id}`
          )
          .row();
      }
    }

    if (channel.previewEnabled && channel.previewDurationMin > 0) {
      const minutes = Math.min(channel.previewDurationMin, 15);
      keyboard
        .text(ctx.t('preview_btn', { minutes }), `preview_channel_${channel.id}`)
        .row();
    }

    // Add "Promote" button
    keyboard
      .text(ctx.t('partner_apply_btn'), `apply_partner_${channel.id}`)
      .row();

    await ctx.reply(text, { reply_markup: keyboard, parse_mode: 'Markdown' });
  } catch (e) {
    console.error(e);
    await ctx.reply(ctx.t('error_loading'));
  }
}

// Partner Application Handler
composer.callbackQuery(/apply_partner_(\d+)/, async ctx => {
  const context = ctx as MyContextWithI18n;
  const channelId = parseInt(ctx.match[1]);
  await ctx.answerCallbackQuery();

  try {
    const req = await subService.requestPartnership(
      BigInt(ctx.from!.id),
      channelId
    );
    if (req.status === 'PENDING') {
      await ctx.reply(context.t('partner_request_sent'), {
        parse_mode: 'Markdown',
      });
    } else if (req.status === 'APPROVED') {
      // Already approved
      const me = await ctx.api.getMe();
      // Assuming this is the link format we settled on:
      const link = `https://t.me/${me.username}?start=c_${channelId}_ref_${ctx.from!.id}`;
      const channel = await subService.getChannelDetails(channelId); // Fetch to get title
      await ctx.reply(
        context.t('partner_link_msg', {
          channel: channel?.title || 'Channel',
          link,
        }),
        { parse_mode: 'Markdown' }
      );
    } else {
      await ctx.reply(context.t('partner_request_exists'));
    }
  } catch (e) {
    console.error(e);
    await ctx.reply(context.t('error_loading'));
  }
});

composer.callbackQuery(/join_free_(\d+)/, async ctx => {
  const context = ctx as MyContextWithI18n;
  const channelId = parseInt(ctx.match[1]);
  await ctx.answerCallbackQuery();

  try {
    const channel = await subService.getChannelDetails(channelId);
    if (!channel) {
      await ctx.reply(context.t('channel_not_found'), { parse_mode: 'Markdown' });
      return;
    }

    if (!channel.isFree || !channel.freePlanId) {
      await ctx.reply(context.t('error_loading'));
      return;
    }

    const already = await subService.getSubscription(
      BigInt(ctx.from!.id),
      channelId
    );
    if (already) {
      await ctx.reply(context.t('preview_already_subscribed'));
      return;
    }

    const sub = await subService.activateSubscription(
      BigInt(ctx.from!.id),
      channel.freePlanId,
      'FREE',
      ctx.api,
      {
        username: ctx.from?.username,
        firstName: ctx.from?.first_name,
        lastName: ctx.from?.last_name,
      }
    );

    await ctx.reply(
      context.t('free_channel_joined', { link: sub.inviteLink }),
      { parse_mode: 'Markdown' }
    );
  } catch (e) {
    console.error(e);
    await ctx.reply(context.t('error_loading'));
  }
});

composer.callbackQuery(/preview_channel_(\d+)/, async ctx => {
  const context = ctx as MyContextWithI18n;
  const channelId = parseInt(ctx.match[1]);
  await ctx.answerCallbackQuery();

  try {
    const result = await subService.startPreview(
      BigInt(ctx.from!.id),
      channelId,
      ctx.api,
      {
        username: ctx.from?.username,
        firstName: ctx.from?.first_name,
        lastName: ctx.from?.last_name,
      }
    );

    const previewEnd = new Date(result.preview.endDate);
    const remainingMinutes = Math.max(
      1,
      Math.ceil((previewEnd.getTime() - Date.now()) / 60000)
    );

    await ctx.reply(
      context.t('preview_start', {
        minutes: remainingMinutes,
        link: result.preview.inviteLink,
      }),
      { parse_mode: 'Markdown' }
    );
  } catch (e: any) {
    if (e?.message === 'PREVIEW_COOLDOWN') {
      const remainingDays =
        typeof e?.remainingDays === 'number' ? e.remainingDays : 30;
      await ctx.reply(
        context.t('preview_cooldown', { days: remainingDays })
      );
      return;
    }
    if (e.message === 'PREVIEW_DISABLED') {
      await ctx.reply(context.t('preview_not_available'));
      return;
    }
    if (e.message === 'ALREADY_SUBSCRIBED') {
      await ctx.reply(context.t('preview_already_subscribed'));
      return;
    }
    if (e.message === 'CHANNEL_NOT_FOUND') {
      await ctx.reply(context.t('channel_not_found'), { parse_mode: 'Markdown' });
      return;
    }
    console.error(e);
    await ctx.reply(context.t('error_loading'));
  }
});

// Language selection handlers
composer.callbackQuery(/set_lang_(uz|en|ru)/, async ctx => {
  const lang = ctx.match[1] as 'uz' | 'en' | 'ru';
  ctx.session.language = lang;
  ctx.session.languageSelected = true;
  await ctx.answerCallbackQuery();

  // Persist language in DB
  if (ctx.from) {
    await subService.registerUser(
      BigInt(ctx.from.id),
      ctx.from.username,
      ctx.from.first_name,
      ctx.from.last_name,
      lang
    );
  }

  // Resume original flow
  const payload = ctx.session.startPayload;
  ctx.session.startPayload = undefined;
  return handleStart(ctx as MyContextWithI18n, payload);
});

composer.callbackQuery('main_menu', async ctx => {
  const context = ctx as MyContextWithI18n;
  await ctx.answerCallbackQuery();

  const text = context.t('welcome_basic');
  const keyboard = new InlineKeyboard()
    .text(context.t('creator_dashboard_btn'), 'dashboard')
    .text(context.t('partner_dashboard_btn'), 'partner_dashboard')
    .row()
    .text(context.t('referral_btn'), 'referral_program')
    .row()
    .text(context.t('referral_howto_btn'), 'referral_howto')
    .text(context.t('how_to_sub_btn'), 'how_to_sub');

  await ctx.editMessageText(text, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
});

composer.callbackQuery('referral_program', async ctx => {
  const context = ctx as MyContextWithI18n;
  await ctx.answerCallbackQuery();

  const me = await ctx.api.getMe();
  const link = `https://t.me/${me.username}?start=ref_${ctx.from!.id}`;
  const text = context.t('referral_title', { link });

  const keyboard = new InlineKeyboard()
    .text(context.t('referral_howto_btn'), 'referral_howto')
    .row()
    .text(context.t('back_dashboard_btn'), 'main_menu');

  await ctx.editMessageText(text, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
});

composer.callbackQuery('referral_howto', async ctx => {
  const context = ctx as MyContextWithI18n;
  await ctx.answerCallbackQuery();

  const title = context.t('referral_howto_title');
  const text = context.t('referral_howto_text');

  const keyboard = new InlineKeyboard().text(
    context.t('back_dashboard_btn'),
    'main_menu'
  );

  await ctx.editMessageText(`${title}\n\n${text}`, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
});

composer.callbackQuery('how_to_sub', async ctx => {
  const context = ctx as MyContextWithI18n;
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(context.t('how_to_sub_text'), {
    parse_mode: 'Markdown',
    reply_markup: new InlineKeyboard().text(
      context.t('back_dashboard_btn'),
      'main_menu'
    ),
  });
});

// Handle Buy Button
composer.callbackQuery(/buy_plan_(\d+)/, async ctx => {
  const context = ctx as MyContextWithI18n;
  const planId = parseInt(ctx.match[1]);
  await ctx.answerCallbackQuery();

  // Fetch plan details
  const plan = await subService.getPlan(planId);
  if (!plan) {
    await ctx.reply(context.t('error_loading'));
    return;
  }
  const amount = plan.price;
  if (amount < 1000) {
    await ctx.reply(context.t('min_payment_error'));
    return;
  }

  try {
    const me = await ctx.api.getMe();
    const tx = await tspay.createTransaction(
      amount,
      `https://t.me/${me.username}`,
      'Plan Purchase'
    );

    // 2. Reply with Payment Link
    const keyboard = new InlineKeyboard()
      .url(context.t('pay_now_btn'), tx.transaction.payment_url)
      .row()
      .text(
        context.t('i_have_paid_btn'),
        `check_payment_${tx.transaction.cheque_id}_${planId}`
      );

    await ctx.reply(
      context.t('pay_instruction', { amount: amount.toLocaleString() }),
      { reply_markup: keyboard }
    );
  } catch (e) {
    console.error(e);
    await ctx.reply(context.t('error_loading'));
  }
});

// Handle Bundle Plan Buy Button
composer.callbackQuery(/buy_bundle_plan_(\d+)/, async ctx => {
  const context = ctx as MyContextWithI18n;
  const planId = parseInt(ctx.match[1]);
  await ctx.answerCallbackQuery();

  const plan = await subService.getBundlePlan(planId);
  if (!plan) {
    await ctx.reply(context.t('error_loading'));
    return;
  }

  const amount = plan.price;
  if (amount < 1000) {
    await ctx.reply(context.t('min_payment_error'));
    return;
  }

  try {
    const me = await ctx.api.getMe();
    const tx = await tspay.createTransaction(
      amount,
      `https://t.me/${me.username}`,
      'Bundle Purchase'
    );

    const keyboard = new InlineKeyboard()
      .url(context.t('pay_now_btn'), tx.transaction.payment_url)
      .row()
      .text(
        context.t('i_have_paid_btn'),
        `check_bundle_payment_${tx.transaction.cheque_id}_${planId}`
      );

    await ctx.reply(
      context.t('pay_instruction', { amount: amount.toLocaleString() }),
      { reply_markup: keyboard }
    );
  } catch (e) {
    console.error(e);
    await ctx.reply(context.t('error_loading'));
  }
});

composer.callbackQuery(/check_payment_(.+)_(\d+)/, async ctx => {
  const context = ctx as MyContextWithI18n;
  const txId = ctx.match[1];
  const planId = parseInt(ctx.match[2]);
  await ctx.answerCallbackQuery();

  const check = await tspay.checkTransaction(txId);

  // Some versions of TsPay return details in 'data', others in 'transaction', or flattened at top level
  const details = check.data || check.transaction || check;
  const isPaid =
    check.status === 'success' &&
    (details.pay_status === 'paid' || !details.pay_status);

  if (isPaid) {
    try {
      const sub = await subService.activateSubscription(
        BigInt(ctx.from!.id),
        planId,
        txId,
        ctx.api,
        {
          username: ctx.from?.username,
          firstName: ctx.from?.first_name,
          lastName: ctx.from?.last_name,
        },
        ctx.session.referrerId
      );

      // Record Transaction in Ledger
      const plan = await subService.getPlan(planId);
      if (plan) {
        // Determine if we have a partner to pass to ledger?
        // Ledger service now looks up the subscription and partner itself.
        // We just record the transaction amount.
        await ledgerService.recordTransaction(
          sub.id,
          plan.price,
          plan.channel.creatorId
        );
      }

      await ctx.reply(
        context.t('payment_confirmed', { link: sub.inviteLink }),
        { parse_mode: 'Markdown' }
      );
    } catch (e) {
      console.error(e);
      await ctx.reply(context.t('payment_error'));
    }
  } else {
    await ctx.reply(context.t('payment_error'));
  }
});

composer.callbackQuery(/check_bundle_payment_(.+)_(\d+)/, async ctx => {
  const context = ctx as MyContextWithI18n;
  const txId = ctx.match[1];
  const planId = parseInt(ctx.match[2]);
  await ctx.answerCallbackQuery();

  const check = await tspay.checkTransaction(txId);
  const details = check.data || check.transaction || check;
  const isPaid =
    check.status === 'success' &&
    (details.pay_status === 'paid' || !details.pay_status);

  if (!isPaid) {
    await ctx.reply(context.t('payment_error'));
    return;
  }

  try {
    const result = await subService.activateBundleSubscription(
      BigInt(ctx.from!.id),
      planId,
      txId,
      ctx.api,
      {
        username: ctx.from?.username,
        firstName: ctx.from?.first_name,
        lastName: ctx.from?.last_name,
      }
    );

    const plan = await subService.getBundlePlan(planId);
    if (plan) {
      await ledgerService.recordBundleTransaction(
        result.subscription.id,
        plan.price,
        plan.bundle.creatorId
      );
    }

    let text = context.t('bundle_payment_confirmed');

    for (const link of result.inviteLinks) {
      if (link.inviteLink) {
        text += `\n- ${link.channelTitle}: ${link.inviteLink}`;
      } else {
        text += `\n- ${link.channelTitle}: ${context.t('bundle_link_failed')}`;
      }
    }

    if (result.bundle.folderLink) {
      text += `\n\n${context.t('bundle_folder_share', {
        link: result.bundle.folderLink,
      })}`;
    }

    text += `\n\n${context.t('bundle_cooldown_reminder')}`;

    await ctx.reply(text, { parse_mode: 'Markdown' });
  } catch (e) {
    console.error(e);
    await ctx.reply(context.t('payment_error'));
  }
});

export const subscriberHandler = composer;
