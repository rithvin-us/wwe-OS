import logging
import os

from dotenv import load_dotenv
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes, MessageHandler, filters

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO
)
logger = logging.getLogger(__name__)


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Send a message when the command /start is issued."""
    user = update.effective_user
    await update.message.reply_html(
        rf"Hi {user.mention_html()}! I am the platform bot. "
        "Use /purchase to upload a new purchase bill, or /help to see other commands."
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Send a message when the command /help is issued."""
    await update.message.reply_text(
        "Available commands:\n"
        "/purchase - Start the process of uploading a purchase bill\n"
        "/help - Show this message"
    )


async def purchase_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Initiate a purchase bill upload."""
    await update.message.reply_text(
        "Please send a photo or a document (PDF, PNG, JPG) of the purchase bill.\n"
        "I will extract the seller name, date, and rate for you."
    )


async def handle_document(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle incoming documents or photos (bills)."""
    # Just a placeholder for actual extraction logic
    await update.message.reply_text("Received your document. Running OCR...")

    # TODO: Implement OCR integration here
    # 1. Download file: new_file = await update.message.document.get_file()
    # 2. Call OCR service to extract: seller_name, date, rate
    # 3. Post to Platform API (e.g., /api/v1/purchase/bills/)

    # Mocking the response
    seller_name = "Mocked Vendor Inc."
    date = "2026-07-20"
    rate = "$150.00"

    response_text = (
        f"Extraction Complete!\n\n"
        f"Seller: {seller_name}\n"
        f"Date: {date}\n"
        f"Rate: {rate}\n\n"
        f"This bill has been securely posted to the platform."
    )

    await update.message.reply_text(response_text)


def main() -> None:
    """Start the bot."""
    token = os.getenv("TELEGRAM_BOT_TOKEN")

    if not token:
        logger.error("No TELEGRAM_BOT_TOKEN provided. Please set it in the .env file.")
        return

    # Create the Application and pass it your bot's token.
    application = Application.builder().token(token).build()

    # on different commands - answer in Telegram
    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("purchase", purchase_command))

    # on non command i.e message - echo the message on Telegram
    application.add_handler(MessageHandler(filters.Document.ALL | filters.PHOTO, handle_document))

    # Run the bot until the user presses Ctrl-C
    application.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
