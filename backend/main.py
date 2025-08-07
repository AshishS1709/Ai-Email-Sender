from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, field_validator
from typing import List, Optional
import httpx
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
import logging
import asyncio
from contextlib import asynccontextmanager
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ----------------------
# Pydantic models
# ----------------------
class EmailGenerationRequest(BaseModel):
    prompt: str
    groq_api_key: str

    @field_validator("prompt")
    @classmethod
    def prompt_must_not_be_empty(cls, v: str):
        if not v.strip():
            raise ValueError("Prompt cannot be empty")
        return v.strip()


class EmailGenerationResponse(BaseModel):
    subject: str
    content: str
    generated_at: datetime


class EmailSendRequest(BaseModel):
    recipients: List[EmailStr]
    subject: str
    content: str
    sender_email: Optional[str] = None
    sender_password: Optional[str] = None
    smtp_server: Optional[str] = "smtp.gmail.com"
    smtp_port: Optional[int] = 587

    @field_validator("recipients")
    @classmethod
    def recipients_must_not_be_empty(cls, v: List[EmailStr]):
        if not v:
            raise ValueError("Recipients list cannot be empty")
        return v


class EmailSendResponse(BaseModel):
    success: bool
    message: str
    sent_to: List[str]
    sent_at: datetime


class HealthResponse(BaseModel):
    status: str
    timestamp: datetime
    version: str


# --------------------------------------------------
# Application lifecycle & global HTTP client
# --------------------------------------------------
http_client: Optional[httpx.AsyncClient] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create and close the global httpx AsyncClient."""
    global http_client
    http_client = httpx.AsyncClient(timeout=30.0)
    yield
    await http_client.aclose()


# --------------------------------------------------
# FastAPI application
# --------------------------------------------------
app = FastAPI(
    title="AI Email Sender Backend",
    description="Backend API for AI-powered email generation and sending",
    version="1.0.0",
    lifespan=lifespan,
)

# Allow all origins for now (change in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----------------------
# Utility endpoints
# ----------------------
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Simple health-check endpoint for liveness probes"""
    return HealthResponse(status="healthy", timestamp=datetime.now(), version="1.0.0")


# ----------------------
# Core functionality
# ----------------------
@app.post("/api/generate-email", response_model=EmailGenerationResponse)
async def generate_email(request: EmailGenerationRequest):
    """Generate an email using the Groq API."""
    try:
        headers = {
            "Authorization": f"Bearer {request.groq_api_key}",
            "Content-Type": "application/json",
        }

        payload = {
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are an expert email writer. Generate professional, well-structured emails "
                        "based on the user's prompt. Return only the email content without any additional "
                        "formatting or explanations. Include a clear subject line at the beginning marked "
                        "with 'Subject:' followed by the email body. Make sure the email is professional, "
                        "engaging, and appropriate for business communication."
                    ),
                },
                {
                    "role": "user",
                    "content": f"Generate an email based on this prompt: {request.prompt}",
                },
            ],
            "model": "llama3-8b-8192",
            "temperature": 0.7,
            "max_tokens": 1000,
        }

        logger.info("Generating email for prompt: %s...", request.prompt[:50])

        response = await http_client.post( # type: ignore
            "https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload
        )

        if response.status_code != 200:
            logger.error("Groq API error: %s - %s", response.status_code, response.text)
            raise HTTPException(
                status_code=400,
                detail=f"Failed to generate email. API error: {response.status_code}",
            )

        data = response.json()
        email_content = data["choices"][0]["message"]["content"]

        # Split into subject & body
        lines = email_content.split("\n")
        if lines and lines[0].lower().startswith("subject:"):
            subject = lines[0].replace("subject:", "").strip()
            body = "\n".join(lines[1:]).strip()
        else:
            subject = "Generated Email"
            body = email_content.strip()

        logger.info("Email generated successfully")
        return EmailGenerationResponse(subject=subject, content=body, generated_at=datetime.now())

    except httpx.RequestError as e:
        logger.exception("Network error")
        raise HTTPException(status_code=502, detail="Network error occurred") from e
    except Exception as e:
        logger.exception("Unexpected error generating email")
        raise HTTPException(status_code=500, detail="Internal server error") from e


@app.post("/api/send-email", response_model=EmailSendResponse)
async def send_email(request: EmailSendRequest):
    """Demo email sending (simulated)."""
    try:
        await asyncio.sleep(1)  # Simulate latency
        sent_successfully: List[str] = []

        for recipient in request.recipients:
            # Here you'd integrate with a real service
            sent_successfully.append(str(recipient))
            logger.info("Email 'sent' to %s", recipient)

        return EmailSendResponse(
            success=True,
            message=f"Email sent successfully to {len(sent_successfully)} recipient(s)",
            sent_to=sent_successfully,
            sent_at=datetime.now(),
        )

    except Exception as e:
        logger.exception("Error sending email")
        raise HTTPException(status_code=500, detail="Failed to send email") from e


@app.post("/api/send-email-smtp", response_model=EmailSendResponse)
async def send_email_smtp(request: EmailSendRequest):
    """Send an email via SMTP using the provided credentials."""
    if not request.sender_email or not request.sender_password:
        raise HTTPException(
            status_code=400,
            detail="Sender email and password are required for SMTP sending",
        )

    try:
        msg = MIMEMultipart()
        msg["From"] = request.sender_email
        msg["Subject"] = request.subject
        msg.attach(MIMEText(request.content, "plain"))

        server = smtplib.SMTP(request.smtp_server, request.smtp_port) # type: ignore
        server.starttls()
        server.login(request.sender_email, request.sender_password)

        sent_successfully: List[str] = []
        for recipient in request.recipients:
            try:
                msg["To"] = str(recipient)
                server.send_message(msg)
                sent_successfully.append(str(recipient))
                logger.info("Email sent via SMTP to %s", recipient)
                del msg["To"]
            except Exception as send_err:
                logger.error("Failed to send SMTP email to %s: %s", recipient, send_err)

        server.quit()

        if not sent_successfully:
            raise HTTPException(
                status_code=500, detail="Failed to send email to any recipients via SMTP"
            )

        return EmailSendResponse(
            success=True,
            message=f"Email sent successfully via SMTP to {len(sent_successfully)} recipient(s)",
            sent_to=sent_successfully,
            sent_at=datetime.now(),
        )

    except smtplib.SMTPAuthenticationError:
        raise HTTPException(
            status_code=401,
            detail="SMTP authentication failed. Check your email and password.",
        )
    except smtplib.SMTPException as smtp_err:
        logger.error("SMTP error: %s", smtp_err)
        raise HTTPException(status_code=500, detail=f"SMTP error: {smtp_err}")
    except Exception as e:
        logger.exception("Unexpected SMTP error")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to send email via SMTP")


@app.get("/api/groq-models")
async def get_groq_models(api_key: str):
    """Fetch the list of available Groq models."""
    try:
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        response = await http_client.get( # type: ignore
            "https://api.groq.com/openai/v1/models", headers=headers
        )
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to fetch models from Groq API")
        return response.json()
    except Exception as e:
        logger.exception("Error fetching Groq models")
        raise HTTPException(status_code=500, detail="Failed to fetch available models") from e


# --------------------------------------------------
# Local development entry-point
# --------------------------------------------------
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",  # lowercase 'backend' to match your folder name
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8000)),
        reload=True,
        log_level="info",
    )