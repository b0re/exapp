# gmail_integration.py - Gmail API and Email Parsing

import os
import base64
import re
from datetime import datetime
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from bs4 import BeautifulSoup
from email.parser import BytesParser
from email import policy
import dateutil.parser

from app import celery, db, User, Category, Expense

# Gmail API scopes
SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

def get_gmail_service(refresh_token):
    """Create a Gmail API service using the user's refresh token."""
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

@celery.task
def fetch_emails_for_user(user_id):
    """Fetch purchase-related emails for a specific user."""
    user = User.query.get(user_id)
    
    if not user:
        return {'error': 'User not found'}
    
    service = get_gmail_service(user.refresh_token)
    
    # Search for purchase-related emails
    query = 'subject:(receipt OR order OR invoice OR purchase OR confirmation) newer_than:1d'
    results = service.users().messages().list(userId='me', q=query).execute()
    messages = results.get('messages', [])
    
    for message in messages:
        process_email_message.delay(user_id, message['id'])
    
    return {'success': True, 'processed_count': len(messages)}

@celery.task
def process_email_message(user_id, message_id):
    """Process a single email message to extract expense information."""
    user = User.query.get(user_id)
    
    if not user:
        return {'error': 'User not found'}
    
    # Check if this email has already been processed
    existing_expense = Expense.query.filter_by(email_id=message_id).first()
    if existing_expense:
        return {'status': 'skipped', 'reason': 'already_processed'}
    
    service = get_gmail_service(user.refresh_token)
    
    # Get the email message
    message = service.users().messages().get(userId='me', id=message_id, format='full').execute()
    
    # Extract email details
    payload = message['payload']
    headers = payload['headers']
    
    # Get subject and date
    subject = next((header['value'] for header in headers if header['name'] == 'Subject'), '')
    date_str = next((header['value'] for header in headers if header['name'] == 'Date'), '')
    
    try:
        date = dateutil.parser.parse(date_str).date()
    except:
        date = datetime.now().date()
    
    # Extract email body
    if 'parts' in payload:
        parts = payload['parts']
        data = None
        for part in parts:
            if part['mimeType'] == 'text/plain':
                data = part['body'].get('data', '')
                break
            elif part['mimeType'] == 'text/html':
                data = part['body'].get('data', '')
        
        if data:
            text = base64.urlsafe_b64decode(data).decode('utf-8')
        else:
            text = ''
    else:
        data = payload['body'].get('data', '')
        text = base64.urlsafe_b64decode(data).decode('utf-8') if data else ''
    
    # Parse email body for expense details
    results = extract_expense_details(text, subject)
    
    if results:
        # Create expense record
        expense = Expense(
            date=date,
            amount=results['amount'],
            merchant=results['merchant'],
            description=results.get('description', ''),
            user_id=user_id,
            email_id=message_id
        )
        
        # Attempt to categorize the expense
        categorize_expense(expense, user_id)
        
        db.session.add(expense)
        db.session.commit()
        
        return {'status': 'success', 'expense_id': expense.id}
    
    return {'status': 'skipped', 'reason': 'no_expense_details_found'}

def extract_expense_details(text, subject):
    """Extract expense details from email text."""
    results = {}
    
    # Try to extract from HTML content
    if '<html' in text.lower():
        soup = BeautifulSoup(text, 'html.parser')
        
        # Remove script and style elements
        for script in soup(["script", "style"]):
            script.extract()
        
        # Get visible text
        text = soup.get_text()
    
    # Clean up text
    text = ' '.join(text.split())
    
    # Try to extract amount
    amount_patterns = [
        r'(?:total|amount|charge|payment)(?:\s+\w+){0,3}\s+\$\s*(\d+(?:\.\d{2})?)',
        r'\$\s*(\d+(?:\.\d{2})?)\s+(?:total|amount|charge|payment)',
        r'(?:USD|US\$)\s*(\d+(?:\.\d{2})?)',
        r'(\d+\.\d{2})\s+(?:USD|US\$|dollars)'
    ]
    
    for pattern in amount_patterns:
        amount_match = re.search(pattern, text, re.IGNORECASE)
        if amount_match:
            results['amount'] = float(amount_match.group(1).replace(',', ''))
            break
    
    # If no amount found, try a more general pattern
    if 'amount' not in results:
        amount_match = re.search(r'\$\s*(\d+(?:,\d{3})*(?:\.\d{2})?)', text)
        if amount_match:
            results['amount'] = float(amount_match.group(1).replace(',', ''))
    
    # Extract merchant from subject or text
    merchant_from_subject = extract_merchant_from_subject(subject)
    
    if merchant_from_subject:
        results['merchant'] = merchant_from_subject
    else:
        # Try to extract from common patterns
        merchant_patterns = [
            r'(?:from|vendor|merchant|store|retailer):\s+([A-Za-z0-9\s\.]+)',
            r'Thank\s+you\s+for\s+(?:your\s+purchase|ordering|shopping)\s+(?:from|with|at)\s+([A-Za-z0-9\s\.]+)'
        ]
        
        for pattern in merchant_patterns:
            merchant_match = re.search(pattern, text, re.IGNORECASE)
            if merchant_match:
                results['merchant'] = merchant_match.group(1).strip()
                break
    
    # If no merchant found, use domain from email
    if 'merchant' not in results:
        for header in message['payload']['headers']:
            if header['name'] == 'From':
                from_value = header['value']
                email_match = re.search(r'<([^>]+)>', from_value)
                if email_match:
                    email = email_match.group(1)
                    domain = email.split('@')[1]
                    results['merchant'] = domain.split('.')[0].capitalize()
                else:
                    results['merchant'] = from_value.split(' ')[0]
                break
    
    # Extract description (order number, item details, etc.)
    description_patterns = [
        r'(?:order|confirmation)\s+(?:number|#):\s*([A-Za-z0-9\-]+)',
        r'(?:invoice|receipt)\s+(?:number|#):\s*([A-Za-z0-9\-]+)',
        r'(?:purchase|bought|ordered):\s+(.+?)(?:\.|$)'
    ]
    
    for pattern in description_patterns:
        desc_match = re.search(pattern, text, re.IGNORECASE)
        if desc_match:
            results['description'] = desc_match.group(1).strip()
            break
    
    # If we have at least amount and merchant, return the results
    if 'amount' in results and 'merchant' in results:
        return results
    
    return None

def extract_merchant_from_subject(subject):
    """Extract merchant name from email subject."""
    # Common patterns in email subjects
    patterns = [
        r'(?:Your|New) (?:order|purchase) (?:from|with) ([A-Za-z0-9\s\.]+)',
        r'([A-Za-z0-9\s\.]+) (?:order|receipt|invoice|confirmation)',
        r'(?:Receipt|Confirmation) for ([A-Za-z0-9\s\.]+)',
        r'Thanks for (?:ordering|shopping) (?:from|with|at) ([A-Za-z0-9\s\.]+)'
    ]
    
    for pattern in patterns:
        match = re.search(pattern, subject, re.IGNORECASE)
        if match:
            return match.group(1).strip()
    
    return None

def categorize_expense(expense, user_id):
    """Categorize an expense based on merchant and description."""
    # Get user categories
    categories = Category.query.filter_by(user_id=user_id).all()
    category_dict = {cat.name.lower(): cat.id for cat in categories}
    
    # First, try merchant-based rules
    merchant_rules = {
        'grocery': ['kroger', 'safeway', 'trader joe', 'aldi', 'whole foods', 'wegmans'],
        'restaurant': ['doordash', 'ubereats', 'grubhub', 'mcdonalds', 'chipotle', 'starbucks'],
        'transportation': ['uber', 'lyft', 'amtrak', 'delta', 'southwest', 'united'],
        'shopping': ['amazon', 'walmart', 'target', 'ebay', 'etsy', 'best buy'],
        'entertainment': ['netflix', 'hulu', 'spotify', 'disney+', 'hbo', 'amc'],
        'utilities': ['comcast', 'verizon', 'at&t', 'pge', 'water bill', 'electric']
    }
    
    merchant_lower = expense.merchant.lower()
    
    for category, merchants in merchant_rules.items():
        if any(merchant in merchant_lower for merchant in merchants):
            if category.lower() in category_dict:
                expense.category_id = category_dict[category.lower()]
                return
    
    # Next, try to detect seasonal categories
    now = datetime.now()
    
    # Christmas/Holiday
    if now.month in [11, 12] and any(keyword in expense.description.lower() for keyword in ['gift', 'christmas', 'holiday']):
        # Check if we have a Holiday category, or create one
        if 'holiday' in category_dict:
            expense.category_id = category_dict['holiday']
            return
        elif 'christmas' in category_dict:
            expense.category_id = category_dict['christmas']
            return
    
    # Travel
    if any(keyword in expense.description.lower() for keyword in ['flight', 'hotel', 'vacation', 'travel', 'booking']):
        if 'travel' in category_dict:
            expense.category_id = category_dict['travel']
            return
    
    # Default to "Uncategorized" or "Other"
    if 'uncategorized' in category_dict:
        expense.category_id = category_dict['uncategorized']
    elif 'other' in category_dict:
        expense.category_id = category_dict['other']

@celery.task
def schedule_email_fetching():
    """Schedule email fetching for all users."""
    users = User.query.all()
    
    for user in users:
        fetch_emails_for_user.delay(user.id)
    
    return {'success': True, 'user_count': len(users)}
