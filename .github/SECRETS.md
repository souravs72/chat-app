# GitHub Secrets Configuration Guide

This document lists the secrets that should be added to your GitHub repository for the CI/CD pipelines to work properly.

## How to Add Secrets

1. Go to your repository on GitHub: https://github.com/souravs72/chat-app
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret listed below

## Required Secrets

### For CI/CD Workflows (Optional for basic CI)

The basic CI workflow will work without secrets, but you may need these for deployment and advanced features:

#### Database Secrets (For Production Deployment)
- `DB_HOST` - Database host (e.g., `postgres` or `your-db-host.com`)
- `DB_PORT` - Database port (e.g., `5432`)
- `DB_NAME` - Database name (e.g., `chatdb`)
- `DB_USER` - Database username (e.g., `postgres`)
- `DB_PASSWORD` - Database password

#### JWT Secret (For Production)
- `JWT_SECRET` - JWT signing secret (minimum 32 characters, e.g., `production-secret-key-minimum-32-characters-for-hs256-algorithm`)

#### AWS Credentials (For Media Service)
- `AWS_ACCESS_KEY_ID` - AWS access key ID
- `AWS_SECRET_ACCESS_KEY` - AWS secret access key
- `S3_BUCKET` - S3 bucket name (e.g., `chat-media`)
- `S3_ENDPOINT` - S3 endpoint (optional, for custom S3-compatible storage)
- `S3_FORCE_PATH_STYLE` - Force path-style URLs (optional, `true` or `false`)

#### Docker Registry (If using private registry)
- `DOCKER_REGISTRY_USERNAME` - Docker registry username
- `DOCKER_REGISTRY_PASSWORD` - Docker registry password/token

## Environment-Specific Secrets

If you're using GitHub Environments (staging/production), you can add environment-specific secrets:

1. Go to **Settings** → **Environments**
2. Create environments (e.g., `staging`, `production`)
3. Add secrets specific to each environment

## Current Status

✅ **Basic CI will work without secrets** - The CI workflow doesn't require any secrets for basic testing and building.

⚠️ **Deployment workflow requires secrets** - The deployment workflow (`deploy.yml`) uses `GITHUB_TOKEN` automatically, but you'll need additional secrets if deploying to external infrastructure.

## Testing Secrets

To verify your secrets are configured correctly:

1. Push a commit to trigger the CI workflow
2. Check the Actions tab to see if workflows run successfully
3. For deployment, use the "Deploy" workflow with manual dispatch

## Security Best Practices

1. **Never commit secrets** to the repository
2. **Use environment-specific secrets** for different deployment environments
3. **Rotate secrets regularly**
4. **Use least privilege** - Only grant necessary permissions
5. **Review secret usage** periodically in the Actions logs

## Notes

- The `GITHUB_TOKEN` is automatically provided by GitHub Actions and doesn't need to be added manually
- For local development, use `.env` files (already in `.gitignore`)
- Production secrets should be different from development secrets

