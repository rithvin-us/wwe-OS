import asyncio
import base64
import json
import logging
import os

import httpx
from dotenv import load_dotenv
from openai import AsyncOpenAI
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes, MessageHandler, filters

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO
)
logger = logging.getLogger(__name__)

# The OCR model is configurable, never hardcoded to a specific vendor's
# newest release — "gpt-4o" is the confirmed-available default. If your
# OpenAI account has access to a newer/cheaper vision model, set OCR_MODEL.
OCR_MODEL = os.getenv("OCR_MODEL", "gpt-4o")

# Where the platform kernel lives, and the shared secret that authenticates
# this bot to it (must match one entry in the platform's
# INGESTION_SERVICE_TOKENS, e.g. "telegram-bot:<PLATFORM_SERVICE_TOKEN>").
# See platform/shared/service_auth.py.
PLATFORM_API_URL = os.getenv("PLATFORM_API_URL", "http://localhost:8000")
PLATFORM_SERVICE_TOKEN = os.getenv("PLATFORM_SERVICE_TOKEN")

_MAX_POST_ATTEMPTS = 3
_RETRY_BACKOFF_SECONDS = 1.5


class DuplicateBillError(RuntimeError):
    """The platform already has this document (matched by external_ref)."""


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
        "I will extract the seller name, date, and total for you."
    )


async def _extract_bill_fields(base64_image: str) -> dict:
    """Call the OCR model and return fields shaped exactly for the platform's
    ingest contract (docs/modules/purchase-integration-requirements.md):
    seller_name, purchase_date, total_rate, currency."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set in the .env file.")

    client = AsyncOpenAI(api_key=api_key)

    system_prompt = (
        "You are a strict data extraction OCR bot. Extract the following from the "
        "provided receipt/invoice image:\n"
        "- seller_name: the name of the vendor or store.\n"
        "- purchase_date: the transaction date, formatted YYYY-MM-DD.\n"
        "- total_rate: the total final amount as a plain number, no currency symbol "
        "or thousands separators (e.g. 150.00, not '$150.00' or '1,500').\n"
        "- currency: the 3-letter ISO 4217 currency code (e.g. USD, INR, EUR). If the "
        "receipt does not show a currency, infer the most likely one from context, or "
        "use USD if there is truly no signal.\n"
        "Return ONLY a valid JSON object with keys 'seller_name', 'purchase_date', "
        "'total_rate', and 'currency'."
    )

    response = await client.chat.completions.create(
        model=OCR_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Extract data from this receipt."},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"},
                    },
                ],
            },
        ],
        response_format={"type": "json_object"},
        max_tokens=300,
    )

    return json.loads(response.choices[0].message.content)


async def _post_to_platform(payload: dict) -> dict:
    """POST the extracted bill to the platform. Retries transient failures a
    few times; raises on a definitive rejection (bad data, auth failure) so
    the caller can tell the user what actually happened."""
    if not PLATFORM_SERVICE_TOKEN:
        raise RuntimeError("PLATFORM_SERVICE_TOKEN is not set in the .env file.")

    url = f"{PLATFORM_API_URL.rstrip('/')}/api/v1/purchase/bills/ingest/"
    headers = {"Authorization": f"Service {PLATFORM_SERVICE_TOKEN}"}

    last_error: Exception | None = None
    async with httpx.AsyncClient(timeout=15.0) as client:
        for attempt in range(1, _MAX_POST_ATTEMPTS + 1):
            try:
                response = await client.post(url, json=payload, headers=headers)
            except httpx.RequestError as exc:
                last_error = exc
                logger.warning(
                    "Platform POST attempt %s/%s failed: %s", attempt, _MAX_POST_ATTEMPTS, exc
                )
                await asyncio.sleep(_RETRY_BACKOFF_SECONDS * attempt)
                continue

            if response.status_code == 201:
                return response.json()
            if response.status_code in (401, 403):
                # Wrong/missing service token — retrying won't help.
                raise RuntimeError(
                    f"Platform rejected this bot's credentials ({response.status_code})."
                )
            if response.status_code == 409:
                raise DuplicateBillError("This document was already saved.")
            if response.status_code == 422:
                raise RuntimeError(f"Platform rejected the extracted data: {response.text}")
            if response.status_code >= 500:
                last_error = RuntimeError(
                    f"Platform returned {response.status_code}: {response.text}"
                )
                logger.warning(
                    "Platform POST attempt %s/%s got %s, retrying...",
                    attempt,
                    _MAX_POST_ATTEMPTS,
                    response.status_code,
                )
                await asyncio.sleep(_RETRY_BACKOFF_SECONDS * attempt)
                continue
            # Any other 4xx: don't retry, it will fail the same way again.
            raise RuntimeError(
                f"Platform rejected the request ({response.status_code}): {response.text}"
            )

    raise last_error or RuntimeError("Could not reach the platform after retrying.")


async def handle_document(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle incoming documents or photos (bills): OCR, then post to the platform."""
    message = await update.message.reply_text("Received your document. Running OCR...")

    try:
        attachment = update.message.photo[-1] if update.message.photo else update.message.document
        file_id = attachment.file_id
        # file_unique_id is stable across chats and re-forwards — the platform
        # dedupes on it so resending the same bill never creates a duplicate.
        file_unique_id = attachment.file_unique_id

        new_file = await context.bot.get_file(file_id)
        file_bytes = await new_file.download_as_bytearray()
        base64_image = base64.b64encode(file_bytes).decode("utf-8")

        extracted = await _extract_bill_fields(base64_image)
    except Exception as exc:  # noqa: BLE001 - surfaced to the user below
        logger.error("OCR extraction failed: %s", exc)
        await message.edit_text(
            "Sorry, I couldn't read that document. Try a clearer photo or a PDF export."
        )
        return

    # new_file.file_path is Telegram-hosted, not durable storage — Telegram
    # does not guarantee it stays valid indefinitely. This is an honest
    # interim value, not a permanent document store; replace with a real
    # upload once platform/storage is wired up. Normalized defensively since
    # different library versions return either a full URL or a bare path.
    raw_path = new_file.file_path
    if raw_path.startswith("http://") or raw_path.startswith("https://"):
        document_url = raw_path
    else:
        document_url = (
            f"https://api.telegram.org/file/bot{os.getenv('TELEGRAM_BOT_TOKEN')}/{raw_path}"
        )

    payload = {
        "seller_name": extracted.get("seller_name", "Unknown"),
        "purchase_date": extracted.get("purchase_date"),
        "total_rate": extracted.get("total_rate"),
        "currency": extracted.get("currency", "USD"),
        "telegram_user_id": update.effective_user.id,
        "document_url": document_url,
        "external_ref": file_unique_id,
    }

    await message.edit_text(
        f"Extraction complete.\n\n"
        f"Seller: {payload['seller_name']}\n"
        f"Date: {payload['purchase_date']}\n"
        f"Total: {payload['currency']} {payload['total_rate']}\n\n"
        f"Saving to the platform..."
    )

    try:
        result = await _post_to_platform(payload)
    except DuplicateBillError:
        await message.edit_text("This bill is already in the platform — no duplicate was created.")
        return
    except Exception as exc:  # noqa: BLE001 - surfaced to the user below
        logger.error("Posting bill to platform failed: %s", exc)
        await message.edit_text(
            "I extracted the bill data, but couldn't save it to the platform "
            f"({exc}). Please try sending the document again in a moment."
        )
        return

    await message.edit_text(
        f"Saved. This bill is now waiting for your review in the Purchases app "
        f"(status: {result.get('status', 'pending_review')})."
    )


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
