# Purchase Telegram Bot & OCR Integration Requirements

## Overview

This document outlines the API contract and data requirements for integrating the Telegram Bot's OCR flow with the main platform. The Telegram bot is designed to receive document uploads (images or PDFs of purchase bills), perform OCR, and send the structured data to the platform for storage and review.

## Architecture

1. **User Action**: The user initiates a `/purchase` command in Telegram and uploads a bill.
2. **Bot Processing**: The `telegram-bot` service downloads the document.
3. **OCR Extraction**: The bot sends the document to an OCR service (e.g., internal `ocr` service, AWS Textract, or OpenAI Vision) to extract specific fields.
4. **Data Transmission**: The bot makes a `POST` request to the platform's API with the structured data.
5. **Platform Storage**: The platform validates and stores the `Purchase Bill` record.

## OCR Extraction Requirements

The OCR service MUST reliably extract the following fields from the unstructured receipt/invoice:

1. **Seller Name** (String): The name of the vendor or store.
2. **Date** (Date: `YYYY-MM-DD`): The date of the transaction.
3. **Actual Rate/Total Amount** (Decimal): The total final cost on the bill.

## Platform API Contract

The Platform must expose an endpoint for the bot to push this data.

**Endpoint**: `POST /api/v1/purchase/bills/`
**Authentication**: Internal service token or HMAC signature.

**Payload Specification (JSON)**:

```json
{
  "seller_name": "Vendor Inc.",
  "purchase_date": "2026-07-20",
  "total_rate": 150.0,
  "currency": "USD",
  "telegram_user_id": 123456789,
  "document_url": "https://storage.internal/path/to/file.pdf"
}
```

## Next Steps for Future Implementation

- **Implement the Platform API Endpoint**: Build the Django models for `PurchaseBill` and the corresponding DRF views in the `modules/purchase` app.
- **Implement the actual OCR Call**: In `services/telegram-bot/main.py`, replace the mocked data with an actual HTTP request to the chosen OCR provider.
- **File Storage**: Ensure the telegram bot uploads the raw file to S3 or internal storage and passes the URL to the platform.
