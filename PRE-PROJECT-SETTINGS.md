# ConversationIQ - Pre-Project Settings & Development Standards

## Overview
This document establishes the mandatory development standards, validation requirements, and quality gates that must be followed throughout the ConversationIQ project. These rules ensure production-ready code quality from day one and prevent deployment issues.

## Core Development Philosophy

### Test-Driven Development (TDD) Process
**MANDATORY**: All development must follow strict TDD methodology:

1. **RED**: Write a failing test first
2. **GREEN**: Write minimal code to make the test pass
3. **REFACTOR**: Improve the code while keeping tests green

**No exceptions**: Code without tests will not be accepted into the main branch.

### Quality Gates (Non-Negotiable)
- ✅ **100% Test Coverage** - Every line of code must be tested
- ✅ **100% Test Pass Rate** - All tests must pass before merge
- ✅ **Zero TypeScript Errors** - Strict mode enabled, no `any` types
- ✅ **Zero Lint Errors** - ESLint rules enforced at pre-commit

## Build Validation Requirements

### 1. Pre-Development Checks
**MANDATORY**: Run these commands before starting any new feature or bug fix:

```bash
# Verify current state is clean
npm run build
npm run type-check
npm run lint
npm run test
npm run test:coverage
```

**Rule**: If any of these commands fail, fix the issues before proceeding with new development.

### 2. Component Development Standards

#### UI Component Requirements
- **Import Validation**: Ensure all imported UI components exist as actual files (not just TypeScript declarations)
- **Shadcn/ui Components**: Create missing components immediately when referenced
- **Import Resolution**: Verify all imports resolve correctly in both dev and production modes

#### Component Creation Checklist
```typescript
// ✅ GOOD: Component with test file
src/components/SentimentIndicator.tsx
src/components/SentimentIndicator.test.tsx

// ❌ BAD: Component without test
src/components/SentimentIndicator.tsx
```

### 3. Database Schema Synchronization

#### Prisma Requirements
- **Schema Sync**: Keep Prisma schema synchronized with API route expectations
- **Generation**: Run `npx prisma generate` after any schema changes
- **Validation**: Validate that all database fields referenced in code exist in schema

#### Required Commands After Schema Changes
```bash
npx prisma generate
npx prisma db push      # Development only
npm run db:migrate      # Production migrations
npm run test:db         # Test database operations
```

### 4. Production-Ready Development Standards

#### TypeScript Configuration
```json
// tsconfig.json - MANDATORY settings
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true
  }
}
```

#### Build Validation Process
- **Frequent Builds**: Test builds frequently, not just at deployment time
- **Local Production**: Use production build locally before pushing changes
- **Build Verification**: Every feature branch must build successfully

## Required Scripts & Commands

### Development Workflow Commands
```bash
# 1. BEFORE STARTING DEVELOPMENT
npm run build           # Verify production build works
npm run type-check      # TypeScript compilation check
npm run lint           # ESLint validation
npm run test           # Run all tests
npm run test:coverage  # Verify 100% coverage

# 2. DURING DEVELOPMENT (TDD Cycle)
npm run test:watch     # Continuous test running
npm run dev           # Development server

# 3. AFTER MAKING CHANGES
npm run build         # Verify production build still works
npm run test         # Ensure all tests pass
npm run lint:fix     # Auto-fix linting issues
npm run type-check   # Verify TypeScript compilation

# 4. BEFORE COMMIT
npm run pre-commit   # Runs all validation checks
npm run test:coverage # Verify coverage remains 100%

# 5. DATABASE OPERATIONS
npm run db:generate  # Update Prisma client after schema changes
npm run db:migrate   # Apply database migrations
npm run db:seed     # Seed development database
npm run db:reset    # Reset database (development only)
```

### Package.json Scripts (Required)
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "type-check": "tsc --noEmit",
    "lint": "eslint . --ext .ts,.tsx,.js,.jsx",
    "lint:fix": "eslint . --ext .ts,.tsx,.js,.jsx --fix",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage --coverageThreshold.global.branches=100 --coverageThreshold.global.functions=100 --coverageThreshold.global.lines=100 --coverageThreshold.global.statements=100",
    "test:ci": "jest --ci --coverage --watchAll=false",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:seed": "prisma db seed",
    "db:reset": "prisma migrate reset",
    "pre-commit": "npm run lint && npm run type-check && npm run test && npm run build"
  }
}
```

## Git Workflow Standards

### Branch Protection Rules
- **Main Branch**: Protected, requires PR approval
- **Feature Branches**: Must pass all quality gates
- **Commit Requirements**: All commits must pass pre-commit hooks

### .gitignore Requirements
```gitignore
# Build outputs
dist-electron/
*.exe
*.dmg
*.AppImage
build/
dist/

# Dependencies
node_modules/
.pnp
.pnp.js

# Testing
coverage/
.nyc_output

# Environment
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
logs
lerna-debug.log*

# Database
*.db
*.sqlite
```

### Commit Message Standards
```bash
# Format: <type>(<scope>): <description>
# Examples:
feat(api): add sentiment analysis endpoint
fix(ui): resolve WebSocket connection issues
test(auth): add authentication service tests
docs(readme): update installation instructions
```

### Pre-commit Hook Configuration
```bash
#!/bin/sh
# .husky/pre-commit

echo "🔍 Running pre-commit validation..."

# 1. Lint check
npm run lint
if [ $? -ne 0 ]; then
  echo "❌ Linting failed. Please fix errors before committing."
  exit 1
fi

# 2. Type check
npm run type-check
if [ $? -ne 0 ]; then
  echo "❌ TypeScript compilation failed. Please fix errors before committing."
  exit 1
fi

# 3. Test check
npm run test
if [ $? -ne 0 ]; then
  echo "❌ Tests failed. Please fix failing tests before committing."
  exit 1
fi

# 4. Coverage check
npm run test:coverage
if [ $? -ne 0 ]; then
  echo "❌ Test coverage below 100%. Please add tests to achieve full coverage."
  exit 1
fi

# 5. Build check
npm run build
if [ $? -ne 0 ]; then
  echo "❌ Build failed. Please fix build errors before committing."
  exit 1
fi

echo "✅ All pre-commit checks passed!"
```

## Testing Standards

### Test Coverage Requirements
- **Line Coverage**: 100% - Every line of code must be executed by tests
- **Branch Coverage**: 100% - Every conditional branch must be tested
- **Function Coverage**: 100% - Every function must be called by tests
- **Statement Coverage**: 100% - Every statement must be executed

### Test Organization Structure
```
src/
├── components/
│   ├── SentimentIndicator.tsx
│   └── SentimentIndicator.test.tsx
├── services/
│   ├── aiService.ts
│   └── aiService.test.ts
├── utils/
│   ├── dateUtils.ts
│   └── dateUtils.test.ts
└── __tests__/
    ├── integration/
    ├── e2e/
    └── fixtures/
```

### Test Types Required
1. **Unit Tests**: Test individual functions/components in isolation
2. **Integration Tests**: Test interaction between modules
3. **E2E Tests**: Test complete user workflows
4. **API Tests**: Test all API endpoints with various scenarios
5. **Database Tests**: Test all database operations

### Jest Configuration
```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.tsx',
    '!src/types/**/*'
  ],
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100
    }
  },
  coverageReporters: ['text', 'lcov', 'html'],
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{ts,tsx}',
    '<rootDir>/src/**/*.{test,spec}.{ts,tsx}'
  ]
};
```

## Code Quality Standards

### ESLint Configuration
```javascript
// .eslintrc.js
module.exports = {
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    '@typescript-eslint/recommended-requiring-type-checking',
    'next/core-web-vitals'
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/prefer-nullish-coalescing': 'error',
    '@typescript-eslint/prefer-optional-chain': 'error',
    'no-console': 'warn',
    'prefer-const': 'error',
    'no-var': 'error'
  }
};
```

### Prettier Configuration
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2,
  "useTabs": false
}
```

## Development Environment Setup

### Required Node.js Version
```json
// package.json
{
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=8.0.0"
  }
}
```

### Environment Variables Template
```bash
# .env.example
DATABASE_URL="postgresql://username:password@localhost:5432/conversationiq"
REDIS_URL="redis://localhost:6379"
OPENAI_API_KEY="your-openai-api-key"
ZENDESK_CLIENT_ID="your-zendesk-client-id"
ZENDESK_CLIENT_SECRET="your-zendesk-client-secret"
JWT_SECRET="your-jwt-secret"
ENCRYPTION_KEY="your-encryption-key"
```

### Docker Development Environment
```dockerfile
# Dockerfile.dev
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Run development server
CMD ["npm", "run", "dev"]
```

## CI/CD Pipeline Requirements

### GitHub Actions Workflow
```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Lint check
      run: npm run lint
    
    - name: Type check
      run: npm run type-check
    
    - name: Run tests
      run: npm run test:ci
    
    - name: Build check
      run: npm run build
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
```

## Performance Requirements

### Build Performance Targets
- **Build Time**: < 2 minutes for full build
- **Test Execution**: < 30 seconds for full test suite
- **Type Checking**: < 10 seconds
- **Linting**: < 5 seconds

### Runtime Performance Targets
- **Initial Page Load**: < 3 seconds
- **API Response Time**: < 500ms (P95)
- **WebSocket Latency**: < 100ms
- **Database Queries**: < 100ms average

## Security Requirements

### Code Security Standards
- **No Hardcoded Secrets**: Use environment variables
- **Input Validation**: Validate all user inputs
- **SQL Injection Prevention**: Use parameterized queries
- **XSS Prevention**: Sanitize all outputs
- **CSRF Protection**: Implement CSRF tokens

### Dependency Security
```bash
# Regular security audits
npm audit --audit-level high
npm run security:check
```

## Documentation Requirements

### Code Documentation
- **JSDoc Comments**: Required for all public functions
- **README Updates**: Keep documentation current
- **API Documentation**: Auto-generated from code
- **Architecture Decision Records**: Document major decisions

### Example JSDoc
```typescript
/**
 * Analyzes sentiment of a given text message
 * @param message - The text message to analyze
 * @param context - Additional context for analysis
 * @returns Promise resolving to sentiment analysis result
 * @throws {ValidationError} When message is empty or invalid
 * @example
 * ```typescript
 * const result = await analyzeSentiment("I'm happy with the service", {});
 * console.log(result.polarity); // "positive"
 * ```
 */
async function analyzeSentiment(
  message: string,
  context: AnalysisContext
): Promise<SentimentResult> {
  // Implementation
}
```

## Monitoring & Observability

### Required Metrics
- **Test Coverage**: Track coverage trends
- **Build Success Rate**: Monitor CI/CD health
- **Code Quality**: Track lint/type errors
- **Performance**: Monitor build and test times

### Health Checks
```typescript
// Required health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version,
    uptime: process.uptime()
  });
});
```

## Enforcement & Compliance

### Automated Enforcement
- **Pre-commit Hooks**: Prevent bad commits
- **CI/CD Gates**: Block deployments on failures
- **Branch Protection**: Require PR reviews and checks
- **Automated Reviews**: Use tools like CodeClimate

### Manual Reviews
- **Code Review Checklist**: Ensure standards compliance
- **Architecture Reviews**: For significant changes
- **Security Reviews**: For security-sensitive code
- **Performance Reviews**: For performance-critical features

## Conclusion

These pre-project settings and development standards are **NON-NEGOTIABLE** for the ConversationIQ project. They ensure:

✅ **Quality**: 100% test coverage and zero errors  
✅ **Reliability**: Production-ready code from day one  
✅ **Maintainability**: Clean, well-tested, documented code  
✅ **Security**: Secure coding practices throughout  
✅ **Performance**: Optimized for production deployment  

**Remember**: It's easier to maintain high standards from the beginning than to retrofit quality later. These settings are an investment in the long-term success of ConversationIQ and its acquisition potential.