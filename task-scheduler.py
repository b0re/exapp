# app/task_scheduler.py
import os
import base64
from datetime import datetime, timedelta
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from sqlalchemy.orm import Session
import asyncio
import logging

from app.database import get_db_context
from app.models import User, Expense, Category
from app.ai.email_parser_ml import MLEmailParser
from app.ai.nlp_processor import ExpenseNLPProcessor

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Gmail API scopes
SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

def get_gmail_service(refresh_token):
    """Create a Gmail API service using the user's refresh token"""
    try:
        creds = Credentials.from_authorized_user_info(
            {
                'refresh_token': refresh_token,
                'client_id': os.environ.get('GOOGLE_CLIENT_ID'),
                'client_secret': os.environ.get('GOOGLE_CLIENT_SECRET'),
                'token_uri': 'https://oauth2.googleapis.com/token',
                'scopes': SCOPES
            }
        )
        
        return build('gmail', 'v1', credentials=creds)
    except Exception as e:
        logger.error(f"Error creating Gmail service: {e}")
        return None

async def schedule_email_fetch(db_getter):
    """Schedule email fetching for all users"""
    logger.info("Starting scheduled email fetch for all users")
    
    db = next(db_getter())
    try:
        users = db.query(User).all()
        
        for user in users:
            # Use asyncio to run tasks in parallel
            asyncio.create_task(fetch_emails(user.id))
        
        logger.info(f"Scheduled email fetch for {len(users)} users")
    except Exception as e:
        logger.error(f"Error scheduling email fetch: {e}")
    finally:
        db.close()

async def fetch_emails(user_id: int):
    """Fetch and process emails for a user"""
    logger.info(f"Fetching emails for user {user_id}")
    
    with get_db_context() as db:
        user = db.query(User).filter(User.id == user_id).first()
        
        if not user:
            logger.error(f"User {user_id} not found")
            return
        
        service = get_gmail_service(user.refresh_token)
        
        if not service:
            logger.error(f"Could not create Gmail service for user {user_id}")
            return
        
        # Search for purchase-related emails (last 7 days)
        seven_days_ago = (datetime.now() - timedelta(days=7)).strftime('%Y/%m/%d')
        query = f'subject:(receipt OR order OR invoice OR purchase OR confirmation) after:{seven_days_ago}'
        
        try:
            results = service.users().messages().list(userId='me', q=query).execute()
            messages = results.get('messages', [])
            
            logger.info(f"Found {len(messages)} potential purchase emails for user {user_id}")
            
            # Process each email
            for message in messages:
                await process_email(db, user, service, message['id'])
                
            logger.info(f"Email fetch completed for user {user_id}")
        except Exception as e:
            logger.error(f"Error fetching emails for user {user_id}: {e}")

async def process_email(db: Session, user: User, service, message_id: str):
    """Process a single email to extract expense information"""
    logger.info(f"Processing email {message_id} for user {user.id}")
    
    # Check if this email has already been processed
    existing_expense = db.query(Expense).filter(Expense.email_id == message_id).first()
    if existing_expense:
        logger.info(f"Email {message_id} already processed, skipping")
        return
    
    try:
        # Get the email message
        message = service.users().messages().get(userId='me', id=message_id, format='full').execute()
        
        # Extract email details
        payload = message['payload']
        headers = payload['headers']
        
        # Get subject
        subject = next((header['value'] for header in headers if header['name'].lower() == 'subject'), '')
        
        # Get date
        date_str = next((header['value'] for header in headers if header['name'].lower() == 'date'), '')
        try:
            import dateutil.parser
            date = dateutil.parser.parse(date_str).date()
        except:
            date = datetime.now().date()
        
        # Extract email body
        email_text = extract_email_body(payload)
        
        # Use ML email parser
        email_parser = MLEmailParser()
        results = email_parser.extract_expense_details(email_text, subject)
        
        if results and 'amount' in results and 'merchant' in results:
            # Create expense record
            expense = Expense(
                date=results.get('date', date),
                amount=results['amount'],
                merchant=results['merchant'],
                description=results.get('description', ''),
                user_id=user.id,
                email_id=message_id
            )
            
            # Try to categorize expense
            await categorize_expense(db, expense, user.id)
            
            db.add(expense)
            db.commit()
            
            logger.info(f"Created expense from email {message_id}: {expense.merchant} ${expense.amount}")
            
            # Notify connected clients about new expense
            # This would integrate with the WebSocket manager
            # await notify_new_expense(user.id, expense)
        else:
            logger.info(f"Could not extract expense details from email {message_id}")
    
    except Exception as e:
        logger.error(f"Error processing email {message_id}: {e}")
        db.rollback()

def extract_email_body(payload):
    """Extract email body from Gmail API payload"""
    text = ""
    
    if 'parts' in payload:
        parts = payload['parts']
        
        # First try to get plain text
        for part in parts:
            if part['mimeType'] == 'text/plain':
                data = part['body'].get('data', '')
                if data:
                    text = base64.urlsafe_b64decode(data).decode('utf-8')
                    break
        
        # If no plain text, try HTML
        if not text:
            for part in parts:
                if part['mimeType'] == 'text/html':
                    data = part['body'].get('data', '')
                    if data:
                        html = base64.urlsafe_b64decode(data).decode('utf-8')
                        # Convert HTML to plain text
                        from bs4 import BeautifulSoup
                        soup = BeautifulSoup(html, 'html.parser')
                        text = soup.get_text(separator=' ', strip=True)
                        break
    else:
        # Single part message
        data = payload['body'].get('data', '')
        if data:
            text = base64.urlsafe_b64decode(data).decode('utf-8')
    
    return text

async def categorize_expense(db: Session, expense: Expense, user_id: int):
    """Categorize an expense using NLP"""
    # Initialize NLP processor
    nlp_processor = ExpenseNLPProcessor()
    
    # Predict category
    category_name = nlp_processor.predict_category(expense)
    
    if category_name:
        # Look up category by name
        category = db.query(Category).filter(
            Category.name.ilike(category_name),
            Category.user_id == user_id
        ).first()
        
        if category:
            expense.category_id = category.id
        else:
            # Create new category if it doesn't exist
            new_category = Category(name=category_name, user_id=user_id)
            db.add(new_category)
            db.flush()  # Get ID without committing
            expense.category_id = new_category.id
