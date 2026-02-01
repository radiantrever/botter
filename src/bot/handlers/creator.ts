import { Composer, InlineKeyboard } from 'grammy';
import { MyContext } from '../context';
import { CreatorService } from '../../core/creator.service';
// import { LedgerService } from '../../core/ledger.service';
import { SubscriberService } from '../../core/subscriber.service';
import { MyContextWithI18n } from '../i18nMiddleware';
import prisma from '../../db/prisma';
import { t } from '../i18n';

function parseDurationMinutesInput(input: string): number | null {
  const text = input.trim().toLowerCase();
  if (!text) return null;

  if (text.endsWith('m')) {
    const value = parseInt(text.slice(0, -1).trim());
    return Number.isNaN(value) ? null : value;
  }

  if (text.endsWith('min') || text.endsWith('mins')) {
    const value = parseInt(text.replace(/mins?$/, '').trim());
    return Number.isNaN(value) ? null : value;
  }

  if (text.endsWith('h')) {
    const value = parseFloat(text.slice(0, -1).trim());
    return Number.isNaN(value) ? null : Math.round(value * 60);
  }

  if (text.endsWith('hour') || text.endsWith('hours')) {
    const value = parseFloat(text.replace(/hours?$/, '').trim());
    return Number.isNaN(value) ? null : Math.round(value * 60);
  }

  const value = parseInt(text);
  return Number.isNaN(value) ? null : value;
}
// import { handleStart } from './subscriber';

const composer = new Composer<MyContext>();
const creatorService = new CreatorService();
const subService = new SubscriberService();
// const ledgerService = new LedgerService();

composer.command('dashboard', async ctx => {
  const context = ctx as MyContextWithI18n;
  if (!ctx.from) return;
  try {
    const creator = await creatorService.registerCreator(BigInt(ctx.from.id));
    const channels = creator.channels || [];

    let text = context.t('creator_dashboard_title');
    const keyboard = new InlineKeyboard();

    if (channels.length === 0) {
      text += context.t('no_channels');
    } else {
      text += context.t('select_channel');
      for (const ch of channels) {
        keyboard.text(`📺 ${ch.title}`, `manage_channel_${ch.id}`).row();
      }
    }

    keyboard.text(context.t('wallet_btn'), 'wallet').row();
    keyboard.text(context.t('add_channel_btn'), 'add_channel_info').row();
    keyboard.text(context.t('bundles_btn'), 'manage_bundles').row();
    keyboard.text(context.t('main_menu_btn'), 'main_menu').row();

    await ctx.reply(text, { reply_markup: keyboard, parse_mode: 'Markdown' });
  } catch (e: any) {
    console.error(e);
    await ctx.reply(`${context.t('error_loading')}: ${e.message || e}`);
  }
});

composer.callbackQuery(/manage_channel_(\d+)/, async ctx => {
  const context = ctx as MyContextWithI18n;
  const channelId = parseInt(ctx.match[1]);
  await ctx.answerCallbackQuery();

  const creator = await creatorService.registerCreator(BigInt(ctx.from!.id));
  const channel = creator.channels.find(c => c.id === channelId);

  if (!channel) return ctx.reply(context.t('channel_not_found'));

  const text = context.t('manage_channel_title', { title: channel.title });
  const keyboard = new InlineKeyboard()
    .text(context.t('add_plan_btn'), `create_plan_${channelId}`)
    .row()
    .text(context.t('add_hourly_plan_btn'), `create_hourly_plan_${channelId}`)
    .row()
    .text(context.t('edit_plans_btn'), `manage_plans_${channelId}`)
    .row()
    .text(context.t('get_link_btn'), `get_link_${channelId}`)
    .row()
    .text(context.t('preview_settings_btn'), `preview_settings_${channelId}`)
    .row()
    .text(context.t('back_dashboard_btn'), 'dashboard');

  await ctx.editMessageText(text, {
    reply_markup: keyboard,
    parse_mode: 'Markdown',
  });
});

composer.callbackQuery(/manage_plans_(\d+)/, async ctx => {
  const context = ctx as MyContextWithI18n;
  const channelId = parseInt(ctx.match[1]);
  await ctx.answerCallbackQuery();

  try {
    const creator = await creatorService.registerCreator(BigInt(ctx.from!.id));
    const channel = await subService.getChannelDetails(channelId);
    if (!channel || channel.creatorId !== creator.id) {
      return ctx.reply(context.t('channel_not_found'));
    }

    let text = context.t('plans_manage_title', { title: channel.title });
    const keyboard = new InlineKeyboard();

    if (!channel.plans || channel.plans.length === 0) {
      text += `\n\n${context.t('no_plans_manage')}`;
    } else {
      for (const plan of channel.plans) {
        keyboard.text(`🏷 ${plan.name}`, `edit_plan_${plan.id}`).row();
      }
    }

    keyboard.text(context.t('back_dashboard_btn'), `manage_channel_${channelId}`);

    await ctx.editMessageText(text, {
      reply_markup: keyboard,
      parse_mode: 'Markdown',
    });
  } catch (e) {
    console.error(e);
    await ctx.reply(context.t('error_loading'));
  }
});

composer.callbackQuery(/edit_plan_(\d+)/, async ctx => {
  const context = ctx as MyContextWithI18n;
  const planId = parseInt(ctx.match[1]);
  await ctx.answerCallbackQuery();

  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id: planId },
  });
  const durationUnit = plan?.durationMin ? 'minutes' : 'days';

  ctx.session.step = 'editing_plan_name';
  ctx.session.tempEditPlan = { planId, durationUnit };
  await ctx.reply(context.t('edit_plan_name_prompt'), { parse_mode: 'Markdown' });
});

composer.callbackQuery('create_free_channel', async ctx => {
  const context = ctx as MyContextWithI18n;
  await ctx.answerCallbackQuery();
  ctx.session.step = 'creating_free_channel';
  await ctx.reply(context.t('free_channel_create_prompt'), {
    parse_mode: 'Markdown',
  });
});

composer.callbackQuery('dashboard', async ctx => {
  const context = ctx as MyContextWithI18n;
  await ctx.answerCallbackQuery();

  const creator = await creatorService.registerCreator(BigInt(ctx.from!.id));
  const channels = creator.channels || [];

  let text = context.t('creator_dashboard_title');
  const keyboard = new InlineKeyboard();

  if (channels.length === 0) {
    text += context.t('no_channels');
  } else {
    text += context.t('select_channel');
    for (const ch of channels) {
      keyboard.text(`📺 ${ch.title}`, `manage_channel_${ch.id}`).row();
    }
  }

  keyboard.text(context.t('wallet_btn'), 'wallet').row();
  keyboard.text(context.t('analytics_btn'), 'analytics').row();
  keyboard.text(context.t('manage_partners_btn'), 'manage_partners').row();
  keyboard.text(context.t('free_channel_create_btn'), 'create_free_channel').row();
  keyboard.text(context.t('add_channel_btn'), 'add_channel_info').row();
  keyboard.text(context.t('bundles_btn'), 'manage_bundles').row();
  keyboard.text(context.t('main_menu_btn'), 'main_menu').row();

  await ctx.editMessageText(text, {
    reply_markup: keyboard,
    parse_mode: 'Markdown',
  });
});

composer.callbackQuery('manage_partners', async ctx => {
  const context = ctx as MyContextWithI18n;
  await ctx.answerCallbackQuery();

  try {
    const requests = await creatorService.getPartnerRequests(
      BigInt(ctx.from!.id)
    );

    let text = context.t('partners_list_title');
    if (requests.length === 0) {
      text = context.t('no_partner_requests');
    }

    const keyboard = new InlineKeyboard();
    for (const req of requests) {
      const label = context.t('partner_request_item', {
        name: req.user.firstName || 'User',
        username: req.user.username || req.user.id.toString(),
      });
      keyboard
        .text(`${label} (${req.channel.title})`, `view_partner_req_${req.id}`)
        .row();
    }
    keyboard.text(context.t('back_dashboard_btn'), 'dashboard');

    await ctx.editMessageText(text, {
      reply_markup: keyboard,
      parse_mode: 'Markdown',
    });
  } catch (e) {
    console.error(e);
    await ctx.reply(context.t('error_loading'));
  }
});

composer.callbackQuery('manage_bundles', async ctx => {
  const context = ctx as MyContextWithI18n;
  await ctx.answerCallbackQuery();

  try {
    const bundles = await creatorService.listBundles(BigInt(ctx.from!.id));

    let text = context.t('bundles_title');
    if (bundles.length === 0) {
      text = context.t('no_bundles');
    }

    const keyboard = new InlineKeyboard();
    for (const bundle of bundles) {
      keyboard.text(`📦 ${bundle.title}`, `manage_bundle_${bundle.id}`).row();
    }

    keyboard.text(context.t('create_bundle_btn'), 'create_bundle').row();
    keyboard.text(context.t('back_dashboard_btn'), 'dashboard');

    await ctx.editMessageText(text, {
      reply_markup: keyboard,
      parse_mode: 'Markdown',
    });
  } catch (e) {
    console.error(e);
    await ctx.reply(context.t('error_loading'));
  }
});

composer.callbackQuery('create_bundle', async ctx => {
  const context = ctx as MyContextWithI18n;
  await ctx.answerCallbackQuery();
  ctx.session.step = 'creating_bundle_title';
  await ctx.reply(context.t('bundle_create_prompt'), { parse_mode: 'Markdown' });
});

composer.callbackQuery(/manage_bundle_(\d+)/, async ctx => {
  const context = ctx as MyContextWithI18n;
  const bundleId = parseInt(ctx.match[1]);
  await ctx.answerCallbackQuery();

  try {
    const bundle = await creatorService.getBundle(
      BigInt(ctx.from!.id),
      bundleId
    );

    let text = context.t('bundle_details_title', {
      title: bundle.title,
      channels: bundle.channels.length.toLocaleString(),
      plans: bundle.plans.length.toLocaleString(),
    });

    if (bundle.channels.length > 0) {
      text += `\n\n${context.t('bundle_channels_title')}`;
      for (const item of bundle.channels) {
        text += `\n- ${item.channel.title}`;
      }
    }

    if (bundle.folderLink) {
      text += `\n\n${context.t('bundle_folder_link', {
        link: bundle.folderLink,
      })}`;
    }

    const keyboard = new InlineKeyboard()
      .text(context.t('bundle_add_channel_btn'), `bundle_add_channel_${bundleId}`)
      .row()
      .text(context.t('bundle_set_folder_btn'), `bundle_set_folder_${bundleId}`)
      .row()
      .text(context.t('bundle_add_plan_btn'), `bundle_add_plan_${bundleId}`)
      .row()
      .text(context.t('bundle_get_link_btn'), `bundle_get_link_${bundleId}`)
      .row()
      .text(context.t('back_dashboard_btn'), 'manage_bundles');

    await ctx.editMessageText(text, {
      reply_markup: keyboard,
      parse_mode: 'Markdown',
    });
  } catch (e) {
    console.error(e);
    await ctx.reply(context.t('error_loading'));
  }
});

composer.callbackQuery(/^bundle_add_channel_(\d+)$/, async ctx => {
  const context = ctx as MyContextWithI18n;
  const bundleId = parseInt(ctx.match[1]);
  await ctx.answerCallbackQuery();

  try {
    const creator = await creatorService.registerCreator(BigInt(ctx.from!.id));
    const channels = creator.channels || [];

    let text = context.t('bundle_add_channel_title');
    const keyboard = new InlineKeyboard();

    if (channels.length === 0) {
      text = context.t('no_channels');
    } else {
      for (const ch of channels) {
        keyboard
          .text(`📺 ${ch.title}`, `bundle_add_channel_${bundleId}_${ch.id}`)
          .row();
      }
    }

    keyboard.text(context.t('back_dashboard_btn'), `manage_bundle_${bundleId}`);

    await ctx.editMessageText(text, {
      reply_markup: keyboard,
      parse_mode: 'Markdown',
    });
  } catch (e) {
    console.error(e);
    await ctx.reply(context.t('error_loading'));
  }
});

composer.callbackQuery(/^bundle_add_channel_(\d+)_(\d+)$/, async ctx => {
  const context = ctx as MyContextWithI18n;
  const bundleId = parseInt(ctx.match[1]);
  const channelId = parseInt(ctx.match[2]);
  await ctx.answerCallbackQuery();

  try {
    await creatorService.addChannelToBundle(
      BigInt(ctx.from!.id),
      bundleId,
      channelId
    );
    await ctx.reply(context.t('bundle_channel_added'));
    await ctx.reply(context.t('bundle_admin_reminder'));
    await ctx.api.sendMessage(ctx.chat!.id, context.t('bundle_manage_hint'), {
      reply_markup: new InlineKeyboard().text(
        context.t('back_dashboard_btn'),
        `manage_bundle_${bundleId}`
      ),
    });
  } catch (e) {
    console.error(e);
    await ctx.reply(context.t('error_loading'));
  }
});

composer.callbackQuery(/bundle_set_folder_(\d+)/, async ctx => {
  const context = ctx as MyContextWithI18n;
  const bundleId = parseInt(ctx.match[1]);
  await ctx.answerCallbackQuery();
  ctx.session.step = 'setting_bundle_folder';
  ctx.session.tempBundle = { bundleId };
  await ctx.reply(context.t('bundle_set_folder_prompt'));
});

composer.callbackQuery(/bundle_add_plan_(\d+)/, async ctx => {
  const context = ctx as MyContextWithI18n;
  const bundleId = parseInt(ctx.match[1]);
  await ctx.answerCallbackQuery();
  ctx.session.step = 'creating_bundle_plan_name';
  ctx.session.tempBundlePlan = { bundleId };
  await ctx.reply(context.t('bundle_plan_name_prompt'));
});

composer.callbackQuery(/bundle_get_link_(\d+)/, async ctx => {
  const context = ctx as MyContextWithI18n;
  const bundleId = parseInt(ctx.match[1]);
  await ctx.answerCallbackQuery();
  const me = await ctx.api.getMe();
  const link = `https://t.me/${me.username}?start=b_${bundleId}`;

  try {
    const bundle = await creatorService.getBundle(
      BigInt(ctx.from!.id),
      bundleId
    );

    let text = context.t('bundle_link_title', { link });
    if (bundle.folderLink) {
      text += `\n\n${context.t('bundle_folder_link', {
        link: bundle.folderLink,
      })}`;
    }

    await ctx.reply(text, {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard().text(
        context.t('back_dashboard_btn'),
        `manage_bundle_${bundleId}`
      ),
    });
  } catch (e) {
    console.error(e);
    await ctx.reply(context.t('error_loading'));
  }
});

composer.callbackQuery(/view_partner_req_(\d+)/, async ctx => {
  const context = ctx as MyContextWithI18n;
  const partnerId = parseInt(ctx.match[1]);
  await ctx.answerCallbackQuery();

  const keyboard = new InlineKeyboard()
    .text(context.t('approve_btn'), `approve_partner_${partnerId}`)
    .text(context.t('reject_btn'), `reject_partner_${partnerId}`)
    .row()
    .text(context.t('back_dashboard_btn'), 'manage_partners');

  await ctx.editMessageText('Choose action:', { reply_markup: keyboard });
});

composer.callbackQuery(/approve_partner_(\d+)/, async ctx => {
  const context = ctx as MyContextWithI18n;
  const partnerId = parseInt(ctx.match[1]);
  await ctx.answerCallbackQuery();

  try {
    const partner = await creatorService.approvePartner(
      BigInt(ctx.from!.id),
      partnerId
    );
    await ctx.editMessageText(context.t('partner_approved'), {
      reply_markup: new InlineKeyboard().text(
        context.t('back_dashboard_btn'),
        'manage_partners'
      ),
    });

    // Notify Partner
    const channel = await subService.getChannelDetails(partner.channelId);
    const me = await ctx.api.getMe();
    const link = `https://t.me/${me.username}?start=c_${partner.channelId}_ref_${partner.user.telegramId}`;

    try {
      await ctx.api.sendMessage(
        Number(partner.user.telegramId),
        context.t('partner_link_msg', {
          channel: channel?.title || 'Channel',
          link,
        }),
        { parse_mode: 'Markdown' }
      );
    } catch (notifyError) {
      console.error('Failed to notify partner:', notifyError);
    }
  } catch (e) {
    console.error(e);
    await ctx.reply(context.t('error_loading'));
  }
});

composer.callbackQuery(/reject_partner_(\d+)/, async ctx => {
  const context = ctx as MyContextWithI18n;
  const partnerId = parseInt(ctx.match[1]);
  await ctx.answerCallbackQuery();

  try {
    await creatorService.rejectPartner(BigInt(ctx.from!.id), partnerId);
    await ctx.editMessageText(context.t('partner_rejected'), {
      reply_markup: new InlineKeyboard().text(
        context.t('back_dashboard_btn'),
        'manage_partners'
      ),
    });
  } catch (e) {
    console.error(e);
    await ctx.reply(context.t('error_loading'));
  }
});

composer.callbackQuery('analytics', async ctx => {
  const context = ctx as MyContextWithI18n;
  await ctx.answerCallbackQuery();

  try {
    const stats = await creatorService.getAnalytics(BigInt(ctx.from!.id));
    const text = context.t('analytics_title', {
      revenue: stats.totalRevenue.toLocaleString(),
      active: stats.activeSubscribers.toLocaleString(),
      churn: stats.totalChurn.toLocaleString(),
      new_today: stats.newSubscribersToday.toLocaleString(),
      ref_count: stats.partnerConversions.toLocaleString(),
      ref_payouts: stats.partnerPayouts.toLocaleString(),
    });

    const keyboard = new InlineKeyboard().text(
      context.t('back_dashboard_btn'),
      'dashboard'
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

composer.callbackQuery('add_channel_info', async ctx => {
  const context = ctx as MyContextWithI18n;
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(context.t('no_channels'), {
    parse_mode: 'Markdown',
    reply_markup: new InlineKeyboard().text(
      context.t('back_dashboard_btn'),
      'dashboard'
    ),
  });
});

composer.callbackQuery('wallet', async ctx => {
  const context = ctx as MyContextWithI18n;
  await ctx.answerCallbackQuery();

  try {
    const balance = await creatorService.getBalance(BigInt(ctx.from!.id));
    const history = await creatorService.getRecentPayouts(
      BigInt(ctx.from!.id),
      7
    );

    let text = context.t('wallet_title', { amount: balance.toLocaleString() });

    if (history.length > 0) {
      text += '\n\n📋 **Recent Payouts (Last 7 days):**\n';
      for (const p of history) {
        const statusIcon =
          p.status === 'PAID' ? '✅' : p.status === 'REJECTED' ? '❌' : '⏳';
        text += `${statusIcon} ${p.amount.toLocaleString()} UZS (${p.status}) - ${p.requestedAt.toLocaleDateString()}\n`;
      }
    }

    const keyboard = new InlineKeyboard()
      .text(context.t('withdraw_btn'), 'withdraw_start')
      .row()
      .text(context.t('payout_history_btn'), 'payout_history')
      .row()
      .text(context.t('back_dashboard_btn'), 'dashboard');

    await ctx.editMessageText(text, {
      reply_markup: keyboard,
      parse_mode: 'Markdown',
    });
  } catch (e) {
    console.error(e);
    await ctx.reply(context.t('error_loading'));
  }
});

composer.callbackQuery('payout_history', async ctx => {
  const context = ctx as MyContextWithI18n;
  await ctx.answerCallbackQuery();

  try {
    const history = await creatorService.getPayoutHistory(BigInt(ctx.from!.id));

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
      'wallet'
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

composer.callbackQuery('withdraw_start', async ctx => {
  const context = ctx as MyContextWithI18n;
  await ctx.answerCallbackQuery();

  const balance = await creatorService.getBalance(BigInt(ctx.from!.id));
  if (balance <= 0) {
    await ctx.reply(context.t('insufficient_balance'));
    return;
  }

  ctx.session.step = 'withdrawing_amount';
  await ctx.reply(context.t('enter_withdraw_amount'));
});

composer.callbackQuery(/get_link_(\d+)/, async ctx => {
  const context = ctx as MyContextWithI18n;
  const channelId = ctx.match[1];
  await ctx.answerCallbackQuery();
  const me = await ctx.api.getMe();
  const link = `https://t.me/${me.username}?start=c_${channelId}`;

  await ctx.reply(context.t('your_link_title', { link }), {
    parse_mode: 'Markdown',
    reply_markup: new InlineKeyboard().text(
      context.t('back_dashboard_btn'),
      `manage_channel_${channelId}`
    ),
  });
});

composer.callbackQuery(/preview_settings_(\d+)/, async ctx => {
  const context = ctx as MyContextWithI18n;
  const channelId = parseInt(ctx.match[1]);
  await ctx.answerCallbackQuery();

  const creator = await creatorService.registerCreator(BigInt(ctx.from!.id));
  const channel = creator.channels.find(c => c.id === channelId);
  if (!channel) return ctx.reply(context.t('channel_not_found'));

  const status = channel.previewEnabled
    ? context.t('preview_status_on')
    : context.t('preview_status_off');
  const minutes = channel.previewDurationMin || 0;

  const text = context.t('preview_settings_title', { status, minutes });
  const keyboard = new InlineKeyboard()
    .text(context.t('preview_set_btn'), `preview_set_${channelId}`)
    .row();

  if (channel.previewEnabled) {
    keyboard
      .text(context.t('preview_disable_btn'), `preview_disable_${channelId}`)
      .row();
  }

  keyboard.text(context.t('back_dashboard_btn'), `manage_channel_${channelId}`);

  await ctx.editMessageText(text, {
    reply_markup: keyboard,
    parse_mode: 'Markdown',
  });
});

composer.callbackQuery(/preview_set_(\d+)/, async ctx => {
  const context = ctx as MyContextWithI18n;
  const channelId = parseInt(ctx.match[1]);
  await ctx.answerCallbackQuery();

  ctx.session.step = 'setting_preview_minutes';
  ctx.session.tempPreview = { channelId };

  await ctx.reply(context.t('preview_enter_minutes'), {
    parse_mode: 'Markdown',
  });
});

composer.callbackQuery(/preview_disable_(\d+)/, async ctx => {
  const context = ctx as MyContextWithI18n;
  const channelId = parseInt(ctx.match[1]);
  await ctx.answerCallbackQuery();

  try {
    await creatorService.updatePreviewSettings(
      BigInt(ctx.from!.id),
      channelId,
      false
    );

    await ctx.editMessageText(context.t('preview_disabled_msg'), {
      reply_markup: new InlineKeyboard().text(
        context.t('back_dashboard_btn'),
        `manage_channel_${channelId}`
      ),
    });
  } catch (e) {
    console.error(e);
    await ctx.reply(context.t('error_loading'));
  }
});

composer.command('register', async ctx => {
  const context = ctx as MyContextWithI18n;
  if (!ctx.from) return;
  try {
    await creatorService.registerCreator(
      BigInt(ctx.from.id),
      ctx.from.username,
      ctx.from.first_name,
      ctx.from.last_name
    );
    await ctx.reply(context.t('reg_success'), {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard().text(
        context.t('go_dashboard_btn'),
        'dashboard'
      ),
    });
  } catch (e: any) {
    console.error(e);
    await ctx.reply(`${context.t('error_loading')}: ${e.message || e}`);
  }
});

// Handle forwarded messages to register channel
composer.on('message:forward_origin:channel', async ctx => {
  const context = ctx as MyContextWithI18n;
  if (!ctx.from) return;
  // We know it's a channel due to filter
  const origin = ctx.message.forward_origin as any;
  const channelId = origin.chat.id;
  const title = origin.chat.title || 'Untitled Channel';

  try {
    // Verify admin rights
    let isAdmin = false;
    try {
      const admins = await ctx.api.getChatAdministrators(channelId);
      const me = await ctx.api.getMe();
      isAdmin = admins.some(a => a.user.id === me.id);
    } catch (adminErr: any) {
      if (adminErr.description?.includes('bot is not a member')) {
        await ctx.reply(context.t('not_admin'));
        return;
      }
      throw adminErr;
    }

    if (!isAdmin) {
      await ctx.reply(context.t('not_admin'));
      return;
    }

    // Register
    const creator = await creatorService.registerCreator(
      BigInt(ctx.from.id),
      ctx.from.username,
      ctx.from.first_name,
      ctx.from.last_name
    );
    if (!creator) throw new Error('Could not register creator.');

    const existed = creator.channels.some(
      (c: any) => Number(c.telegramChannelId) === Number(channelId)
    );

    const channel = await creatorService.registerChannel(
      creator.userId,
      BigInt(channelId),
      title
    );

    if (ctx.session.step === 'creating_free_channel') {
      if (existed) {
        await ctx.reply(context.t('free_channel_already_registered'));
        ctx.session.step = undefined;
        return;
      }
      try {
        await creatorService.setFreeChannel(BigInt(ctx.from.id), channel.id);
        await ctx.reply(context.t('free_channel_created', { title }), {
          parse_mode: 'Markdown',
        });
        await ctx.reply(context.t('free_channel_note'));
      } catch (e: any) {
        if (e?.message === 'FREE_CHANNEL_EXISTS') {
          await ctx.reply(context.t('free_channel_exists'));
        } else {
          throw e;
        }
      } finally {
        ctx.session.step = undefined;
      }
      return;
    }

    const keyboard = new InlineKeyboard()
      .text(context.t('add_plan_btn'), `create_plan_${channel.id}`)
      .row()
      .text(context.t('go_dashboard_btn'), 'dashboard');

    await ctx.reply(context.t('channel_reg_success', { title }), {
      reply_markup: keyboard,
    });
  } catch (e) {
    console.error(e);
    await ctx.reply(`${context.t('error_loading')}: ${(e as Error).message}`);
  }
});

composer.callbackQuery(/create_plan_(\d+)/, async ctx => {
  const context = ctx as MyContextWithI18n;
  const channelId = parseInt(ctx.match[1]);
  await ctx.answerCallbackQuery();

  ctx.session.step = 'creating_plan_name';
  ctx.session.tempPlan = { channelId, durationUnit: 'days' };
  await ctx.reply(context.t('create_plan_title'), { parse_mode: 'Markdown' });
});

composer.callbackQuery(/create_hourly_plan_(\d+)/, async ctx => {
  const context = ctx as MyContextWithI18n;
  const channelId = parseInt(ctx.match[1]);
  await ctx.answerCallbackQuery();

  ctx.session.step = 'creating_plan_name';
  ctx.session.tempPlan = { channelId, durationUnit: 'minutes' };
  await ctx.reply(context.t('create_hourly_plan_title'), {
    parse_mode: 'Markdown',
  });
});

composer.on('message:text', async (ctx, next) => {
  const context = ctx as MyContextWithI18n;
  const step = ctx.session.step;
  if (!step) return next();

  if (step === 'creating_plan_name') {
    ctx.session.tempPlan!.name = ctx.message.text;
    ctx.session.step = 'creating_plan_price';
    await ctx.reply(context.t('enter_price'));
    return;
  }

  if (step === 'editing_plan_name') {
    const text = ctx.message.text.trim();
    ctx.session.tempEditPlan!.name =
      text === '-' || text.toLowerCase() === 'skip' ? null : text;
    ctx.session.step = 'editing_plan_price';
    await ctx.reply(context.t('edit_plan_price_prompt'), {
      parse_mode: 'Markdown',
    });
    return;
  }

  if (step === 'creating_bundle_title') {
    const title = ctx.message.text.trim();
    if (!title) return ctx.reply(context.t('invalid_text'));

    try {
      const bundle = await creatorService.createBundle(
        BigInt(ctx.from!.id),
        title
      );
      ctx.session.step = undefined;
      ctx.session.tempBundle = undefined;

      const keyboard = new InlineKeyboard()
        .text(context.t('bundle_manage_btn'), `manage_bundle_${bundle.id}`)
        .row()
        .text(context.t('back_dashboard_btn'), 'manage_bundles');

      await ctx.reply(context.t('bundle_created', { title }), {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    } catch (e: any) {
      if (e?.message === 'MIN_PRICE') {
        await ctx.reply(context.t('min_plan_price_error'));
      } else if (e?.message === 'MIN_DAYS') {
        await ctx.reply(context.t('min_plan_days_error'));
      } else if (e?.message === 'MIN_MAX_MINUTES') {
        await ctx.reply(context.t('min_max_minutes_error'));
      } else {
        console.error(e);
        await ctx.reply(context.t('error_loading'));
      }
    }
    return;
  }

  if (step === 'creating_plan_price') {
    const price = parseInt(ctx.message.text);
    if (isNaN(price)) return ctx.reply(context.t('invalid_number'));
    ctx.session.tempPlan!.price = price;
    ctx.session.step = 'creating_plan_duration';
    if (ctx.session.tempPlan?.durationUnit === 'minutes') {
      await ctx.reply(context.t('enter_duration_minutes'), {
        parse_mode: 'Markdown',
      });
    } else {
      await ctx.reply(context.t('enter_duration'));
    }
    return;
  }

  if (step === 'editing_plan_price') {
    const text = ctx.message.text.trim();
    if (text === '-' || text.toLowerCase() === 'skip') {
      ctx.session.tempEditPlan!.price = null;
    } else {
      const price = parseInt(text);
      if (isNaN(price)) return ctx.reply(context.t('invalid_number'));
      if (price < 1000)
        return ctx.reply(context.t('min_plan_price_error'), {
          parse_mode: 'Markdown',
        });
      ctx.session.tempEditPlan!.price = price;
    }
    ctx.session.step = 'editing_plan_duration';
    const durationKey =
      ctx.session.tempEditPlan?.durationUnit === 'minutes'
        ? 'edit_plan_duration_minutes_prompt'
        : 'edit_plan_duration_prompt';
    await ctx.reply(context.t(durationKey), { parse_mode: 'Markdown' });
    return;
  }

  if (step === 'creating_plan_duration') {
    const plan = ctx.session.tempPlan!;
    const isMinutes = plan.durationUnit === 'minutes';
    const value = isMinutes
      ? parseDurationMinutesInput(ctx.message.text)
      : parseInt(ctx.message.text);

    if (value === null || Number.isNaN(value)) {
      return ctx.reply(context.t('invalid_number'));
    }

    // Save Plan using service
    try {
      const newPlan = await creatorService.createPlan(
        plan.channelId!,
        plan.name!,
        plan.price!,
        value,
        isMinutes ? 'minutes' : 'days'
      );

      const me = await ctx.api.getMe();
      const link = `https://t.me/${me.username}?start=c_${plan.channelId}`;

      const messageKey = isMinutes
        ? 'plan_created_minutes'
        : 'plan_created';

      await ctx.reply(
        context.t(messageKey, {
          name: newPlan.name,
          price: newPlan.price.toLocaleString(),
          days: value,
          minutes: value,
          link,
        }),
        {
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard().text(
            context.t('go_dashboard_btn'),
            'dashboard'
          ),
        }
      );
    } catch (e: any) {
      if (e?.message === 'MIN_PRICE') {
        await ctx.reply(context.t('min_plan_price_error'));
      } else if (e?.message === 'MIN_DAYS') {
        await ctx.reply(context.t('min_plan_days_error'));
      } else if (e?.message === 'MIN_MAX_MINUTES') {
        await ctx.reply(context.t('min_max_minutes_error'));
      } else {
        console.error(e);
        await ctx.reply(context.t('error_loading'));
      }
    }

    ctx.session.step = undefined;
    ctx.session.tempPlan = undefined;
    return;
  }

  if (step === 'editing_plan_duration') {
    const text = ctx.message.text.trim();
    if (text === '-' || text.toLowerCase() === 'skip') {
      ctx.session.tempEditPlan!.duration = null;
    } else {
      if (ctx.session.tempEditPlan?.durationUnit === 'minutes') {
        const minutes = parseDurationMinutesInput(text);
        if (minutes === null || Number.isNaN(minutes)) {
          return ctx.reply(context.t('invalid_number'));
        }
        ctx.session.tempEditPlan!.duration = minutes;
      } else {
        const days = parseInt(text);
        if (isNaN(days)) return ctx.reply(context.t('invalid_number'));
        ctx.session.tempEditPlan!.duration = days;
      }
    }

    const payload = ctx.session.tempEditPlan!;
    if (!payload.planId) return ctx.reply(context.t('error_loading'));

    try {
      const updatedPlan = await creatorService.updatePlan(
        BigInt(ctx.from!.id),
        payload.planId,
        {
          name: payload.name ?? undefined,
          price: payload.price ?? undefined,
          durationDay:
            payload.durationUnit === 'minutes' ? undefined : payload.duration ?? undefined,
          durationMin:
            payload.durationUnit === 'minutes' ? payload.duration ?? undefined : undefined,
        }
      );
      await ctx.reply(context.t('plan_updated'), { parse_mode: 'Markdown' });
      await ctx.reply(context.t('plan_update_note'), { parse_mode: 'Markdown' });

      const subs = await prisma.subscription.findMany({
        where: {
          planId: updatedPlan.id,
          status: 'ACTIVE',
          endDate: { gt: new Date() },
        },
        include: { user: true },
      });

      for (const sub of subs) {
        const lang = (sub.user.language as any) || 'en';
        const durationText =
          updatedPlan.durationMin && updatedPlan.durationMin > 0
            ? t(lang, 'duration_minutes_value', {
                minutes: updatedPlan.durationMin.toLocaleString(),
              })
            : t(lang, 'duration_days_value', {
                days: (updatedPlan.durationDay ?? 0).toLocaleString(),
              });
        const message = t(lang, 'plan_updated_notify', {
          name: updatedPlan.name,
          price: updatedPlan.price.toLocaleString(),
          duration: durationText,
        });
        try {
          await ctx.api.sendMessage(Number(sub.user.telegramId), message, {
            parse_mode: 'Markdown',
          });
        } catch (err) {
          console.error('Failed to notify subscriber:', err);
        }
      }
    } catch (e) {
      console.error(e);
      await ctx.reply(context.t('error_loading'));
    }

    ctx.session.step = undefined;
    ctx.session.tempEditPlan = undefined;
    return;
  }

  if (step === 'creating_bundle_plan_name') {
    ctx.session.tempBundlePlan!.name = ctx.message.text;
    ctx.session.step = 'creating_bundle_plan_price';
    await ctx.reply(context.t('enter_price'));
    return;
  }

  if (step === 'creating_bundle_plan_price') {
    const price = parseInt(ctx.message.text);
    if (isNaN(price)) return ctx.reply(context.t('invalid_number'));
    ctx.session.tempBundlePlan!.price = price;
    ctx.session.step = 'creating_bundle_plan_duration';
    await ctx.reply(context.t('enter_duration'));
    return;
  }

  if (step === 'creating_bundle_plan_duration') {
    const days = parseInt(ctx.message.text);
    if (isNaN(days)) return ctx.reply(context.t('invalid_number'));

    const plan = ctx.session.tempBundlePlan!;
    if (!plan.bundleId) return ctx.reply(context.t('error_loading'));

    try {
      await creatorService.createBundlePlan(
        BigInt(ctx.from!.id),
        plan.bundleId,
        plan.name!,
        plan.price!,
        days
      );
      await ctx.reply(context.t('bundle_plan_created'), {
        reply_markup: new InlineKeyboard().text(
          context.t('back_dashboard_btn'),
          `manage_bundle_${plan.bundleId}`
        ),
      });
    } catch (e: any) {
      if (e?.message === 'MIN_PRICE') {
        await ctx.reply(context.t('min_plan_price_error'));
      } else if (e?.message === 'MIN_DAYS') {
        await ctx.reply(context.t('min_plan_days_error'));
      } else {
        console.error(e);
        await ctx.reply(context.t('error_loading'));
      }
    }

    ctx.session.step = undefined;
    ctx.session.tempBundlePlan = undefined;
    return;
  }

  if (step === 'setting_bundle_folder') {
    const link = ctx.message.text.trim();
    if (!link) return ctx.reply(context.t('invalid_text'));

    const bundleId = ctx.session.tempBundle?.bundleId;
    if (!bundleId) return ctx.reply(context.t('error_loading'));

    try {
      await creatorService.setBundleFolderLink(
        BigInt(ctx.from!.id),
        bundleId,
        link
      );
      await ctx.reply(context.t('bundle_folder_saved'));
      await ctx.reply(context.t('bundle_admin_reminder'));
      await ctx.reply(context.t('bundle_cooldown_reminder'));
    } catch (e) {
      console.error(e);
      await ctx.reply(context.t('error_loading'));
    }

    ctx.session.step = undefined;
    ctx.session.tempBundle = undefined;
    return;
  }

  if (step === 'setting_preview_minutes') {
    const minutes = parseInt(ctx.message.text);
    if (isNaN(minutes) || minutes < 1 || minutes > 15) {
      return ctx.reply(context.t('preview_invalid_minutes'));
    }

    const channelId = ctx.session.tempPreview?.channelId;
    if (!channelId) {
      ctx.session.step = undefined;
      ctx.session.tempPreview = undefined;
      return ctx.reply(context.t('error_loading'));
    }

    try {
      await creatorService.updatePreviewSettings(
        BigInt(ctx.from!.id),
        channelId,
        true,
        minutes
      );

      await ctx.reply(context.t('preview_updated', { minutes }), {
        reply_markup: new InlineKeyboard().text(
          context.t('back_dashboard_btn'),
          `manage_channel_${channelId}`
        ),
      });
    } catch (e: any) {
      if (e.message === 'INVALID_PREVIEW_DURATION') {
        await ctx.reply(context.t('preview_invalid_minutes'));
      } else {
        await ctx.reply(context.t('error_loading'));
      }
    }

    ctx.session.step = undefined;
    ctx.session.tempPreview = undefined;
    return;
  }

  if (step === 'withdrawing_amount') {
    const amount = parseInt(ctx.message.text);
    if (isNaN(amount) || amount <= 0)
      return ctx.reply(context.t('invalid_number'));

    if (amount < 10000) {
      return ctx.reply(context.t('min_withdrawal_error'));
    }

    const balance = await creatorService.getBalance(BigInt(ctx.from!.id));
    if (amount > balance) return ctx.reply(context.t('insufficient_balance'));

    ctx.session.withdrawAmount = amount;
    ctx.session.step = 'withdrawing_card';
    await ctx.reply(context.t('enter_card_number'));
    return;
  }

  if (step === 'withdrawing_card') {
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
            'dashboard'
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

composer.command('balance', async ctx => {
  const context = ctx as MyContextWithI18n;
  if (!ctx.from) return;
  try {
    const balance = await creatorService.getBalance(BigInt(ctx.from.id));
    await ctx.reply(
      context.t('wallet_title', { amount: balance.toLocaleString() }),
      { parse_mode: 'Markdown' }
    );
  } catch (e) {
    console.error(e);
    await ctx.reply(context.t('error_loading'));
  }
});

composer.command('withdraw', async ctx => {
  const context = ctx as MyContextWithI18n;
  const balance = await creatorService.getBalance(BigInt(ctx.from!.id));
  if (balance <= 0) {
    await ctx.reply(context.t('insufficient_balance'));
    return;
  }
  ctx.session.step = 'withdrawing_amount';
  await ctx.reply(context.t('enter_withdraw_amount'));
});

composer.command('payouts', async ctx => {
  const context = ctx as MyContextWithI18n;
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
      'wallet'
    );

    await ctx.reply(text, { reply_markup: keyboard, parse_mode: 'Markdown' });
  } catch (e) {
    console.error(e);
    await ctx.reply(context.t('error_loading'));
  }
});

export const creatorHandler = composer;
