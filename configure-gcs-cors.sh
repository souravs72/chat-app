#!/bin/bash

# Script to configure CORS on Google Cloud Storage bucket
# This allows browser-based direct uploads to GCS

BUCKET_NAME="chat_bucket_112"
PROJECT_ID="proven-audio-483011-g2"

echo "Configuring CORS for GCS bucket: $BUCKET_NAME"
echo ""

# Check if gsutil is available
if ! command -v gsutil &> /dev/null; then
    echo "❌ gsutil is not installed."
    echo "Please install Google Cloud SDK: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "❌ Not authenticated with gcloud."
    echo "Please run: gcloud auth login"
    exit 1
fi

# Set the project
gcloud config set project $PROJECT_ID

# Configure CORS
echo "Setting CORS configuration..."
gsutil cors set gcs-cors-config.json gs://$BUCKET_NAME

if [ $? -eq 0 ]; then
    echo "✅ CORS configuration applied successfully!"
    echo ""
    echo "To verify, run:"
    echo "  gsutil cors get gs://$BUCKET_NAME"
else
    echo "❌ Failed to configure CORS"
    exit 1
fi

