"""
Email Agent - Interprets natural language email tasks
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import re
import json

router = APIRouter(prefix="/personal-assistant/email/agent", tags=["email-agent"])

class EmailTaskRequest(BaseModel):
    task_description: str

class EmailTaskResponse(BaseModel):
    interpretation: str
    action: str  # 'draft' or 'send'
    email_data: dict

def extract_email_address(text: str) -> Optional[str]:
    """Extract email address from text using regex"""
    email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    matches = re.findall(email_pattern, text)
    return matches[0] if matches else None

def parse_email_task(task_description: str) -> dict:
    """
    Parse natural language task description to extract email details
    
    Examples:
    - "Send an email to john@example.com confirming our 2 PM meeting tomorrow"
    - "Draft an email to sarah@company.com about the project deadline"
    - "Email the team about the Q4 results"
    """
    
    task_lower = task_description.lower()
    
    # Determine action
    action = 'draft'  # Default to draft for safety
    if 'send' in task_lower and 'draft' not in task_lower:
        action = 'send'
    
    # Extract recipient email
    recipient_email = extract_email_address(task_description)
    
    # Extract subject/topic
    subject = ""
    cc = None
    bcc = None
    
    # Common patterns to find subject
    subject_keywords = [
        'about', 'regarding', 'confirming', 'discussing', 'meeting',
        'project', 'deadline', 'proposal', 'results', 'update',
        'follow-up', 'invitation', 'invitation to', 'schedule',
        'thank', 'approval', 'review'
    ]
    
    # Simple subject extraction
    if 'about' in task_lower:
        parts = task_description.split('about')
        if len(parts) > 1:
            subject = parts[1].strip().rstrip('.,!?')
    elif 'confirming' in task_lower:
        subject = "Meeting Confirmation"
    elif 'regarding' in task_lower:
        parts = task_description.split('regarding')
        if len(parts) > 1:
            subject = parts[1].strip().rstrip('.,!?')
    elif 'thank' in task_lower:
        subject = "Thank You"
    else:
        # Extract meaningful words from the task
        words = [w for w in task_description.split() if len(w) > 4]
        if words:
            subject = ' '.join(words[:3])
    
    if not subject:
        subject = "Important Message"
    
    # Capitalize subject properly
    subject = ' '.join(word.capitalize() for word in subject.split())
    
    # Generate body based on task description
    body = f"Hello,\n\n{task_description}\n\nBest regards"
    
    # Try to make body more natural
    if 'confirming' in task_lower:
        body = f"Hello,\n\nI wanted to confirm {task_description.lower().split('confirming')[-1].strip()}.\n\nPlease let me know if you have any questions.\n\nBest regards"
    elif 'thank' in task_lower:
        body = f"Hello,\n\nThank you for {task_description.lower().split('thank')[-1].strip()}.\n\nI really appreciate your help.\n\nBest regards"
    elif 'about' in task_lower or 'regarding' in task_lower:
        topic = task_description.lower().split('about' if 'about' in task_lower else 'regarding')[-1].strip()
        body = f"Hello,\n\nI wanted to reach out regarding {topic}.\n\nPlease let me know your thoughts.\n\nBest regards"
    
    return {
        'to': recipient_email or 'recipient@example.com',
        'subject': subject,
        'body': body,
        'cc': cc,
        'bcc': bcc,
        'action': action,
        'interpretation': f"{action.capitalize()} email to {recipient_email or 'recipient'} about '{subject}'"
    }

@router.post("/process-task", response_model=EmailTaskResponse)
async def process_email_task(request: EmailTaskRequest):
    """
    Process a natural language email task
    
    Example:
    {
        "task_description": "Send an email to john@example.com confirming our 2 PM meeting tomorrow"
    }
    
    Response:
    {
        "interpretation": "Send email to john@example.com about 'Meeting Confirmation'",
        "action": "draft",
        "email_data": {
            "to": "john@example.com",
            "subject": "Meeting Confirmation",
            "body": "...",
            "cc": null,
            "bcc": null
        }
    }
    """
    try:
        if not request.task_description or len(request.task_description.strip()) < 10:
            raise ValueError("Task description is too short. Please provide more details.")
        
        # Parse the task
        parsed = parse_email_task(request.task_description)
        
        # Validate email address
        if '@' not in parsed['to']:
            raise ValueError(f"Could not find a valid email address in your task. Please include the recipient's email address.")
        
        return EmailTaskResponse(
            interpretation=parsed['interpretation'],
            action=parsed['action'],
            email_data={
                'to': parsed['to'],
                'subject': parsed['subject'],
                'body': parsed['body'],
                'cc': parsed['cc'],
                'bcc': parsed['bcc']
            }
        )
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing task: {str(e)}")

@router.get("/examples")
async def get_example_tasks():
    """Get example email tasks for users"""
    return {
        "examples": [
            "Send an email to john@example.com confirming our meeting tomorrow at 2 PM",
            "Draft an email to sarah@company.com about the project deadline extension",
            "Send a thank you email to alex@client.com for the presentation feedback",
            "Email the team about the Q4 results and next quarter planning",
            "Draft an email to manager@company.com requesting a meeting"
        ]
    }
