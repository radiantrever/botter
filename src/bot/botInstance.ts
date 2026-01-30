import { Bot } from 'grammy';
import { MyContext } from './context';
import dotenv from 'dotenv';

dotenv.config();

const botToken = process.env.BOT_TOKEN;
if (!botToken) {
    throw new Error("BOT_TOKEN is missing in environment variables");
}

export const bot = new Bot<MyContext>(botToken);
