"""
Simple Email Manager - Uses Gmail App Password (No OAuth needed)
This is faster for testing and development
"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pydantic import BaseModel
from typing import Optional
import os
from dotenv import load_dotenv

load_dotenv()

class EmailRequest(BaseModel):
    to: str
    subject: str
    body: str
    cc: Optional[str] = None
    bcc: Optional[str] = None

class EmailResponse(BaseModel):
    success: bool
    message_id: Optional[str] = None
    error: Optional[str] = None

class SimpleEmailManager:
    """Simple email manager using Gmail App Password"""
    
    def __init__(self, email: Optional[str] = None, app_password: Optional[str] = None):
        """
        Initialize email manager
        
        Args:
            email: Gmail address (default from .env GMAIL_EMAIL)
            app_password: Gmail app password (default from .env GMAIL_APP_PASSWORD)
        """
        self.email = email or os.getenv('GMAIL_EMAIL')
        self.app_password = app_password or os.getenv('GMAIL_APP_PASSWORD')
        self.service = None
        
        if self.email and self.app_password:
            self.service = 'configured'
            print(f"✓ Email service configured for {self.email}")
        else:
            print("⚠ Email service not configured. Set GMAIL_EMAIL and GMAIL_APP_PASSWORD in .env")
    
    def send_email(self, email_req: EmailRequest) -> EmailResponse:
        """Send an email via Gmail SMTP"""
        
        if not self.service:
            return EmailResponse(
                success=False,
                error="Email service not configured. Set GMAIL_EMAIL and GMAIL_APP_PASSWORD in .env"
            )
        
        try:
            # Create message
            msg = MIMEMultipart()
            msg['From'] = self.email
            msg['To'] = email_req.to
            msg['Subject'] = email_req.subject
            
            if email_req.cc:
                msg['Cc'] = email_req.cc
            if email_req.bcc:
                msg['Bcc'] = email_req.bcc
            
            # Attach body
            msg.attach(MIMEText(email_req.body, 'plain'))
            
            # Send via Gmail SMTP
            server = smtplib.SMTP_SSL('smtp.gmail.com', 465)
            server.login(self.email, self.app_password)
            
            # Get all recipients
            recipients = [email_req.to]
            if email_req.cc:
                recipients.extend(email_req.cc.split(','))
            if email_req.bcc:
                recipients.extend(email_req.bcc.split(','))
            
            server.sendmail(self.email, recipients, msg.as_string())
            server.quit()
            
            return EmailResponse(
                success=True,
                message_id=f"sent_to_{email_req.to}",
                error=None
            )
        
        except Exception as e:
            return EmailResponse(
                success=False,
                error=str(e)
            )
    
    def get_emails(self, max_results: int = 10) -> list:
        """
        Note: Getting emails requires IMAP or OAuth
        For now, this is a placeholder
        """
        return []

# Create global instance
email_manager = None

def init_email_manager():
    """Initialize email manager"""
    global email_manager
    email_manager = SimpleEmailManager()

def get_email_manager() -> SimpleEmailManager:
    """Get email manager instance"""
    if email_manager is None:
        init_email_manager()
    return email_manager
