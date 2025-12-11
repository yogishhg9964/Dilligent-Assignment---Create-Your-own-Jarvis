"""
Personal Assistant Routes - Email, Calendar, Tasks, Messages
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional, List
from simple_email_manager import SimpleEmailManager, EmailRequest, EmailResponse
import json

router = APIRouter(prefix="/personal-assistant", tags=["personal-assistant"])

# Initialize email manager
email_manager = SimpleEmailManager()

# ========================
# EMAIL ENDPOINTS
# ========================

class SendEmailRequest(BaseModel):
    to: str
    subject: str
    body: str
    cc: Optional[str] = None
    bcc: Optional[str] = None

class EmailTaskRequest(BaseModel):
    task_description: str
    """Natural language description of the email task"""

@router.post("/email/send")
async def send_email(request: SendEmailRequest):
    """
    Send an email on behalf of the user
    
    Example:
    {
        "to": "john@example.com",
        "subject": "Meeting Confirmation",
        "body": "Hi John,\n\nConfirming our meeting tomorrow at 2 PM.",
        "cc": "cc@example.com"
    }
    """
    email_req = EmailRequest(**request.dict())
    result = email_manager.send_email(email_req)
    
    if result.success:
        return {
            "success": True,
            "message": f"Email sent successfully to {request.to}",
            "message_id": result.message_id
        }
    else:
        raise HTTPException(status_code=400, detail=result.error)

@router.get("/email/inbox")
async def get_inbox(max_results: int = 10):
    """Get unread emails from inbox"""
    emails = email_manager.get_emails(max_results=max_results, query="is:unread")
    return {
        "success": True,
        "count": len(emails),
        "emails": emails
    }

@router.post("/email/parse-and-send")
async def parse_and_send_email(request: EmailTaskRequest):
    """
    Parse natural language description and send email
    
    Example:
    {
        "task_description": "Send an email to john@example.com about the project deadline extension"
    }
    """
    try:
        # This would integrate with your LLM to parse natural language
        # For now, return a response showing the capability
        return {
            "success": False,
            "message": "Natural language parsing requires LLM integration",
            "hint": "Use the structured email/send endpoint for direct sending"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/email/settings")
async def get_email_settings():
    """Get email configuration status"""
    try:
        has_credentials = email_manager.service is not None
        return {
            "configured": has_credentials,
            "message": "Gmail integration is" + (" " if has_credentials else " NOT ") + "configured"
        }
    except:
        return {
            "configured": False,
            "message": "Gmail integration is not configured"
        }

# ========================
# EMAIL DRAFT ENDPOINTS
# ========================

class DraftEmail(BaseModel):
    to: str
    subject: str
    body: str
    cc: Optional[str] = None
    bcc: Optional[str] = None

# In-memory storage for drafts (in production, use database)
email_drafts = {}

@router.post("/email/draft")
async def create_draft(draft: DraftEmail):
    """Create an email draft for review"""
    draft_id = str(len(email_drafts) + 1)
    email_drafts[draft_id] = {
        "id": draft_id,
        "to": draft.to,
        "subject": draft.subject,
        "body": draft.body,
        "cc": draft.cc,
        "bcc": draft.bcc,
        "status": "draft"
    }
    return {
        "success": True,
        "draft_id": draft_id,
        "message": "Email draft created. Review and send when ready."
    }

@router.get("/email/drafts")
async def get_drafts():
    """Get all email drafts"""
    return {
        "success": True,
        "drafts": list(email_drafts.values())
    }

@router.post("/email/draft/{draft_id}/send")
async def send_draft(draft_id: str):
    """Send a draft email"""
    if draft_id not in email_drafts:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    draft = email_drafts[draft_id]
    email_req = EmailRequest(
        to=draft["to"],
        subject=draft["subject"],
        body=draft["body"],
        cc=draft["cc"],
        bcc=draft["bcc"]
    )
    
    result = email_manager.send_email(email_req)
    
    if result.success:
        email_drafts[draft_id]["status"] = "sent"
        return {
            "success": True,
            "message": f"Draft email sent to {draft['to']}",
            "message_id": result.message_id
        }
    else:
        raise HTTPException(status_code=400, detail=result.error)

@router.delete("/email/draft/{draft_id}")
async def delete_draft(draft_id: str):
    """Delete an email draft"""
    if draft_id not in email_drafts:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    del email_drafts[draft_id]
    return {"success": True, "message": "Draft deleted"}
