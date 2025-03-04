# app.py - Main Flask Application

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from celery import Celery
from datetime import datetime
import os
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Configure database
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'postgresql://postgres:postgres@localhost/expense_tracker')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Configure Celery
app.config['CELERY_BROKER_URL'] = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')
app.config['CELERY_RESULT_BACKEND'] = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')

# Initialize extensions
db = SQLAlchemy(app)
migrate = Migrate(app, db)

# Initialize Celery
celery = Celery(app.name, broker=app.config['CELERY_BROKER_URL'])
celery.conf.update(app.config)

# Models
class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    refresh_token = db.Column(db.String(500), nullable=False)
    categories = db.relationship('Category', backref='user', lazy=True)
    expenses = db.relationship('Expense', backref='user', lazy=True)
    
    def __repr__(self):
        return f'<User {self.email}>'

class Category(db.Model):
    __tablename__ = 'categories'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    expenses = db.relationship('Expense', backref='category', lazy=True)
    
    def __repr__(self):
        return f'<Category {self.name}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name
        }

class Expense(db.Model):
    __tablename__ = 'expenses'
    
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False)
    amount = db.Column(db.Float, nullable=False)
    merchant = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(500))
    category_id = db.Column(db.Integer, db.ForeignKey('categories.id'))
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    email_id = db.Column(db.String(100), unique=True)  # Gmail message ID to avoid duplicates
    
    def __repr__(self):
        return f'<Expense {self.merchant} {self.amount}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'date': self.date.strftime('%Y-%m-%d'),
            'amount': self.amount,
            'merchant': self.merchant,
            'description': self.description,
            'category_id': self.category_id,
            'category_name': self.category.name if self.category else 'Uncategorized'
        }

# Authentication routes
@app.route('/api/auth/google', methods=['POST'])
def google_auth():
    data = request.get_json()
    email = data.get('email')
    refresh_token = data.get('refresh_token')
    
    if not email or not refresh_token:
        return jsonify({'error': 'Missing email or refresh token'}), 400
    
    # Check if user exists
    user = User.query.filter_by(email=email).first()
    
    if user:
        # Update refresh token
        user.refresh_token = refresh_token
    else:
        # Create new user
        user = User(email=email, refresh_token=refresh_token)
        
        # Create default categories for new user
        default_categories = ['Food', 'Shopping', 'Transportation', 'Entertainment', 'Bills', 'Other']
        for cat_name in default_categories:
            category = Category(name=cat_name, user_id=user.id)
            db.session.add(category)
    
    db.session.add(user)
    db.session.commit()
    
    return jsonify({'success': True, 'user_id': user.id}), 200

# Category routes
@app.route('/api/categories', methods=['GET'])
def get_categories():
    user_id = request.args.get('user_id')
    
    if not user_id:
        return jsonify({'error': 'Missing user_id parameter'}), 400
    
    categories = Category.query.filter_by(user_id=user_id).all()
    
    return jsonify({
        'categories': [category.to_dict() for category in categories]
    }), 200

@app.route('/api/categories', methods=['POST'])
def create_category():
    data = request.get_json()
    name = data.get('name')
    user_id = data.get('user_id')
    
    if not name or not user_id:
        return jsonify({'error': 'Missing name or user_id'}), 400
    
    category = Category(name=name, user_id=user_id)
    db.session.add(category)
    db.session.commit()
    
    return jsonify({'success': True, 'category': category.to_dict()}), 201

@app.route('/api/categories/<int:category_id>', methods=['PUT'])
def update_category(category_id):
    data = request.get_json()
    name = data.get('name')
    
    if not name:
        return jsonify({'error': 'Missing name'}), 400
    
    category = Category.query.get(category_id)
    
    if not category:
        return jsonify({'error': 'Category not found'}), 404
    
    category.name = name
    db.session.commit()
    
    return jsonify({'success': True, 'category': category.to_dict()}), 200

@app.route('/api/categories/<int:category_id>', methods=['DELETE'])
def delete_category(category_id):
    category = Category.query.get(category_id)
    
    if not category:
        return jsonify({'error': 'Category not found'}), 404
    
    # Get the "Uncategorized" category or create it
    uncategorized = Category.query.filter_by(name='Uncategorized', user_id=category.user_id).first()
    
    if not uncategorized:
        uncategorized = Category(name='Uncategorized', user_id=category.user_id)
        db.session.add(uncategorized)
        db.session.commit()
    
    # Reassign expenses to "Uncategorized"
    expenses = Expense.query.filter_by(category_id=category.id).all()
    for expense in expenses:
        expense.category_id = uncategorized.id
    
    db.session.delete(category)
    db.session.commit()
    
    return jsonify({'success': True}), 200

# Expense routes
@app.route('/api/expenses', methods=['GET'])
def get_expenses():
    user_id = request.args.get('user_id')
    
    if not user_id:
        return jsonify({'error': 'Missing user_id parameter'}), 400
    
    # Optional filters
    category_id = request.args.get('category_id')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    query = Expense.query.filter_by(user_id=user_id)
    
    if category_id:
        query = query.filter_by(category_id=category_id)
    
    if start_date:
        query = query.filter(Expense.date >= datetime.strptime(start_date, '%Y-%m-%d'))
    
    if end_date:
        query = query.filter(Expense.date <= datetime.strptime(end_date, '%Y-%m-%d'))
    
    expenses = query.order_by(Expense.date.desc()).all()
    
    return jsonify({
        'expenses': [expense.to_dict() for expense in expenses]
    }), 200

@app.route('/api/expenses', methods=['POST'])
def create_expense():
    data = request.get_json()
    date = data.get('date')
    amount = data.get('amount')
    merchant = data.get('merchant')
    description = data.get('description')
    category_id = data.get('category_id')
    user_id = data.get('user_id')
    
    if not date or not amount or not merchant or not user_id:
        return jsonify({'error': 'Missing required fields'}), 400
    
    expense = Expense(
        date=datetime.strptime(date, '%Y-%m-%d'),
        amount=float(amount),
        merchant=merchant,
        description=description,
        category_id=category_id,
        user_id=user_id
    )
    
    db.session.add(expense)
    db.session.commit()
    
    return jsonify({'success': True, 'expense': expense.to_dict()}), 201

@app.route('/api/expenses/<int:expense_id>', methods=['PUT'])
def update_expense(expense_id):
    data = request.get_json()
    date = data.get('date')
    amount = data.get('amount')
    merchant = data.get('merchant')
    description = data.get('description')
    category_id = data.get('category_id')
    
    expense = Expense.query.get(expense_id)
    
    if not expense:
        return jsonify({'error': 'Expense not found'}), 404
    
    if date:
        expense.date = datetime.strptime(date, '%Y-%m-%d')
    if amount:
        expense.amount = float(amount)
    if merchant:
        expense.merchant = merchant
    if description is not None:
        expense.description = description
    if category_id is not None:
        expense.category_id = category_id
    
    db.session.commit()
    
    return jsonify({'success': True, 'expense': expense.to_dict()}), 200

@app.route('/api/expenses/<int:expense_id>', methods=['DELETE'])
def delete_expense(expense_id):
    expense = Expense.query.get(expense_id)
    
    if not expense:
        return jsonify({'error': 'Expense not found'}), 404
    
    db.session.delete(expense)
    db.session.commit()
    
    return jsonify({'success': True}), 200

# Dashboard routes
@app.route('/api/dashboard/summary', methods=['GET'])
def get_dashboard_summary():
    user_id = request.args.get('user_id')
    
    if not user_id:
        return jsonify({'error': 'Missing user_id parameter'}), 400
    
    # Get current month expenses
    current_month = datetime.now().replace(day=1)
    expenses = Expense.query.filter_by(user_id=user_id)\
        .filter(Expense.date >= current_month).all()
    
    # Calculate total spending
    total_spending = sum(expense.amount for expense in expenses)
    
    # Spending by category
    spending_by_category = {}
    for expense in expenses:
        category_name = expense.category.name if expense.category else 'Uncategorized'
        if category_name in spending_by_category:
            spending_by_category[category_name] += expense.amount
        else:
            spending_by_category[category_name] = expense.amount
    
    # Top merchants
    merchant_spending = {}
    for expense in expenses:
        if expense.merchant in merchant_spending:
            merchant_spending[expense.merchant] += expense.amount
        else:
            merchant_spending[expense.merchant] = expense.amount
    
    top_merchants = sorted(merchant_spending.items(), key=lambda x: x[1], reverse=True)[:5]
    
    return jsonify({
        'total_spending': total_spending,
        'spending_by_category': spending_by_category,
        'top_merchants': dict(top_merchants)
    }), 200

if __name__ == '__main__':
    app.run(debug=True)
