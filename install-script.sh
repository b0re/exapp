# Add a note about Portainer integration
if [[ "$DOCKER_INSTALLED" =~ ^[Yy]$ ]]; then
    echo
    echo -e "${YELLOW}Portainer Integration:${NC}"
    echo "Since you're using Portainer, you can:"
    echo "1. Create a new stack in Portainer for this application"
    echo "2. Copy the content of docker-compose.yml to the stack configuration"
    echo "3. Deploy the stack through the Portainer interface"
    echo "4. Access the application through Portainer's published ports section"
    echo
fi#!/bin/bash

# Expense Tracker Installation Script for Ubuntu 22.04.5 LTS
# This script automates the installation process for the AI-enhanced Expense Tracker application

set -e  # Exit on error

# Text colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== AI-Enhanced Expense Tracker Installation Script ===${NC}"
echo -e "${YELLOW}This script will install and configure the Expense Tracker application on Ubuntu 22.04.5 LTS${NC}"
echo

# Check if running as root
if [ "$(id -u)" -eq 0 ]; then
    echo -e "${RED}ERROR: This script should not be run as root.${NC}"
    echo "Please run as a regular user with sudo privileges."
    exit 1
fi

# Function to display progress
progress() {
    echo -e "${GREEN}==>${NC} $1"
}

error() {
    echo -e "${RED}ERROR: $1${NC}"
    exit 1
}

warn() {
    echo -e "${YELLOW}WARNING: $1${NC}"
}

# Ask for installation directory
read -p "Enter installation directory path [default: ~/expense-tracker]: " INSTALL_DIR
INSTALL_DIR=${INSTALL_DIR:-~/expense-tracker}
INSTALL_DIR=$(eval echo $INSTALL_DIR)  # Expand ~ if present

# Ask for database credentials
read -p "PostgreSQL database name [default: expense_tracker]: " DB_NAME
DB_NAME=${DB_NAME:-expense_tracker}

read -p "PostgreSQL username [default: expense_user]: " DB_USER
DB_USER=${DB_USER:-expense_user}

read -p "PostgreSQL password [default: random generated]: " DB_PASSWORD
if [ -z "$DB_PASSWORD" ]; then
    DB_PASSWORD=$(openssl rand -base64 12)
    echo "Generated password: $DB_PASSWORD"
fi

# Ask for Google OAuth credentials
read -p "Enter your Google OAuth Client ID (required for Gmail integration): " GOOGLE_CLIENT_ID
read -p "Enter your Google OAuth Client Secret: " GOOGLE_CLIENT_SECRET

# Server domain/IP for Nginx config
read -p "Enter your server domain or IP address [e.g., example.com or IP]: " SERVER_DOMAIN

# Ask if user wants to install Docker
read -p "Do you already have Docker installed with Portainer? [Y/n]: " DOCKER_INSTALLED
DOCKER_INSTALLED=${DOCKER_INSTALLED:-Y}

if [[ "$DOCKER_INSTALLED" =~ ^[Yy]$ ]]; then
    progress "Docker already installed with Portainer, skipping Docker installation"
else
    read -p "Do you want to install Docker and Docker Compose? [Y/n]: " INSTALL_DOCKER
    INSTALL_DOCKER=${INSTALL_DOCKER:-Y}
fi

# Ask if user wants to configure for production
read -p "Configure for production with Nginx and SSL? [Y/n]: " SETUP_PRODUCTION
SETUP_PRODUCTION=${SETUP_PRODUCTION:-Y}

# Ask if user wants monitoring
read -p "Set up Prometheus and Grafana monitoring? [Y/n]: " SETUP_MONITORING
SETUP_MONITORING=${SETUP_MONITORING:-Y}

# Create installation directory
progress "Creating installation directory at $INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# Update system
progress "Updating system packages"
sudo apt update && sudo apt upgrade -y || error "Failed to update system packages"

# Install dependencies
progress "Installing system dependencies"
sudo apt install -y \
    python3-pip \
    python3-dev \
    build-essential \
    libssl-dev \
    libffi-dev \
    python3-setuptools \
    python3-venv \
    postgresql \
    postgresql-contrib \
    redis-server \
    nodejs \
    npm \
    nginx \
    curl \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release || error "Failed to install dependencies"

# Install Docker if requested
if [[ "$DOCKER_INSTALLED" =~ ^[Yy]$ ]]; then
    progress "Skipping Docker installation as it's already installed with Portainer"
elif [[ "$INSTALL_DOCKER" =~ ^[Yy]$ ]]; then
    progress "Installing Docker and Docker Compose"
    
    # Check if Docker is already installed
    if command -v docker &> /dev/null; then
        warn "Docker is already installed, skipping Docker installation"
    else
        # Install Docker
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
        
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
        
        sudo apt update
        sudo apt install -y docker-ce docker-ce-cli containerd.io
        
        # Add user to docker group
        sudo usermod -aG docker $USER
        warn "You may need to log out and log back in for Docker group changes to take effect"
    fi
    
    # Check if Docker Compose is already installed
    if command -v docker-compose &> /dev/null; then
        warn "Docker Compose is already installed, skipping Docker Compose installation"
    else
        # Install Docker Compose
        sudo curl -L "https://github.com/docker/compose/releases/download/v2.15.1/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
    fi
fi

# Setup PostgreSQL
progress "Setting up PostgreSQL database"
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;" || warn "Database might already exist"
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" || warn "User might already exist"
sudo -u postgres psql -c "ALTER ROLE $DB_USER SET client_encoding TO 'utf8';"
sudo -u postgres psql -c "ALTER ROLE $DB_USER SET default_transaction_isolation TO 'read committed';"
sudo -u postgres psql -c "ALTER ROLE $DB_USER SET timezone TO 'UTC';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

# Setup Redis
progress "Setting up Redis"
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Create project structure
progress "Creating project directory structure"
mkdir -p app/api app/models app/schemas app/ai app/database app/static
mkdir -p frontend/src/components/Dashboard frontend/src/api frontend/src/contexts frontend/public
mkdir -p migrations/versions
mkdir -p kubernetes monitoring/prometheus monitoring/grafana/provisioning

# Create Python virtual environment
progress "Setting up Python virtual environment"
python3 -m venv venv
source venv/bin/activate

# Create requirements.txt
progress "Creating requirements.txt"
cat > requirements.txt << 'EOL'
# FastAPI
fastapi==0.78.0
uvicorn==0.17.6
pydantic==1.9.1
email-validator==1.2.1

# Authentication
python-jose==3.3.0
passlib==1.7.4
python-multipart==0.0.5

# Database
sqlalchemy==1.4.37
alembic==1.8.0
psycopg2-binary==2.9.3

# Async processing
redis==4.3.4
aioredis==2.0.1
apscheduler==3.9.1

# Google integration
google-api-python-client==2.51.0
google-auth-oauthlib==0.5.2
google-auth==2.8.0

# ML and NLP
spacy==3.3.1
transformers==4.20.1
torch==1.12.0
prophet==1.1.1
scikit-learn==1.1.1
pandas==1.4.3
numpy==1.23.0
nltk==3.7
beautifulsoup4==4.11.1

# WebSockets and real-time
websockets==10.3

# Utils
python-dateutil==2.8.2
pytz==2022.1
python-dotenv==0.20.0
httpx==0.23.0
aiohttp==3.8.1
jinja2==3.1.2
markupsafe==2.1.1

# Monitoring and logging
prometheus-fastapi-instrumentator==5.8.1
structlog==22.1.0
python-json-logger==2.0.4
opentelemetry-api==1.12.0
opentelemetry-sdk==1.12.0
opentelemetry-exporter-prometheus==1.12.0
EOL

# Install Python dependencies
progress "Installing Python dependencies (this may take some time)"
pip install -r requirements.txt || error "Failed to install Python dependencies"

# Download NLP models
progress "Downloading NLP models"
python -m spacy download en_core_web_md || warn "Failed to download spaCy model, you may need to install it manually"
python -c "import nltk; nltk.download('punkt'); nltk.download('stopwords')" || warn "Failed to download NLTK data"

# Create .env file
progress "Creating environment configuration file"
cat > .env << EOL
# Database
POSTGRES_DB=$DB_NAME
POSTGRES_USER=$DB_USER
POSTGRES_PASSWORD=$DB_PASSWORD
DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@localhost/$DB_NAME

# Redis
REDIS_URL=redis://localhost:6379/0

# Security
SECRET_KEY=$(openssl rand -hex 32)

# Google OAuth
GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET

# Email fetching
EMAIL_FETCH_INTERVAL=86400  # 24 hours in seconds
EMAIL_FETCH_LIMIT=100
EOL

# Create Docker configuration files
progress "Creating Docker configuration files"
cat > Dockerfile << 'EOL'
# Dockerfile
FROM python:3.9-slim as backend

WORKDIR /app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install ML dependencies
RUN python -m spacy download en_core_web_md

# Copy backend code
COPY app ./app
COPY alembic.ini .
COPY migrations ./migrations

# Stage 2: Frontend build
FROM node:16 as frontend-build

WORKDIR /app

# Copy package.json and install dependencies
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# Copy frontend code and build
COPY frontend/ ./
RUN npm run build

# Stage 3: Final image
FROM python:3.9-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy from backend stage
COPY --from=backend /usr/local/lib/python3.9/site-packages /usr/local/lib/python3.9/site-packages
COPY --from=backend /app /app

# Copy from frontend build
COPY --from=frontend-build /app/build /app/static

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Expose port
EXPOSE 8000

# Set environment variables
ENV PYTHONPATH=/app
ENV FASTAPI_ENV=production

# Start command
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
EOL

cat > docker-compose.yml << 'EOL'
version: '3.8'

services:
  db:
    image: postgres:13
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-postgres}
      - POSTGRES_USER=${POSTGRES_USER:-postgres}
      - POSTGRES_DB=${POSTGRES_DB:-expense_tracker}
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:6
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    depends_on:
      - db
      - redis
    environment:
      - DATABASE_URL=postgresql://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD:-postgres}@db/${POSTGRES_DB:-expense_tracker}
      - REDIS_URL=redis://redis:6379/0
      - SECRET_KEY=${SECRET_KEY:-devsecretkeyneedtochange}
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    volumes:
      - ./app:/app/app  # For development: mount local app directory

  worker:
    build:
      context: .
      dockerfile: Dockerfile
    command: python -m app.worker
    depends_on:
      - db
      - redis
    environment:
      - DATABASE_URL=postgresql://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD:-postgres}@db/${POSTGRES_DB:-expense_tracker}
      - REDIS_URL=redis://redis:6379/0
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
    healthcheck:
      test: ["CMD", "ps", "aux", "|", "grep", "worker"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    volumes:
      - ./app:/app/app  # For development: mount local app directory

volumes:
  postgres_data:
EOL

# Create Alembic configuration for migrations
progress "Setting up database migrations"
cat > alembic.ini << EOL
[alembic]
script_location = migrations
prepend_sys_path = .
sqlalchemy.url = postgresql://$DB_USER:$DB_PASSWORD@localhost/$DB_NAME

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console
qualname =

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
EOL

cat > migrations/env.py << 'EOL'
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context
import os
import sys

# Add the app directory to Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Import the SQLAlchemy models
from app.models import Base

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Override sqlalchemy.url with environment variable if present
url = os.getenv("DATABASE_URL", None)
if url:
    config.set_main_option("sqlalchemy.url", url)

# Interpret the config file for Python logging.
# This line sets up loggers basically.
fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
target_metadata = Base.metadata

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline():
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
EOL

cat > migrations/script.py.mako << 'EOL'
"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}

"""
from alembic import op
import sqlalchemy as sa
${imports if imports else ""}

# revision identifiers, used by Alembic.
revision = ${repr(up_revision)}
down_revision = ${repr(down_revision)}
branch_labels = ${repr(branch_labels)}
depends_on = ${repr(depends_on)}


def upgrade():
    ${upgrades if upgrades else "pass"}


def downgrade():
    ${downgrades if downgrades else "pass"}
EOL

# Frontend setup
progress "Setting up React frontend"
cd frontend
npm init -y
npm install --save \
    react \
    react-dom \
    react-router-dom \
    react-query \
    @material-ui/core \
    @material-ui/icons \
    @material-ui/lab \
    @date-io/date-fns \
    @material-ui/pickers \
    axios \
    date-fns \
    react-google-login \
    @nivo/core \
    @nivo/pie \
    @nivo/line \
    @nivo/bar \
    recharts \
    formik \
    yup || warn "Some frontend dependencies may not have installed correctly"

# Return to main directory
cd "$INSTALL_DIR"

# Configure Nginx if production setup is requested
if [[ "$SETUP_PRODUCTION" =~ ^[Yy]$ ]]; then
    progress "Setting up Nginx"
    
    # Create Nginx configuration
    sudo cat > /etc/nginx/sites-available/expense-tracker << EOL
server {
    listen 80;
    server_name $SERVER_DOMAIN;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /ws {
        proxy_pass http://localhost:8000/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
    }
}
EOL

    # Enable the site
    sudo ln -sf /etc/nginx/sites-available/expense-tracker /etc/nginx/sites-enabled/
    sudo nginx -t
    sudo systemctl restart nginx

    # Set up SSL with Certbot (optional)
    read -p "Do you want to set up SSL with Certbot? (requires a domain name) [y/N]: " SETUP_SSL
    SETUP_SSL=${SETUP_SSL:-N}
    
    if [[ "$SETUP_SSL" =~ ^[Yy]$ ]]; then
        progress "Setting up SSL with Certbot"
        sudo snap install --classic certbot
        sudo ln -sf /snap/bin/certbot /usr/bin/certbot
        sudo certbot --nginx -d $SERVER_DOMAIN
    fi
fi

# Set up monitoring if requested
if [[ "$SETUP_MONITORING" =~ ^[Yy]$ ]]; then
    progress "Setting up monitoring"
    
    # Create monitoring docker-compose file
    cat > monitoring-docker-compose.yml << 'EOL'
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./monitoring/prometheus:/etc/prometheus
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/usr/share/prometheus/console_libraries'
      - '--web.console.templates=/usr/share/prometheus/consoles'

  grafana:
    image: grafana/grafana:latest
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning
    ports:
      - "3000:3000"
    depends_on:
      - prometheus
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin  # Change in production

volumes:
  prometheus_data:
  grafana_data:
EOL

    # Create Prometheus configuration
    mkdir -p monitoring/prometheus
    cat > monitoring/prometheus/prometheus.yml << 'EOL'
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'expense-tracker-api'
    static_configs:
      - targets: ['api:8000']
EOL
fi

# Display setup information
echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}Expense Tracker Installation Complete!${NC}"
echo -e "${GREEN}=====================================${NC}"
echo
echo -e "${YELLOW}Database Information:${NC}"
echo "Database Name: $DB_NAME"
echo "Username: $DB_USER"
echo "Password: $DB_PASSWORD"
echo
echo -e "${YELLOW}Installation Directory:${NC}"
echo "$INSTALL_DIR"
echo
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Create the Python application files in the app/ directory"
echo "2. Create the React frontend components in the frontend/src/ directory"
echo "3. Complete the Google OAuth setup if not already done"
echo "4. Start the application using Docker Compose:"
echo "   cd $INSTALL_DIR && docker-compose up -d"
echo "5. Apply database migrations:"
echo "   docker-compose exec api alembic upgrade head"
echo
echo "For monitoring (if enabled):"
echo "- Prometheus: http://$SERVER_DOMAIN:9090"
echo "- Grafana: http://$SERVER_DOMAIN:3000 (default login: admin/admin)"
echo

# Remind about Docker user group if Docker was installed (and not previously installed)
if [[ "$DOCKER_INSTALLED" =~ ^[Nn]$ ]] && [[ "$INSTALL_DOCKER" =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Note:${NC} You may need to log out and log back in for Docker group changes to take effect."
    echo "If you don't want to log out, you can run: newgrp docker"
fi

echo
echo -e "${GREEN}Thank you for installing the AI-Enhanced Expense Tracker!${NC}"
