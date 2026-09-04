"""Transactional email delivery for account verification."""

import os
import smtplib
from email.message import EmailMessage
from email.utils import formataddr

try:
    import dns.resolver as _dns_resolver
    _DNS_AVAILABLE = True
except ImportError:
    _DNS_AVAILABLE = False


def validate_email_domain(email: str) -> None:
    """Raise ValueError if the email domain has no MX (or A) record.

    This is a best-effort check — it rejects obviously fake domains
    (e.g. 'abc@notadomainthatexists.xyz') early, before we attempt
    SMTP delivery and create a zombie account.

    Falls back silently if dnspython is not installed or DNS times out,
    so SMTP is still attempted in those edge cases.
    """
    if not _DNS_AVAILABLE:
        return
    domain = email.split('@')[-1].lower()
    try:
        # Try MX first, then fall back to A record (some small providers skip MX)
        try:
            answers = _dns_resolver.resolve(domain, 'MX', lifetime=5)
            if not answers:
                raise ValueError(f"The email domain '{domain}' does not appear to exist.")
        except (_dns_resolver.NXDOMAIN, _dns_resolver.NoAnswer):
            # No MX — check A record as fallback
            try:
                _dns_resolver.resolve(domain, 'A', lifetime=5)
            except (_dns_resolver.NXDOMAIN, _dns_resolver.NoAnswer):
                raise ValueError(f"The email domain '{domain}' does not appear to exist.")
    except ValueError:
        raise
    except Exception:
        # DNS timeout, network error, etc. — don't block registration
        pass



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
