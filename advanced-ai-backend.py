# app/ai/nlp_processor.py
import spacy
import pandas as pd
from transformers import pipeline
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
import numpy as np
from datetime import datetime, timedelta
from prophet import Prophet
import torch
from torch import nn
import pickle
import os
import joblib
from app.models import Expense, Category, User

# Load NLP models
try:
    nlp = spacy.load("en_core_web_md")
except:
    # Download if not available
    import spacy.cli
    spacy.cli.download("en_core_web_md")
    nlp = spacy.load("en_core_web_md")

# Initialize Hugging Face transformers
zero_shot_classifier = pipeline("zero-shot-classification")

class ExpenseNLPProcessor:
    """Advanced NLP processor for expense categorization"""
    
    def __init__(self, model_path="models/category_classifier.pkl"):
        self.model_path = model_path
        self.categories = None
        self.model = None
        self.vectorizer = None
        self.load_or_create_model()
    
    def load_or_create_model(self):
        """Load model if exists, otherwise create a placeholder"""
        if os.path.exists(self.model_path):
            with open(self.model_path, 'rb') as f:
                model_data = pickle.load(f)
                self.model = model_data.get('model')
                self.vectorizer = model_data.get('vectorizer')
                self.categories = model_data.get('categories')
        else:
            # We'll train the model when we have data
            self.model = None
    
    def preprocess_text(self, text):
        """Preprocess text for NLP analysis"""
        if not text:
            return ""
        
        # Process with spaCy
        doc = nlp(text.lower())
        
        # Remove stopwords and punctuation, lemmatize
        tokens = [token.lemma_ for token in doc if not token.is_stop and not token.is_punct]
        
        return " ".join(tokens)
    
    def extract_features(self, expense_text):
        """Extract NLP features from expense text"""
        # Process with spaCy
        doc = nlp(expense_text)
        
        # Extract entities (companies, products, amounts)
        entities = [(ent.text, ent.label_) for ent in doc.ents]
        
        # Get key noun phrases
        noun_phrases = [chunk.text for chunk in doc.noun_chunks]
        
        # Extract keywords (non-stopword tokens)
        keywords = [token.text for token in doc if not token.is_stop and token.is_alpha]
        
        return {
            "entities": entities,
            "noun_phrases": noun_phrases,
            "keywords": keywords,
            "vector": doc.vector
        }
    
    def train_model(self, expenses):
        """Train NLP model on expense data"""
        if not expenses or len(expenses) < 10:
            return False

        # Extract text data and categories
        texts = []
        labels = []
        categories = set()
        
        for expense in expenses:
            combined_text = f"{expense.merchant} {expense.description if expense.description else ''}"
            text = self.preprocess_text(combined_text)
            
            if expense.category and expense.category.name:
                texts.append(text)
                labels.append(expense.category.name)
                categories.add(expense.category.name)
        
        if not texts:
            return False
        
        # Convert to DataFrame for easier processing
        df = pd.DataFrame({'text': texts, 'category': labels})
        
        # Use spaCy for vectorization
        vectors = [nlp(text).vector for text in df['text']]
        
        # Use scikit-learn for classification
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.model_selection import train_test_split
        
        X = np.array(vectors)
        y = df['category'].values
        
        # Train model
        model = RandomForestClassifier(n_estimators=100, random_state=42)
        model.fit(X, y)
        
        # Save the model
        os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
        with open(self.model_path, 'wb') as f:
            pickle.dump({
                'model': model,
                'vectorizer': None,  # We're using spaCy directly
                'categories': list(categories)
            }, f)
        
        self.model = model
        self.categories = list(categories)
        
        return True
    
    def predict_category(self, expense):
        """Predict category for a new expense"""
        if not self.model:
            return self.zero_shot_classification(expense)
        
        combined_text = f"{expense.merchant} {expense.description if expense.description else ''}"
        text = self.preprocess_text(combined_text)
        vector = nlp(text).vector
        
        # Predict using trained model
        prediction = self.model.predict([vector])[0]
        
        return prediction
    
    def zero_shot_classification(self, expense):
        """Fallback to zero-shot classification if no model is trained"""
        # Define common expense categories
        common_categories = [
            "Food & Dining", "Groceries", "Shopping", "Transportation", 
            "Entertainment", "Bills & Utilities", "Health", "Travel", 
            "Education", "Personal Care", "Home", "Gifts", "Business"
        ]
        
        # Extract text data
        combined_text = f"{expense.merchant} {expense.description if expense.description else ''}"
        
        # Use zero-shot classification
        result = zero_shot_classifier(
            combined_text,
            candidate_labels=common_categories,
        )
        
        # Return the most likely category
        return result['labels'][0]
    
    def extract_email_info(self, email_text):
        """Extract expense information from email text using NLP"""
        doc = nlp(email_text)
        
        # Extract amounts (money)
        amounts = []
        for token in doc:
            if token.like_num and token.i > 0:
                prev_token = doc[token.i - 1]
                if prev_token.text == '$' or prev_token.text.startswith('$'):
                    amount = token.text
                    try:
                        amount_float = float(amount.replace(',', ''))
                        amounts.append(amount_float)
                    except ValueError:
                        pass
        
        # Use entities for organization (merchant) detection
        organizations = [ent.text for ent in doc.ents if ent.label_ == "ORG"]
        
        # Look for dates
        dates = [ent.text for ent in doc.ents if ent.label_ == "DATE"]
        
        # Extract order or transaction numbers
        import re
        order_patterns = [
            r'order\s+(?:number|#)?:\s*([A-Za-z0-9\-]+)',
            r'confirmation\s+(?:number|#)?:\s*([A-Za-z0-9\-]+)',
            r'transaction\s+(?:number|#)?:\s*([A-Za-z0-9\-]+)',
            r'receipt\s+(?:number|#)?:\s*([A-Za-z0-9\-]+)'
        ]
        
        order_numbers = []
        for pattern in order_patterns:
            matches = re.findall(pattern, email_text, re.IGNORECASE)
            order_numbers.extend(matches)
        
        return {
            "amounts": amounts,
            "merchants": organizations,
            "dates": dates,
            "order_numbers": order_numbers
        }


# app/ai/expense_predictor.py
class ExpensePredictor:
    """Predicts future expenses using Prophet time series model"""
    
    def __init__(self, model_path="models/expense_prophet.pkl"):
        self.model_path = model_path
        self.model = None
        self.load_model()
    
    def load_model(self):
        """Load Prophet model if exists"""
        if os.path.exists(self.model_path):
            with open(self.model_path, 'rb') as f:
                self.model = pickle.load(f)
        else:
            self.model = None
    
    def prepare_data(self, expenses):
        """Prepare expense data for Prophet"""
        # Convert expenses to DataFrame
        data = []
        for expense in expenses:
            data.append({
                'ds': expense.date,
                'y': expense.amount,
                'category': expense.category.name if expense.category else 'Uncategorized',
                'merchant': expense.merchant
            })
        
        df = pd.DataFrame(data)
        
        # Aggregate by day
        daily_df = df.groupby('ds')['y'].sum().reset_index()
        
        return daily_df
    
    def train_model(self, expenses):
        """Train Prophet model on historical expense data"""
        if not expenses or len(expenses) < 30:  # Need reasonable amount of data
            return False
        
        # Prepare data
        df = self.prepare_data(expenses)
        
        # Initialize and train model
        model = Prophet(
            yearly_seasonality=True,
            weekly_seasonality=True,
            daily_seasonality=False,
            seasonality_mode='multiplicative'
        )
        model.fit(df)
        
        # Save model
        os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
        with open(self.model_path, 'wb') as f:
            pickle.dump(model, f)
        
        self.model = model
        return True
    
    def predict_future_expenses(self, periods=30):
        """Predict future expenses"""
        if not self.model:
            return None
        
        # Create future dataframe
        future = self.model.make_future_dataframe(periods=periods)
        
        # Make predictions
        forecast = self.model.predict(future)
        
        # Format results
        predictions = []
        for _, row in forecast.tail(periods).iterrows():
            predictions.append({
                'date': row['ds'].strftime('%Y-%m-%d'),
                'amount': round(max(0, row['yhat']), 2),
                'lower_bound': round(max(0, row['yhat_lower']), 2),
                'upper_bound': round(max(0, row['yhat_upper']), 2)
            })
        
        return predictions
    
    def predict_category_expenses(self, expenses, category_name, periods=30):
        """Predict expenses for a specific category"""
        # Filter expenses by category
        category_expenses = [e for e in expenses if e.category and e.category.name == category_name]
        
        if len(category_expenses) < 15:  # Need reasonable amount of data
            return None
        
        # Prepare data
        df = self.prepare_data(category_expenses)
        
        # Train category-specific model
        model = Prophet(
            yearly_seasonality=True,
            weekly_seasonality=True,
            daily_seasonality=False
        )
        model.fit(df)
        
        # Create future dataframe
        future = model.make_future_dataframe(periods=periods)
        
        # Make predictions
        forecast = model.predict(future)
        
        # Format results
        predictions = []
        for _, row in forecast.tail(periods).iterrows():
            predictions.append({
                'date': row['ds'].strftime('%Y-%m-%d'),
                'amount': round(max(0, row['yhat']), 2),
                'category': category_name
            })
        
        return predictions


# app/ai/budget_recommender.py
class BudgetRecommender:
    """AI-driven budget recommendations based on spending patterns"""
    
    def __init__(self):
        self.kmeans_model = None
        self.scaler = None
    
    def analyze_spending_patterns(self, user_id, months=3):
        """Analyze user's spending patterns"""
        # Get user's expenses for the specified period
        from datetime import datetime, timedelta
        end_date = datetime.now()
        start_date = end_date - timedelta(days=30 * months)
        
        # Query user's expenses
        from app.models import Expense
        from app import db
        
        expenses = Expense.query.filter(
            Expense.user_id == user_id,
            Expense.date >= start_date,
            Expense.date <= end_date
        ).all()
        
        if not expenses:
            return None
        
        # Convert to DataFrame
        data = []
        for expense in expenses:
            data.append({
                'date': expense.date,
                'amount': expense.amount,
                'category': expense.category.name if expense.category else 'Uncategorized',
                'merchant': expense.merchant
            })
        
        df = pd.DataFrame(data)
        
        # Aggregate spending by category
        category_spending = df.groupby('category')['amount'].sum().reset_index()
        
        # Calculate total spending
        total_spending = df['amount'].sum()
        
        # Calculate percentage of spending by category
        category_spending['percentage'] = category_spending['amount'] / total_spending * 100
        
        return category_spending
    
    def cluster_users_by_spending(self, all_user_expenses):
        """Cluster users by their spending patterns"""
        if len(all_user_expenses) < 5:  # Need enough users to cluster
            return None
        
        # Prepare features for clustering
        features = []
        user_ids = []
        
        for user_id, expenses in all_user_expenses.items():
            # Convert to DataFrame
            data = []
            for expense in expenses:
                data.append({
                    'amount': expense.amount,
                    'category': expense.category.name if expense.category else 'Uncategorized'
                })
            
            df = pd.DataFrame(data)
            
            # Skip users with no expenses
            if df.empty:
                continue
            
            # Aggregate by category
            category_totals = df.groupby('category')['amount'].sum()
            
            # Create feature vector (spending by category)
            feature_vector = []
            for category in sorted(set(df['category'].unique())):
                if category in category_totals:
                    feature_vector.append(category_totals[category])
                else:
                    feature_vector.append(0)
            
            # Normalize by total spending
            total_spending = sum(feature_vector)
            if total_spending > 0:
                feature_vector = [x / total_spending for x in feature_vector]
            
            features.append(feature_vector)
            user_ids.append(user_id)
        
        if not features:
            return None
        
        # Standardize features
        self.scaler = StandardScaler()
        scaled_features = self.scaler.fit_transform(features)
        
        # Determine optimal number of clusters
        from sklearn.metrics import silhouette_score
        
        silhouette_scores = []
        max_clusters = min(len(scaled_features) - 1, 10)
        
        for k in range(2, max_clusters + 1):
            kmeans = KMeans(n_clusters=k, random_state=42)
            cluster_labels = kmeans.fit_predict(scaled_features)
            silhouette_avg = silhouette_score(scaled_features, cluster_labels)
            silhouette_scores.append(silhouette_avg)
        
        # Choose optimal number of clusters
        optimal_clusters = silhouette_scores.index(max(silhouette_scores)) + 2
        
        # Perform clustering
        self.kmeans_model = KMeans(n_clusters=optimal_clusters, random_state=42)
        clusters = self.kmeans_model.fit_predict(scaled_features)
        
        # Map users to clusters
        user_clusters = {}
        for i, user_id in enumerate(user_ids):
            user_clusters[user_id] = int(clusters[i])
        
        return user_clusters
    
    def recommend_budget(self, user_id, similar_users=None):
        """Generate budget recommendations based on user's spending and similar users"""
        # Analyze user's current spending
        user_spending = self.analyze_spending_patterns(user_id)
        
        if user_spending is None:
            return None
        
        # Get expense prediction for next month
        predictor = ExpensePredictor()
        user = User.query.get(user_id)
        future_expenses = predictor.predict_future_expenses(periods=30)
        
        if future_expenses:
            predicted_monthly_total = sum(expense['amount'] for expense in future_expenses)
        else:
            # Fallback: use average of last 3 months
            expenses = Expense.query.filter_by(user_id=user_id).all()
            df = pd.DataFrame([{'date': e.date, 'amount': e.amount} for e in expenses])
            monthly_totals = df.set_index('date').resample('M')['amount'].sum()
            predicted_monthly_total = monthly_totals.mean() if not monthly_totals.empty else 0
        
        # Base recommendations on current spending patterns
        recommendations = []
        
        # Get typical allocations from similar users if available
        if similar_users and self.kmeans_model:
            # Find user's cluster
            expenses = Expense.query.filter_by(user_id=user_id).all()
            data = [{'amount': e.amount, 'category': e.category.name if e.category else 'Uncategorized'} 
                   for e in expenses]
            df = pd.DataFrame(data)
            
            # Create feature vector for user
            category_totals = df.groupby('category')['amount'].sum() if not df.empty else pd.Series()
            feature_vector = []
            for category in sorted(set(df['category'].unique())):
                if category in category_totals:
                    feature_vector.append(category_totals[category])
                else:
                    feature_vector.append(0)
            
            # Normalize
            total_spending = sum(feature_vector)
            if total_spending > 0:
                feature_vector = [x / total_spending for x in feature_vector]
            
            # Scale and predict cluster
            scaled_vector = self.scaler.transform([feature_vector])
            user_cluster = self.kmeans_model.predict(scaled_vector)[0]
            
            # Get all users in the same cluster
            cluster_users = [u_id for u_id, cluster in similar_users.items() 
                           if cluster == user_cluster and u_id != user_id]
            
            # Collect spending patterns of similar users
            similar_spending = []
            for similar_user_id in cluster_users:
                similar_pattern = self.analyze_spending_patterns(similar_user_id)
                if similar_pattern is not None:
                    similar_spending.append(similar_pattern)
            
            # Generate recommendations based on similar users' patterns
            if similar_spending:
                # Combine all similar users' data
                combined_df = pd.concat(similar_spending)
                avg_percentages = combined_df.groupby('category')['percentage'].mean()
                
                # Generate recommendations
                for category, avg_pct in avg_percentages.items():
                    # Find user's current percentage for this category
                    user_pct = user_spending.loc[user_spending['category'] == category, 'percentage'].values
                    user_pct = user_pct[0] if len(user_pct) > 0 else 0
                    
                    # Calculate recommended budget
                    recommended_budget = predicted_monthly_total * (avg_pct / 100)
                    
                    # Add recommendation
                    recommendations.append({
                        'category': category,
                        'current_percentage': user_pct,
                        'recommended_percentage': avg_pct,
                        'recommended_budget': round(recommended_budget, 2),
                        'reason': 'Based on similar users' if user_pct < avg_pct else 'You spend more than similar users'
                    })
                
                return {
                    'predicted_monthly_expense': round(predicted_monthly_total, 2),
                    'recommendations': recommendations
                }
        
        # Fallback: use general budgeting guidelines
        general_guidelines = {
            'Housing': 30,
            'Transportation': 15,
            'Food & Dining': 15,
            'Groceries': 10,
            'Bills & Utilities': 10,
            'Healthcare': 5,
            'Entertainment': 5,
            'Shopping': 5,
            'Savings': 10,
            'Other': 5
        }
        
        # Generate recommendations based on general guidelines
        for category, recommended_pct in general_guidelines.items():
            # Find user's current percentage for this category
            user_pct = user_spending.loc[user_spending['category'] == category, 'percentage'].values
            user_pct = user_pct[0] if len(user_pct) > 0 else 0
            
            # Calculate recommended budget
            recommended_budget = predicted_monthly_total * (recommended_pct / 100)
            
            # Add recommendation
            recommendations.append({
                'category': category,
                'current_percentage': user_pct,
                'recommended_percentage': recommended_pct,
                'recommended_budget': round(recommended_budget, 2),
                'reason': 'Based on general budgeting guidelines'
            })
        
        return {
            'predicted_monthly_expense': round(predicted_monthly_total, 2),
            'recommendations': recommendations
        }


# app/ai/email_parser_ml.py
class MLEmailParser:
    """Machine learning-based email parser for expense extraction"""
    
    def __init__(self, model_path="models/email_parser_model.pkl"):
        self.model_path = model_path
        self.ner_model = None
        self.load_or_initialize_model()
    
    def load_or_initialize_model(self):
        """Load NER model if exists, otherwise initialize with defaults"""
        if torch.cuda.is_available():
            self.device = torch.device("cuda")
        else:
            self.device = torch.device("cpu")
            
        if os.path.exists(self.model_path):
            self.ner_model = torch.load(self.model_path, map_location=self.device)
        else:
            # Initialize with pre-trained transformer model
            try:
                from transformers import AutoModelForTokenClassification, AutoTokenizer
                
                # Use a pre-trained NER model
                model_name = "dbmdz/bert-large-cased-finetuned-conll03-english"
                self.tokenizer = AutoTokenizer.from_pretrained(model_name)
                self.ner_model = AutoModelForTokenClassification.from_pretrained(model_name)
                self.ner_model.to(self.device)
            except Exception as e:
                print(f"Error initializing transformer model: {e}")
                self.ner_model = None
    
    def extract_expense_details(self, email_text, email_subject=""):
        """Extract expense details from email using ML"""
        # First try transformer-based NER if available
        if self.ner_model:
            results = self.extract_with_transformers(email_text, email_subject)
            if self.validate_extraction(results):
                return results
        
        # Fallback to traditional NLP
        nlp_processor = ExpenseNLPProcessor()
        nlp_results = nlp_processor.extract_email_info(email_text)
        
        # Process NLP results
        result = {}
        
        # Extract amount
        if nlp_results['amounts']:
            # Take the most likely amount
            # Heuristic: Prefer amounts that are not too small or too large
            filtered_amounts = [a for a in nlp_results['amounts'] if 1 <= a <= 10000]
            if filtered_amounts:
                result['amount'] = max(filtered_amounts)  # Take the largest amount as it's likely the total
            else:
                result['amount'] = max(nlp_results['amounts']) if nlp_results['amounts'] else None
        
        # Extract merchant
        if nlp_results['merchants']:
            # Take the most frequently mentioned organization
            from collections import Counter
            merchant_counter = Counter(nlp_results['merchants'])
            result['merchant'] = merchant_counter.most_common(1)[0][0]
        else:
            # Try to extract from subject
            result['merchant'] = self.extract_merchant_from_subject(email_subject)
        
        # Extract date
        if nlp_results['dates']:
            import dateutil.parser
            try:
                result['date'] = dateutil.parser.parse(nlp_results['dates'][0]).date()
            except:
                result['date'] = datetime.now().date()
        else:
            result['date'] = datetime.now().date()
        
        # Extract description
        result['description'] = ""
        if nlp_results['order_numbers']:
            result['description'] = f"Order #{nlp_results['order_numbers'][0]}"
        
        return result if 'amount' in result and 'merchant' in result else None
    
    def extract_with_transformers(self, email_text, email_subject=""):
        """Extract entities using transformers model"""
        try:
            from transformers import pipeline
            
            # Use NER pipeline
            ner = pipeline("ner", model=self.ner_model, tokenizer=self.tokenizer, device=0 if torch.cuda.is_available() else -1)
            
            # Process text
            ner_results = ner(email_text)
            
            # Extract relevant entities
            amounts = []
            organizations = []
            dates = []
            
            for entity in ner_results:
                if entity['entity'].endswith('ORG'):
                    organizations.append(entity['word'])
                elif entity['entity'].endswith('DATE'):
                    dates.append(entity['word'])
                elif entity['entity'].endswith('MONEY') or entity['entity'].endswith('CARDINAL'):
                    # Check if it's a money amount
                    import re
                    if re.search(r'\$?\d+(?:\.\d{2})?', entity['word']):
                        # Extract the number
                        amount_match = re.search(r'\$?(\d+(?:\.\d{2})?)', entity['word'])
                        if amount_match:
                            try:
                                amount = float(amount_match.group(1))
                                amounts.append(amount)
                            except ValueError:
                                pass
            
            # Process extracted entities
            result = {}
            
            # Extract amount
            if amounts:
                # Take the most likely amount
                filtered_amounts = [a for a in amounts if 1 <= a <= 10000]
                if filtered_amounts:
                    result['amount'] = max(filtered_amounts)
                else:
                    result['amount'] = max(amounts) if amounts else None
            
            # Extract merchant
            if organizations:
                result['merchant'] = organizations[0]
            else:
                # Try to extract from subject
                result['merchant'] = self.extract_merchant_from_subject(email_subject)
            
            # Extract date
            if dates:
                import dateutil.parser
                try:
                    result['date'] = dateutil.parser.parse(dates[0]).date()
                except:
                    result['date'] = datetime.now().date()
            else:
                result['date'] = datetime.now().date()
            
            # Extract description
            result['description'] = ""
            
            return result if 'amount' in result and 'merchant' in result else None
            
        except Exception as e:
            print(f"Error in transformer extraction: {e}")
            return None
    
    def extract_merchant_from_subject(self, subject):
        """Extract merchant name from email subject"""
        if not subject:
            return None
            
        # Use NLP to extract organization
        doc = nlp(subject)
        
        # Look for organizations
        orgs = [ent.text for ent in doc.ents if ent.label_ == "ORG"]
        if orgs:
            return orgs[0]
        
        # Fallback: use heuristics
        # Common patterns in subjects
        import re
        patterns = [
            r'(?:Receipt|Order|Confirmation) from ([\w\s&]+)',
            r'([\w\s&]+) Order Confirmation',
            r'Your ([\w\s&]+) order',
            r'Thanks for your ([\w\s&]+) order'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, subject, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        
        # Last resort: use the first part of the subject
        words = subject.split()
        if words:
            return words[0]
        
        return "Unknown Merchant"
    
    def validate_extraction(self, result):
        """Validate extracted expense details"""
        if not result:
            return False
            
        # Check required fields
        if 'amount' not in result or 'merchant' not in result:
            return False
            
        # Validate amount
        if not result['amount'] or result['amount'] <= 0 or result['amount'] > 50000:
            return False
            
        # Validate merchant
        if not result['merchant'] or len(result['merchant']) < 2:
            return False
            
        return True
    
    def fine_tune_model(self, annotated_emails):
        """Fine-tune the NER model with annotated email data"""
        # This would require annotated data with expense entities
        # Not implemented in this sample due to complexity
        pass
