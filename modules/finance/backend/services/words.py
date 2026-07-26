"""Rupees in words, Indian style (lakh / crore), for the invoice's
"( In Words )" block.

Written here rather than pulled in as a dependency because the grouping an
Indian tax invoice needs — 12,34,567 read as "Twelve Lakh Thirty Four
Thousand Five Hundred Sixty Seven" — is not what a generic western
number-to-words library produces.
"""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

_UNITS = (
    "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
)  # fmt: skip
_TENS = (
    "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
)  # fmt: skip

# (divisor, name), largest first. Indian grouping: after the first thousand
# the groups are two digits wide, which is what makes lakh and crore work.
_SCALES = ((10_000_000, "Crore"), (100_000, "Lakh"), (1_000, "Thousand"), (100, "Hundred"))


def _below_hundred(value: int) -> list[str]:
    if value < 20:
        return [_UNITS[value]]
    tens, unit = divmod(value, 10)
    return [_TENS[tens]] + ([_UNITS[unit]] if unit else [])


def number_to_words(value: int) -> str:
    """`1234567` -> `"Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven"`."""
    if value == 0:
        return _UNITS[0]
    parts: list[str] = []
    remainder = value
    for divisor, name in _SCALES:
        count, remainder = divmod(remainder, divisor)
        if count:
            parts.extend(number_to_words(count).split() if count >= 100 else _below_hundred(count))
            parts.append(name)
    if remainder:
        parts.extend(_below_hundred(remainder))
    return " ".join(parts)


def rupees_in_words(amount: Decimal) -> str:
    """`Decimal("1234.50")` -> `"Rupees One Thousand Two Hundred Thirty Four
    and Fifty Paise Only"`. Negative amounts are prefixed "Minus"."""
    quantised = Decimal(amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    sign = "Minus " if quantised < 0 else ""
    quantised = abs(quantised)
    rupees = int(quantised)
    paise = int((quantised - rupees) * 100)

    words = f"{sign}Rupees {number_to_words(rupees)}"
    if paise:
        words += f" and {number_to_words(paise)} Paise"
    return f"{words} Only"
