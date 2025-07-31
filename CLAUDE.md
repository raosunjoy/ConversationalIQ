# ConversationIQ - Claude AI Assistant Project Context

## Project Overview

**ConversationIQ** is an AI-powered real-time conversation intelligence platform designed as a native Zendesk integration. The platform provides real-time sentiment analysis, intent prediction, and suggested responses to customer service agents, positioning itself as the perfect acquisition target for Zendesk's AI-driven customer service strategy.

### Strategic Positioning
- **Product Type**: AI-powered conversation intelligence platform
- **Integration Strategy**: Zendesk-native marketplace application
- **Business Model**: SaaS subscription with tiered pricing
- **Exit Strategy**: Acquisition by Zendesk within 2-3 years
- **Target Valuation**: $50-100M based on $10-20M ARR

## Project Documents Reference

### 1. REQUIREMENTS.md
**Purpose**: Complete product requirements and strategic vision
**Key Sections**:
- Strategic alignment with Zendesk's acquisition strategy
- Core functionality (sentiment analysis, intent prediction, response suggestions)
- Technical requirements and architecture overview
- Business model and revenue projections
- Success criteria and acquisition readiness metrics

**Critical Requirements**:
- Real-time conversation analysis (<2 seconds end-to-end)
- 90%+ revenue from Zendesk-integrated customers
- Native Zendesk app marketplace distribution
- AI-powered agent augmentation (not replacement)

### 2. DESIGN.md
**Purpose**: Technical architecture and implementation specifications
**Key Sections**:
- System architecture (event-driven, microservices)
- AI/ML pipeline (sentiment, intent, response generation)
- Real-time processing with WebSockets and Kafka
- Database design with PostgreSQL and Redis caching
- Security, scalability, and monitoring strategies

**Critical Architecture Decisions**:
- **Technology Stack**: Node.js/TypeScript, React, PostgreSQL, Redis, Kafka
- **AI/ML Stack**: Python, TensorFlow, OpenAI GPT-4, Hugging Face
- **Infrastructure**: AWS (EKS, RDS, ElastiCache, MSK)
- **Integration**: Native Zendesk App Framework with webhooks

### 3. TASKS.md
**Purpose**: Complete implementation roadmap with 90+ detailed tasks
**Key Phases**:
- **Phase 1**: Foundation & Infrastructure (Months 1-4)
- **Phase 2**: AI/ML Core Features (Months 3-6)
- **Phase 3**: User Interface & Experience (Months 4-7)
- **Phase 4**: Advanced Features & Optimization (Months 6-9)
- **Phase 5**: Security, Compliance & Production (Months 8-12)
- **Phase 6**: Launch Preparation & Market Entry (Months 10-12)

**Resource Requirements**:
- **Team**: 15-20 people (engineers, product, design, QA)
- **Budget**: $180-330K/month total burn rate
- **Timeline**: 12 months to market-ready product

### 4. PRE-PROJECT-SETTINGS.md
**Purpose**: Mandatory development standards and quality gates
**Core Quality Requirements**:
- ✅ **100% Test Coverage** (TDD process mandatory)
- ✅ **100% Test Pass Rate** (no failing tests allowed)
- ✅ **Zero TypeScript Errors** (strict mode enabled)
- ✅ **Zero Lint Errors** (ESLint enforced at pre-commit)

## Development Standards (NON-NEGOTIABLE)

### Test-Driven Development (TDD) Process
**MANDATORY**: All development must follow strict TDD methodology:
1. **RED**: Write a failing test first
2. **GREEN**: Write minimal code to make the test pass
3. **REFACTOR**: Improve code while keeping tests green

### Required Commands Before Any Development
```bash
# MANDATORY: Run these before starting any work
npm run build           # Verify production build works
npm run type-check      # TypeScript compilation check
npm run lint           # ESLint validation
npm run test           # Run all tests
npm run test:coverage  # Verify 100% coverage
```

### Git Workflow Requirements
- **Branch Protection**: Main branch protected, requires PR approval
- **Pre-commit Hooks**: Automated validation prevents bad commits
- **Commit Format**: `<type>(<scope>): <description>`
- **Quality Gates**: All commits must pass lint, type-check, tests, and build

### Technology Stack

#### Frontend
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with Zendesk Garden components
- **State Management**: Redux Toolkit with RTK Query
- **Real-time**: Socket.io client for WebSocket connections

#### Backend
- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js with GraphQL (Apollo Server)
- **Database**: PostgreSQL with Prisma ORM
- **Caching**: Redis with multi-layer caching strategy
- **Message Queue**: Apache Kafka for event streaming

#### AI/ML Services
- **Language**: Python 3.9+
- **Frameworks**: TensorFlow, Hugging Face Transformers
- **Models**: Custom fine-tuned models + OpenAI GPT-4
- **Vector Database**: Pinecone for embeddings storage

#### Infrastructure
- **Cloud Provider**: AWS
- **Container Orchestration**: Kubernetes (EKS)
- **Database**: RDS PostgreSQL with Multi-AZ
- **Cache**: ElastiCache Redis cluster
- **Message Queue**: MSK (Managed Kafka)
- **Monitoring**: DataDog, Sentry, CloudWatch

## Current Project Status

### Development Progress Summary
- **Overall Phase 1 Progress**: ~80% completed
- **Test Coverage**: 100% maintained throughout development (110 tests passing)
- **Quality Gates**: All passing (build, type-check, lint, tests)
- **Next Priority**: GraphQL API implementation with real-time subscriptions

### Key Accomplishments So Far
- ✅ **Foundation Setup**: Complete project structure with TDD methodology
- ✅ **Database Layer**: Comprehensive Prisma schema and service layer implemented
- ✅ **Environment Management**: Type-safe configuration with validation
- ✅ **Development Environment**: Docker Compose with PostgreSQL operational
- ✅ **Authentication System**: Complete JWT authentication with Zendesk OAuth integration
- ✅ **API Gateway**: Express server with security middleware and health checks
- ✅ **Quality Standards**: 100% test coverage (110 tests) and strict TypeScript compliance

### Phase 1 - Critical Foundation ✅ PARTIALLY COMPLETED
1. **Project Setup & Infrastructure** ✅ **COMPLETED**
   - ✅ Git repository with branching strategy initialized
   - ✅ TypeScript/Node.js project structure established
   - ✅ ESLint, Prettier, and Husky pre-commit hooks configured
   - ✅ Development environment with Docker Compose operational
   - ✅ Package.json with core dependencies configured
   - 🚧 AWS infrastructure (EKS, RDS, Redis) - *Deferred to deployment phase*

2. **Database Implementation** ✅ **COMPLETED**
   - ✅ Comprehensive Prisma schema with all core tables implemented
   - ✅ DatabaseService layer with full CRUD operations
   - ✅ Migration system with TypeScript scripts
   - ✅ Environment configuration management with validation
   - ✅ 100% test coverage maintained throughout

3. **Core Backend Services** 🚧 **IN PROGRESS**
   - ✅ API Gateway with Express setup (COMPLETED)
   - ✅ JWT authentication system (COMPLETED)
   - ✅ Zendesk OAuth integration (COMPLETED)
   - ✅ Health check endpoints (COMPLETED)
   - ⏳ GraphQL API with real-time subscriptions

4. **Zendesk Integration Foundation** ⏳ **PENDING**
   - ⏳ Zendesk App Framework integration
   - ⏳ Webhook processing service
   - ⏳ Basic agent authentication

## Core Features Implementation Priority

### Phase 2 - AI/ML Core (Months 3-6)
1. **AI Processing Pipeline**
   - Sentiment analysis engine (>85% accuracy)
   - Intent classification system (15+ categories)
   - Response generation with OpenAI integration

2. **Real-Time Processing**
   - WebSocket service for live updates
   - Event-driven processing architecture
   - Multi-layer caching system

### Phase 3 - User Experience (Months 4-7)
1. **Agent Dashboard**
   - Real-time sentiment indicators
   - Response suggestion interface
   - Conversation analytics widget

2. **Manager Dashboard**
   - Team performance analytics
   - Business intelligence features
   - Custom reporting tools

## Key Performance Indicators (KPIs)

### Technical Metrics
- **Performance**: API response time <500ms (P95)
- **Reliability**: 99.9% uptime SLA
- **Scalability**: Handle 10,000+ concurrent users
- **AI Accuracy**: >85% sentiment analysis accuracy
- **Real-time**: <100ms WebSocket latency

### Business Metrics
- **Adoption**: >70% daily active usage among customers
- **Satisfaction**: >4.5/5 customer satisfaction score
- **Efficiency**: >25% improvement in agent response time
- **Revenue**: $10-20M ARR by acquisition time
- **Retention**: >95% annual customer retention rate

### Acquisition Readiness Metrics
- **Market Position**: Top 3 conversation intelligence app in Zendesk marketplace
- **Integration Depth**: 90%+ revenue from Zendesk-native features
- **Customer Dependency**: Zendesk customers consider ConversationIQ essential
- **Strategic Value**: Clear acquisition interest from Zendesk

## Project Context for Claude Sessions

### When Starting New Sessions
1. **Reference this CLAUDE.md** for complete project context
2. **Check current phase** progress in TASKS.md
3. **Follow TDD process** from PRE-PROJECT-SETTINGS.md
4. **Validate against requirements** in REQUIREMENTS.md
5. **Follow architectural patterns** from DESIGN.md

### Development Workflow
```bash
# 1. BEFORE any development work
npm run build && npm run type-check && npm run lint && npm run test

# 2. TDD Cycle
npm run test:watch  # Keep tests running
# Write failing test → Write code → Refactor

# 3. BEFORE committing
npm run pre-commit  # Runs all validation checks
```

### Code Quality Standards
- **TypeScript**: Strict mode, no `any` types, explicit return types
- **Testing**: Jest with 100% coverage requirement
- **Linting**: ESLint with strict rules, Prettier formatting
- **Documentation**: JSDoc comments for all public functions

### Security & Compliance
- **Authentication**: JWT tokens with Zendesk OAuth integration
- **Data Privacy**: GDPR compliance with data encryption
- **Security**: SOC 2 compliance, regular security audits
- **Access Control**: Role-based permissions system

## Common Development Scenarios

### Adding New Features
1. **Review TASKS.md** for feature specifications
2. **Check DESIGN.md** for architectural patterns
3. **Follow TDD process**: test first, then implementation
4. **Ensure Zendesk integration** maintains native experience

### API Development
1. **GraphQL First**: Use GraphQL for all client-server communication
2. **Real-time Updates**: Implement subscriptions for live data
3. **Error Handling**: Comprehensive error handling and logging
4. **Performance**: Optimize with DataLoader and caching

### AI/ML Integration
1. **Python Services**: Separate Python services for AI processing
2. **Model Management**: Version control for AI models
3. **Performance**: <500ms processing time for real-time analysis
4. **Accuracy**: Maintain >85% accuracy for sentiment analysis

### Database Operations
1. **Prisma ORM**: Use Prisma for all database operations
2. **Migrations**: Version-controlled schema migrations
3. **Performance**: Optimized queries with proper indexing
4. **Scaling**: Partitioning strategy for large tables

## Troubleshooting Common Issues

### Build Failures
- Check TypeScript errors: `npm run type-check`
- Verify all imports exist and resolve correctly
- Ensure all tests pass: `npm run test`

### Test Coverage Issues
- Every new function needs corresponding tests
- Check coverage report: `npm run test:coverage`
- Missing coverage usually indicates untested edge cases

### Zendesk Integration Issues
- Verify webhook signatures and authentication
- Check Zendesk API rate limits and error responses
- Ensure app manifest is properly configured

### Performance Issues
- Check database query performance with EXPLAIN
- Verify caching strategy is working correctly
- Monitor API response times with DataDog

## Success Criteria Summary

### Technical Success
- Zero critical bugs in production
- 99.9% uptime with <500ms response times
- 100% test coverage maintained throughout development
- Successful integration with all Zendesk features

### Business Success
- Product-market fit validated through beta customers
- Clear path to $10-20M ARR within 2-3 years
- Strong customer retention and expansion metrics
- Zendesk marketplace leadership position

### Strategic Success
- Positioned as obvious acquisition target for Zendesk
- Deep integration creates switching costs for customers
- Technology and team aligned with Zendesk's vision
- Clear synergies and strategic value proposition

## Quick Reference Commands

```bash
# Development
npm run dev              # Start development server
npm run test:watch       # Run tests in watch mode
npm run db:migrate       # Apply database migrations

# Quality Checks
npm run lint:fix         # Fix linting issues
npm run type-check       # TypeScript validation
npm run test:coverage    # Check test coverage

# Production
npm run build           # Production build
npm run start          # Start production server
npm run db:seed        # Seed production database

# CI/CD
npm run test:ci        # Run tests in CI environment
npm run pre-commit     # Pre-commit validation
```

---

**Remember**: ConversationIQ is designed as an acquisition target. Every technical and business decision should support this strategic goal while delivering exceptional value to Zendesk customers.