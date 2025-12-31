# CI/CD Documentation

## Overview

This repository uses GitHub Actions for Continuous Integration and Continuous Deployment. The CI/CD pipeline is designed to be efficient, fast, and reliable.

## Workflows

### 1. CI Workflow (`.github/workflows/ci.yml`)

Runs on every push to `main`/`develop` and on pull requests.

**Jobs:**

- **Frontend**: Lints, type-checks, and builds the React/TypeScript frontend
- **Node.js Services**: Tests and validates all Node.js services (API Gateway, Chat, Media, Story)
- **Java Services**: Runs Maven tests and builds JARs for Spring Boot services (Auth, User, Notification)
- **Docker Build**: Builds Docker images for all services in parallel
- **Integration Test**: Validates docker-compose configuration (runs on main/develop pushes only)
- **CI Success**: Final validation that all checks passed

**Features:**
- ✅ Parallel execution for faster builds
- ✅ Dependency caching (npm, Maven)
- ✅ Matrix strategy for similar services
- ✅ Docker layer caching for faster image builds
- ✅ Test result artifacts
- ✅ Build artifacts for deployment

### 2. Code Quality Workflow (`.github/workflows/code-quality.yml`)

Runs alongside CI to check code quality and security.

**Checks:**
- Large file detection (> 1MB)
- Secret scanning (TruffleHog)
- YAML validation
- Dockerfile verification

## Performance Optimizations

1. **Dependency Caching**: npm and Maven dependencies are cached between runs
2. **Docker Layer Caching**: Uses GitHub Actions cache for Docker builds
3. **Parallel Execution**: Services are tested in parallel using matrix strategy
4. **Fail Fast**: Set to `false` so all jobs complete to see all failures
5. **Artifact Retention**: Short retention periods for build artifacts to save storage

## Running Locally

To test CI workflows locally, you can use [act](https://github.com/nektos/act):

```bash
# Install act
brew install act  # macOS
# or download from https://github.com/nektos/act/releases

# Run CI workflow
act push

# Run specific job
act -j frontend
```

## Environment Variables

The following environment variables are set in the workflows:

- `NODE_VERSION`: '18'
- `JAVA_VERSION`: '17'

For production deployments, set these as repository secrets:
- Database credentials
- JWT secrets
- AWS credentials (for media service)
- Docker registry credentials (if pushing images)

## Adding New Services

When adding a new service:

1. **Node.js Service:**
   - Add to `nodejs-services` matrix in `ci.yml`
   - Ensure `package-lock.json` exists for caching

2. **Java Service:**
   - Add to `java-services` matrix in `ci.yml`
   - Ensure `pom.xml` exists for Maven caching

3. **Docker Build:**
   - Add to `docker-build` matrix in `ci.yml`
   - Add Dockerfile verification in `code-quality.yml`

## Troubleshooting

### Build Failures

- Check job logs in GitHub Actions
- Verify dependencies are up to date
- Ensure all required environment variables are set

### Slow Builds

- Check cache hit rates in job logs
- Verify cache keys are correct
- Consider splitting workflows if they're too large

### Test Failures

- Review test result artifacts
- Check database connectivity for integration tests
- Verify environment variables in test jobs

## Best Practices

1. **Keep workflows fast**: Aim for < 10 minutes total runtime
2. **Use caching**: Always cache dependencies when possible
3. **Run in parallel**: Use matrix strategies for similar jobs
4. **Fail fast in development**: Set `fail-fast: true` for faster feedback (optional)
5. **Monitor costs**: Review GitHub Actions usage regularly
6. **Security**: Never commit secrets, always use GitHub Secrets

