import logging
import sqlite3
from aiogram import Bot, Dispatcher, executor, types
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from tspay import TsPayClient

client = TsPayClient()

API_TOKEN = "8024024329:token"
CHANNEL_URL = "https://t.me/username"
AMOUNT = 1000  # to'lov summasi (so'mda)


email = "" #Emailingizni kiriting
password = "" #Parolingizni kiriting
login = client.get_access_token(email, password)

# === DATABASE ===
conn = sqlite3.connect("users.db", check_same_thread=False)
cursor = conn.cursor()
cursor.execute("""
CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY,
    transaction_id TEXT,
    paid INTEGER DEFAULT 0
)
""")
conn.commit()

# === LOGGER ===
logging.basicConfig(level=logging.INFO)

# === BOT ===
bot = Bot(token=API_TOKEN)
dp = Dispatcher(bot)


# === HANDLERS ===
@dp.message_handler(commands=['start'])
async def start_handler(message: types.Message):
    user_id = message.from_user.id
    shop_access_token = client.get_user_shops(login)

    cursor.execute("SELECT paid FROM users WHERE user_id=?", (user_id,))
    row = cursor.fetchone()

    if row and row[0] == 1:
        await message.answer(f"Siz allaqachon to‘lov qilgansiz ✅\nKanalga kirish → {CHANNEL_URL}")
        return

    transaction = client.create_transaction(
        amount=1000,
        redirect_url="https://example.com/callback",
        comment="Kanalga qo‘shilish to‘lovi",
        access_token=shop_access_token[0]['access_token']  # Kerakli do'kon access_tokeni
    )

    # DB ga yozamiz
    cursor.execute("INSERT OR REPLACE INTO users (user_id, transaction_id, paid) VALUES (?, ?, ?)",
                   (user_id, transaction['cheque_id'], 0))
    conn.commit()

    # Inline tugmalar
    markup = InlineKeyboardMarkup()
    markup.add(InlineKeyboardButton("💳 To‘lov qilish", url=transaction['payment_url']))
    markup.add(InlineKeyboardButton("✅ To‘lov qildim", callback_data=f"check_{transaction['cheque_id']}"))

    await message.answer(
        f"📢 Kanalga qo‘shilish uchun {AMOUNT} so‘m to‘lov qiling.\n"
        f"To‘lov tugagach, 'To‘lov qildim' tugmasini bosing.",
        reply_markup=markup
    )


@dp.callback_query_handler(lambda c: c.data.startswith("check_"))
async def check_payment(call: types.CallbackQuery):
    tx_id = call.data.split("_")[1]
    user_id = call.from_user.id

    checkout = client.check_transaction(login, tx_id)

    if checkout['status'] == "success":
        cursor.execute("UPDATE users SET paid=1 WHERE user_id=?", (user_id,))
        conn.commit()
        await call.message.answer(f"✅ To‘lov tasdiqlandi!\nKanalga kirish: {CHANNEL_URL}")
    else:
        await call.answer("❌ To‘lov topilmadi yoki hali amalga oshirilmagan!", show_alert=True)


if __name__ == "__main__":
    executor.start_polling(dp, skip_updates=True)