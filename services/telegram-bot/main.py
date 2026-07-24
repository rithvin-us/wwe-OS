import asyncio
import base64
import datetime
import json
import logging
import os
import re

import httpx
from dotenv import load_dotenv
from telegram import Update
from telegram.constants import ParseMode
from telegram.ext import Application, CommandHandler, ContextTypes, MessageHandler, filters

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO
)
logger = logging.getLogger(__name__)

OCR_MODEL = os.getenv("OCR_MODEL", "gemini-flash-latest")
PLATFORM_API_URL = os.getenv("PLATFORM_API_URL", "http://localhost:8000")
PLATFORM_SERVICE_TOKEN = os.getenv("PLATFORM_SERVICE_TOKEN")

_MAX_POST_ATTEMPTS = 3
_RETRY_BACKOFF_SECONDS = 1.5


class DuplicateBillError(RuntimeError):
    """The platform already has this document (matched by external_ref)."""


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Welcome message and introduction to WWE OS Bot."""
    user = update.effective_user
    welcome_text = (
        f"👋 Welcome {user.mention_html()} to <b>WWE OS Bot</b>!\n\n"
        "I am your automated assistant for processing purchase bills and receipts.\n\n"
        "<b>Available Commands:</b>\n"
        "• /purchase - Upload a purchase bill (photo or PDF) for OCR processing\n"
        "• /status - Check the processing status of your recent purchase uploads\n"
        "• /history - View your recently submitted purchase bills\n"
        "• /cancel - Cancel the current upload or ongoing operation\n"
        "• /help - Display all available commands and usage instructions"
    )
    await update.message.reply_html(welcome_text)


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Display all available commands and usage instructions."""
    help_text = (
        "🤖 <b>WWE OS Bot Commands & Usage</b>\n\n"
        "<b>/start</b> — Welcome message and introduction to WWE OS Bot.\n"
        "<b>/help</b> — Display all available commands and usage instructions.\n"
        "<b>/purchase</b> — Upload a purchase bill (photo or PDF) for OCR processing.\n"
        "<b>/status</b> — Check the processing status of your recent purchase uploads.\n"
        "<b>/history</b> — View your recently submitted purchase bills.\n"
        "<b>/cancel</b> — Cancel the current upload or ongoing operation.\n\n"
        "<i>Tip: You can also send a receipt photo or PDF directly anytime to start extraction!</i>"
    )
    await update.message.reply_html(help_text)


async def purchase_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Upload a purchase bill (photo or PDF) for OCR processing."""
    await update.message.reply_text(
        "📸 Please send a photo or document (PDF, PNG, JPG) of your purchase bill.\n"
        "I will extract the seller name, date, total amount, and currency, then save it to WWE OS!"
    )


async def status_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Check the processing status of your recent purchase uploads."""
    user_id = update.effective_user.id
    url = f"{PLATFORM_API_URL.rstrip('/')}/api/v1/purchase/bills/?telegram_user_id={user_id}"
    headers = {}
    if PLATFORM_SERVICE_TOKEN:
        headers["Authorization"] = f"Service {PLATFORM_SERVICE_TOKEN}"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, headers=headers)
            if response.status_code == 200:
                data = response.json()
                results = data.get("results", data) if isinstance(data, dict) else data
                if not results:
                    await update.message.reply_text("ℹ️ No purchase uploads found for your account.")
                    return

                recent = results[0]
                status_str = recent.get("status", "pending_review").replace("_", " ").title()
                seller = recent.get("seller_name", "Unknown")
                total = f"{recent.get('currency', 'USD')} {recent.get('total_rate', '0.00')}"

                await update.message.reply_html(
                    f"📊 <b>Latest Upload Status</b>\n\n"
                    f"<b>Status:</b> {status_str}\n"
                    f"<b>Seller:</b> {seller}\n"
                    f"<b>Total:</b> {total}\n"
                    f"<b>Reference:</b> {str(recent.get('id', 'N/A'))[:8]}..."
                )
                return
    except Exception as exc:
        logger.warning("Failed to fetch status from platform: %s", exc)

    await update.message.reply_text(
        "ℹ️ System active. Purchase bill processing pipeline is operational."
    )


async def history_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """View your recently submitted purchase bills."""
    user_id = update.effective_user.id
    url = f"{PLATFORM_API_URL.rstrip('/')}/api/v1/purchase/bills/?telegram_user_id={user_id}"
    headers = {}
    if PLATFORM_SERVICE_TOKEN:
        headers["Authorization"] = f"Service {PLATFORM_SERVICE_TOKEN}"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, headers=headers)
            if response.status_code == 200:
                data = response.json()
                results = data.get("results", data) if isinstance(data, dict) else data
                if not results:
                    await update.message.reply_text("ℹ️ No recently submitted purchase bills found.")
                    return

                lines = ["📜 <b>Recently Submitted Purchase Bills</b>\n"]
                for bill in results[:5]:
                    seller = bill.get("seller_name", "Unknown")
                    total = f"{bill.get('currency', 'USD')} {bill.get('total_rate', '0.00')}"
                    status = bill.get("status", "pending").replace("_", " ").title()
                    lines.append(f"• <b>{seller}</b> — {total} ({status})")

                await update.message.reply_html("\n".join(lines))
                return
    except Exception as exc:
        logger.warning("Failed to fetch history from platform: %s", exc)

    await update.message.reply_html(
        "📜 <b>Recent History</b>\n\n"
        "Your uploaded purchase bills are safely stored in WWE OS under the Purchases section."
    )


async def cancel_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Cancel the current upload or ongoing operation."""
    await update.message.reply_text(
        "❌ Operation cancelled. You can start a new upload anytime with /purchase "
        "or by sending a receipt document."
    )


async def _extract_bill_fields(base64_image: str, file_bytes: bytes | None = None) -> dict:
    """Call the OCR / AI model and return fields shaped for the platform's ingest contract."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set in environment.")

    system_prompt = (
        "You are a strict data extraction OCR bot. Extract the following from the "
        "provided receipt/invoice image or document text:\n"
        "- seller_name: the name of the vendor or store.\n"
        "- purchase_date: the transaction date, formatted YYYY-MM-DD.\n"
        "- total_rate: the total final amount as a plain number, no currency symbol "
        "or thousands separators (e.g. 150.00, not '$150.00' or '1,500').\n"
        "currency: the 3-letter ISO 4217 currency code (e.g. INR, USD, EUR). Default to INR "
        "if there is no explicit currency symbol or signal.\n"
        "Return ONLY a valid JSON object with keys 'seller_name', 'purchase_date', "
        "'total_rate', and 'currency'."
    )

    parts: list[dict] = []
    if file_bytes and file_bytes.startswith(b"%PDF"):
        try:
            import io

            import pypdf

            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            pdf_text = "\n".join([page.extract_text() or "" for page in reader.pages]).strip()
            if pdf_text:
                parts.append(
                    {
                        "text": (
                            f"{system_prompt}\n\nExtract receipt/invoice data from "
                            f"this document text:\n\n{pdf_text}"
                        )
                    }
                )
        except Exception as err:
            logger.warning("pypdf text extraction failed, falling back to vision: %s", err)

    if not parts:
        parts = [
            {"text": f"{system_prompt}\n\nExtract data from this receipt/invoice."},
            {
                "inline_data": {
                    "mime_type": "image/jpeg",
                    "data": base64_image,
                }
            },
        ]

    model_name = OCR_MODEL
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": parts}],
        "generationConfig": {
            "response_mime_type": "application/json",
            "temperature": 0.1,
            "maxOutputTokens": 2048,
        },
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(url, json=payload)
        if response.status_code == 404 and model_name != "gemini-flash-latest":
            logger.warning("Model %s returned 404, falling back to gemini-flash-latest", model_name)
            fallback_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={api_key}"
            response = await client.post(fallback_url, json=payload)
        if response.status_code != 200:
            raise RuntimeError(f"Gemini API returned {response.status_code}: {response.text}")
        data = response.json()
        candidates = data.get("candidates", [])
        if not candidates or "content" not in candidates[0]:
            raise RuntimeError("Gemini API returned no candidates or content.")
        res_parts = candidates[0]["content"].get("parts", [])
        text_content = "".join(p.get("text", "") for p in res_parts).strip()
        if text_content.startswith("```"):
            lines = text_content.splitlines()
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            text_content = "\n".join(lines).strip()
        return json.loads(text_content)


async def _post_to_platform(payload: dict) -> dict:
    """POST the extracted bill to the platform."""
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

            raise RuntimeError(
                f"Platform rejected the request ({response.status_code}): {response.text}"
            )

    raise last_error or RuntimeError("Could not reach the platform after retrying.")


async def handle_document(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle incoming documents/photos: Save to platform FIRST, then run OCR."""
    message = await update.message.reply_text("📥 Document received. Saving to WWE OS...")

    try:
        attachment = update.message.photo[-1] if update.message.photo else update.message.document
        file_id = attachment.file_id
        file_unique_id = attachment.file_unique_id

        new_file = await context.bot.get_file(file_id)
        file_bytes = await new_file.download_as_bytearray()
        base64_image = base64.b64encode(file_bytes).decode("utf-8")

        raw_path = new_file.file_path
        if raw_path.startswith("http://") or raw_path.startswith("https://"):
            document_url = raw_path
        else:
            document_url = (
                f"https://api.telegram.org/file/bot{os.getenv('TELEGRAM_BOT_TOKEN')}/{raw_path}"
            )
    except Exception as exc:
        logger.error("Failed to download document from Telegram: %s", exc)
        await message.edit_text("❌ Failed to receive document. Please try sending again.")
        return

    # Extract caption & hashtags if provided with document
    caption = (update.message.caption or update.message.text or "").strip()
    tags: list[str] = []
    if caption:
        hashtags = re.findall(r"#([A-Za-z0-9_-]+)", caption)
        for h in hashtags:
            if h and h not in tags:
                tags.append(h)

    # STEP 1: Save document to backend FIRST through Storage Service (never blocked)
    user_handle = update.effective_user.username or update.effective_user.full_name or ""
    initial_payload = {
        "seller_name": "Pending OCR Processing",
        "purchase_date": str(datetime.date.today()),
        "total_rate": "0.00",
        "currency": "INR",
        "telegram_user_id": update.effective_user.id,
        "telegram_username": user_handle,
        "document_url": document_url,
        "external_ref": file_unique_id,
        "source_channel": "telegram",
        "caption": caption,
        "tags": tags,
    }

    try:
        await _post_to_platform(initial_payload)
        await message.edit_text("📥 Document safely stored in Storage Service. Running OCR...")
    except DuplicateBillError:
        await message.edit_text(
            "ℹ️ This document was already saved in WWE OS — no duplicate created."
        )
        return
    except Exception as exc:
        logger.error("Initial document save failed: %s", exc)
        await message.edit_text(f"⚠️ Could not save document to platform: {exc}")
        return

    # STEP 2: Run AI OCR extraction and send full payload to backend
    try:
        extracted = await _extract_bill_fields(base64_image, bytes(file_bytes))
        vendor_name = extracted.get("vendor") or extracted.get("seller_name") or "Unknown Vendor"
        invoice_num = extracted.get("invoice_number") or "N/A"
        total_amt = str(extracted.get("grand_total") or extracted.get("total_rate") or "0.00")
        curr = (extracted.get("currency") or "INR").upper()
        confidence = float(extracted.get("confidence_score") or 0.85)
        conf_percent = int(confidence * 100) if confidence <= 1.0 else int(confidence)

        update_payload = {
            "seller_name": vendor_name,
            "purchase_date": (
                extracted.get("invoice_date")
                or extracted.get("purchase_date")
                or str(datetime.date.today())
            ),
            "total_rate": total_amt,
            "currency": curr,
            "telegram_user_id": update.effective_user.id,
            "telegram_username": user_handle,
            "document_url": document_url,
            "external_ref": file_unique_id,
            "source_channel": "telegram",
            "caption": caption,
            "tags": tags,
            "raw_extraction": extracted,
        }
        res = await _post_to_platform(update_payload)
        bill_status = res.get("status", "processed")

        if bill_status == "processed" and conf_percent >= 80:
            await message.edit_text(
                f"🎉 <b>Purchase successfully processed.</b>\n\n"
                f"<b>Vendor:</b> {vendor_name}\n"
                f"<b>Invoice #:</b> {invoice_num}\n"
                f"<b>Amount:</b> {curr} {total_amt}\n"
                f"<b>Confidence:</b> {conf_percent}%",
                parse_mode=ParseMode.HTML,
            )
        else:
            await message.edit_text(
                "📁 <b>Document safely stored.</b>\n\nOCR requires manual review.",
                parse_mode=ParseMode.HTML,
            )
    except Exception as exc:
        logger.warning("OCR extraction failed after document was saved: %s", exc)
        await message.edit_text(
            "📁 <b>Document safely stored.</b>\n\nOCR requires manual review.",
            parse_mode=ParseMode.HTML,
        )


def main() -> None:
    """Start the bot."""
    token = os.getenv("TELEGRAM_BOT_TOKEN")

    if not token:
        logger.error("No TELEGRAM_BOT_TOKEN provided. Please set it in the .env file.")
        return

    application = Application.builder().token(token).build()

    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("purchase", purchase_command))
    application.add_handler(CommandHandler("status", status_command))
    application.add_handler(CommandHandler("history", history_command))
    application.add_handler(CommandHandler("cancel", cancel_command))

    application.add_handler(MessageHandler(filters.Document.ALL | filters.PHOTO, handle_document))

    application.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
