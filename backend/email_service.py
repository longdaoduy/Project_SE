"""Transactional email delivery for account verification."""

import os
import smtplib
from email.message import EmailMessage
from email.utils import formataddr


def send_verification_email(to_email: str, full_name: str, code: str) -> None:
    host = os.getenv("SMTP_HOST", "").strip()
    username = os.getenv("SMTP_USERNAME", "").strip()
    password = os.getenv("SMTP_PASSWORD", "")
    from_email = os.getenv("SMTP_FROM_EMAIL", username).strip()
    if not host or not username or not password or not from_email:
        raise RuntimeError("SMTP is not configured; check backend/.env")

    message = EmailMessage()
    message["Subject"] = "Your SmartEng verification code"
    message["From"] = formataddr((os.getenv("SMTP_FROM_NAME", "SmartEng"), from_email))
    message["To"] = to_email
    message.set_content(
        f"Hello {full_name},\n\n"
        f"Your SmartEng verification code is: {code}\n\n"
        "This code expires in 10 minutes and can be used only once.\n"
        "If you did not create this account, you can ignore this email.\n"
    )

    port = int(os.getenv("SMTP_PORT", "587"))
    with smtplib.SMTP(host, port, timeout=15) as smtp:
        smtp.ehlo()
        if os.getenv("SMTP_USE_TLS", "1") == "1":
            smtp.starttls()
            smtp.ehlo()
        smtp.login(username, password)
        smtp.send_message(message)
