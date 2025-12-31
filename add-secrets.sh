#!/bin/bash
# Script to add GitHub secrets using GitHub CLI
# Usage: ./add-secrets.sh
# 
# Note: You'll need to be authenticated with GitHub CLI first:
#   gh auth login

REPO="souravs72/chat-app"

echo "GitHub Secrets Setup for $REPO"
echo "================================"
echo ""
echo "This script will help you add secrets to your GitHub repository."
echo "Make sure you have the actual secret values ready."
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."

# Check if GitHub CLI is authenticated
if ! gh auth status &>/dev/null; then
    echo "❌ GitHub CLI is not authenticated."
    echo "Please run: gh auth login"
    exit 1
fi

echo ""
echo "For each secret, enter the value (or press Enter to skip):"
echo ""

# Database Secrets
read -p "DB_HOST (e.g., postgres or your-db-host.com): " DB_HOST
if [ ! -z "$DB_HOST" ]; then
    gh secret set DB_HOST -R "$REPO" -b "$DB_HOST"
    echo "✅ Added DB_HOST"
fi

read -p "DB_PORT (e.g., 5432): " DB_PORT
if [ ! -z "$DB_PORT" ]; then
    gh secret set DB_PORT -R "$REPO" -b "$DB_PORT"
    echo "✅ Added DB_PORT"
fi

read -p "DB_NAME (e.g., chatdb): " DB_NAME
if [ ! -z "$DB_NAME" ]; then
    gh secret set DB_NAME -R "$REPO" -b "$DB_NAME"
    echo "✅ Added DB_NAME"
fi

read -p "DB_USER (e.g., postgres): " DB_USER
if [ ! -z "$DB_USER" ]; then
    gh secret set DB_USER -R "$REPO" -b "$DB_USER"
    echo "✅ Added DB_USER"
fi

read -sp "DB_PASSWORD: " DB_PASSWORD
echo ""
if [ ! -z "$DB_PASSWORD" ]; then
    gh secret set DB_PASSWORD -R "$REPO" -b "$DB_PASSWORD"
    echo "✅ Added DB_PASSWORD"
fi

# JWT Secret
read -sp "JWT_SECRET (minimum 32 characters): " JWT_SECRET
echo ""
if [ ! -z "$JWT_SECRET" ]; then
    gh secret set JWT_SECRET -R "$REPO" -b "$JWT_SECRET"
    echo "✅ Added JWT_SECRET"
fi

# AWS Credentials
read -p "AWS_ACCESS_KEY_ID (optional, press Enter to skip): " AWS_ACCESS_KEY_ID
if [ ! -z "$AWS_ACCESS_KEY_ID" ]; then
    gh secret set AWS_ACCESS_KEY_ID -R "$REPO" -b "$AWS_ACCESS_KEY_ID"
    echo "✅ Added AWS_ACCESS_KEY_ID"
fi

read -sp "AWS_SECRET_ACCESS_KEY (optional): " AWS_SECRET_ACCESS_KEY
echo ""
if [ ! -z "$AWS_SECRET_ACCESS_KEY" ]; then
    gh secret set AWS_SECRET_ACCESS_KEY -R "$REPO" -b "$AWS_SECRET_ACCESS_KEY"
    echo "✅ Added AWS_SECRET_ACCESS_KEY"
fi

read -p "S3_BUCKET (optional, e.g., chat-media): " S3_BUCKET
if [ ! -z "$S3_BUCKET" ]; then
    gh secret set S3_BUCKET -R "$REPO" -b "$S3_BUCKET"
    echo "✅ Added S3_BUCKET"
fi

echo ""
echo "================================"
echo "✅ Secret setup complete!"
echo ""
echo "Note: The basic CI workflow will work without secrets."
echo "Secrets are only needed for deployment workflows."
echo ""
echo "To view all secrets: gh secret list -R $REPO"

