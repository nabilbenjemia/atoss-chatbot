# Implementation Plan: User Microservice

**Branch**: `feature/007-user-microservice` | **Date**: 2025-11-08 | **Spec**: [User Microservice Specification](./spec.md)

**Input**: Feature specification from `/specs/007-user-microservice/spec.md`

## Summary

The User Microservice is an independent Node.js/Express microservice that manages user profiles with complete CRUD operations (Create, Read, Update, Delete). The service runs on port 4001 and operates independently with mock authentication during development. It uses MongoDB for persistence with Mongoose ODM and enforces role-based authorization (admin vs staff) with an extensible architecture supporting future Auth Service integration. The implementation includes:

1. **MVP (P1)**: Create and retrieve user profiles
2. **Essential Features (P2)**: Update and delete (soft-delete) user profiles
3. **Administrative Features (P3)**: Search and list users with pagination
4. **Mock Environment**: Full Docker setup with MongoDB, local authentication endpoints, and frontend (login → user profile page with admin/staff CRUD)
5. **Database**: MongoDB local container with persistent volume

## Technical Context

**Language/Version**: Node.js 18.x (LTS) with ES6+ features  
**Primary Dependencies**: Express.js 5.x, Mongoose 7.x, bcryptjs 2.4.3, jsonwebtoken 9.x  
**Storage**: MongoDB (local Docker container, database: `atoss_gpt_users`)  
**Testing**: Manual (Postman collection) + mock auth tokens for role-based testing; no automated tests per constitution  
**Target Platform**: Linux server (Docker container), macOS/Windows compatible via Docker Desktop  
**Project Type**: Web application - backend microservice + frontend mock (React login/profile page)  
**Performance Goals**: < 2 seconds end-to-end for create+retrieve; < 500ms per API call on 10k+ user datasets  
**Constraints**: < 100ms auth token parsing; 99% availability for CRUD operations; soft-delete semantics (404 for inactive)  
**Scale/Scope**: MVP targets 100 concurrent creates; list operations support 100k+ users; 4 user stories across 3 feature groups (P1–P3)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: MERN Stack Architecture ✅ PASS
- **Requirement**: MongoDB, Express.js, React.js, Node.js exclusively
- **Plan**: ✅ MongoDB (Mongoose ODM), Express.js 5.x, Node.js 18.x for backend; React.js for mock frontend (login/profile pages)
- **Status**: COMPLIANT

### Principle II: Microservices Pattern ✅ PASS
- **Requirement**: Clear service boundaries, API Gateway routing, REST APIs
- **Plan**: ✅ User Service runs independently on port 4001; API Gateway (existing) routes `/users/*`; REST API with defined endpoints (POST/GET/PUT/DELETE)
- **Status**: COMPLIANT

### Principle VII: Single Responsibility Principle ✅ PASS
- **Requirement**: Each file/class has one reason to change; clear separation of concerns
- **Plan**: ✅ Architecture enforces SRP:
  - Controllers: HTTP request/response handling only
  - Services: Business logic (authorization, CRUD, soft-delete)
  - Models: Data persistence via Mongoose
  - Middleware: Authentication parsing, error handling
  - Utilities: Validation, logging
- **Status**: COMPLIANT

### Principle VIII: Low Coupling & High Cohesion ✅ PASS
- **Requirement**: Services communicate via APIs only; no shared databases; related functionality grouped
- **Plan**: ✅ User Service independent database (`atoss_gpt_users`); Auth Service mocked with role extraction; integration points clearly defined
- **Status**: COMPLIANT

### Principle IX: Version Control & Repository Hygiene ✅ PASS
- **Requirement**: Conventional commits, feature branches, .gitignore compliance
- **Plan**: ✅ Already on branch `feature/007-user-microservice`; .gitignore configured for Node.js (node_modules, .env, .git ignored)
- **Status**: COMPLIANT

### Overall Constitution Status: ✅ PASS
All principles satisfied; no violations or justifications needed.

## Project Structure

### Documentation (this feature)

```text
specs/007-user-microservice/
├── spec.md                          # Feature specification (completed)
├── research.md                      # Phase 0 research (completed)
├── plan.md                          # This file - Implementation plan
├── data-model.md                    # Phase 1 output - Data model & validation
├── quickstart.md                    # Phase 1 output - Setup & dev guide
├── contracts/                       # Phase 1 output - API contracts
│   ├── create-user.md              # POST /users contract
│   ├── get-user.md                 # GET /users/{userId} contract
│   ├── list-users.md               # GET /users contract
│   ├── update-user.md              # PUT /users/{userId} contract
│   ├── delete-user.md              # DELETE /users/{userId} contract
│   ├── verify-user.md              # GET /users/{userId}/verify contract
│   └── auth-mock-flow.md           # Mock authentication flow
├── checklists/
│   └── requirements.md              # Quality validation (completed ✅)
└── tasks.md                         # Phase 2 output - Task breakdown (/speckit.tasks)
```

### Source Code (repository root)

```text
backend/user-service/
├── src/
│   ├── config/
│   │   ├── database.js              # MongoDB connection
│   │   └── environment.js           # Environment configuration
│   ├── controllers/
│   │   └── UserController.js        # HTTP handlers: create, get, update, delete, list, verify
│   ├── services/
│   │   ├── UserService.js           # Business logic: CRUD, authorization checks
│   │   └── AuthService.js           # Mock auth: token parsing, role extraction
│   ├── models/
│   │   └── User.js                  # Mongoose schema: User profile with soft-delete (UUID v4 business id)
│   ├── middleware/
│   │   ├── authMiddleware.js        # Mock authentication: validate bearer token, extract role
│   │   ├── errorHandler.js          # Global error handling & response formatting
│   │   └── validationMiddleware.js  # Input validation (email, role, department)
│   ├── utils/
│   │   ├── validators.js            # Email format, enumeration validation
│   │   ├── logger.js                # Logging utility (timestamp, operation, role)
│   │   └── constants.js             # Enumerations (roles: Staff/Admin, departments: Department 1/2/3), error messages
│   ├── routes/
│   │   └── userRoutes.js            # Route definitions, middleware chaining
│   └── index.js                     # Server entry point
├── .env.example                     # Environment template
├── .gitignore                       # Git ignore configuration
├── package.json                     # Node.js dependencies & scripts
├── Dockerfile                       # Docker image for user service
└── docker-compose.yml               # Docker compose (user-service + MongoDB)

frontend/mock-auth/
├── src/
│   ├── components/
│   │   ├── LoginForm.jsx            # Mock login (admin/staff buttons)
│   │   ├── UserProfile.jsx          # Display current user profile
│   │   └── CRUDForm.jsx             # CRUD operations (admin/staff modes)
│   ├── pages/
│   │   ├── LoginPage.jsx            # Login page
│   │   └── ProfilePage.jsx          # User profile page (post-login)
│   ├── services/
│   │   └── apiClient.js             # HTTP client (mock auth headers)
│   ├── App.jsx                      # Main app component
│   └── index.jsx                    # React entry point
├── package.json                     # React dependencies
├── Dockerfile                       # Frontend mock container
└── .gitignore                       # Node.js ignore

docker-compose.yml                  # Orchestrates user-service, frontend, MongoDB

tests/
├── postman/
│   └── User-Microservice.postman_collection.json
└── manual/
    └── test-scenarios.md            # Manual testing guide
```

**Structure Decision**: 
- **Backend**: User Service microservice with clear SRP-based file organization (controllers → services → models, middleware for cross-cutting concerns)
- **Frontend**: Minimal React mock for manual testing (login → profile page with CRUD buttons)
- **Orchestration**: Docker Compose for local development (user-service, MongoDB, optional frontend)
- **Testing**: Manual tests via Postman collection + mock auth token format; no automated test suite per constitution

## Phases

### Phase 0: Research & Decision Resolution

**Status**: ✅ COMPLETED in `/speckit.clarify`

**Decisions Made**:
1. Authorization: CRUD with auth checks; defer detailed permission rules to implementation
2. Soft-delete: DELETE sets `active: false`; inactive users return 404 on GET
3. Mock auth: User Role Simulation (`Bearer <role>:<identifier>`)

**Artifacts**: 
- ✅ `research.md` - Comprehensive context from Auth Service implementation
- ✅ All NEEDS CLARIFICATION markers resolved in clarification session

### Phase 1: Design & Contracts (This Phase)

**Prerequisites**: ✅ research.md complete, clarifications resolved

**Deliverables**:
1. **data-model.md**: MongoDB schema, validation rules, relationships
2. **contracts/**: API endpoint specifications (6 endpoints × request/response examples)
3. **quickstart.md**: Development setup, environment config, running locally
4. **Agent context update**: Register MERN stack technologies

**Key Design Decisions**:
- **Authorization Layer**: Middleware extracts role from mock token; service layer checks authorization for each operation
- **Soft-delete Implementation**: Query filter `{active: true}` on all reads; DELETE sets `active: false`
- **Mock Auth**: Middleware parses `Bearer admin:user123` or `Bearer staff:user456` for role extraction
- **Error Response**: Unified format: `{success: false, error: "message", code: "ERROR_CODE"}`
- **Logging**: All CRUD ops logged with `{timestamp, operation, role, userId, status}`
- **Identifier Strategy**: Expose UUID v4 as the business identifier (`id` field). Internal Mongo `_id` remains ObjectId and is not used by clients.

### Phase 2: Task Breakdown (Next Phase: `/speckit.tasks`)

**Scope**: Will generate 25-30 tasks across phases:
- Phase A: Setup (3-4 tasks - project init, dependencies, config)
- Phase B: Foundational (6-8 tasks - auth middleware, error handling, DB connection)
- Phase C: User Story 1 - P1 (6-8 tasks - create/retrieve endpoints, model, service)
- Phase D: User Story 2 - P2 (4-5 tasks - update endpoint, authorization checks)
- Phase E: User Story 3 - P2 (3-4 tasks - soft-delete, inactivity handling)
- Phase F: User Story 4 - P3 (2-3 tasks - list/search, pagination)
- Phase G: Polish (2-3 tasks - logging, Postman collection, Docker setup)

## Implementation Strategy

### Incremental Development (P1 → P2 → P3)

1. **MVP First (P1)**: Create + Retrieve
   - Single table model, basic endpoints
   - Delivers: Functional user database
   - Testable independently

2. **Add Lifecycle (P2)**: Update + Delete (soft-delete)
   - Authorization checks
   - Active flag filtering
   - Delivers: Full profile management

3. **Administrative Features (P3)**: Search + List
   - Pagination
   - Filter by role/department
   - Delivers: Admin dashboard foundation

### SRP-Based Architecture

**Separation of Concerns**:
- **UserController**: HTTP only - request validation, response formatting
- **UserService**: Business logic - authorization, CRUD ops, soft-delete semantics
- **User Model**: Data - Mongoose schema, validation rules
- **AuthService**: Mock auth - token parsing, role extraction
- **Middleware**: Cross-cutting - auth validation, error handling, logging

**Extensibility Hooks**:
- Authorization middleware designed to swap real JWT validation later
- Service layer structured to support role-based permission matrix (future)
- Logging utility can hook to external services (ELK stack, datadog)

### Docker Compose Setup

```yaml
services:
  user-service:
    build: ./backend/user-service
    ports:
      - "4001:4001"
    env_file: .env
    depends_on:
      - mongodb

  mongodb:
    image: mongo:6.0
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db
    environment:
      MONGO_INITDB_DATABASE: atoss_gpt_users

  frontend-mock: # optional
    build: ./frontend/mock-auth
    ports:
      - "3000:3000"
    environment:
      REACT_APP_API_URL: http://localhost:4001

volumes:
  mongo-data:
```

**Development Workflow**:
```bash
docker-compose up -d                # Start services
npm run dev                          # Auto-reload user-service
# Test via Postman or http://localhost:3000
```

## Success Metrics

✅ **Constitution Compliant**: All 5 applicable principles passed  
✅ **Specification Aligned**: Plan addresses all 17 functional requirements  
✅ **User Stories Mapped**: 4 stories → clear phases with independent testing  
✅ **Architecture Ready**: SRP + middleware layers support incremental development  
✅ **Mock Environment Complete**: Auth mocking, frontend, MongoDB ready  
✅ **Extensible Design**: Authorization, logging, auth can evolve without refactoring  

## Next Steps

1. ✅ **Phase 1 Complete**: Run following commands to generate remaining artifacts
   - Generate `data-model.md` (Mongoose schema, validation)
   - Generate `contracts/` (API specifications)
   - Generate `quickstart.md` (setup guide)

2. **Phase 2**: `/speckit.tasks` to break into implementable tasks (25-30 total)

3. **Implementation**: Follow task order (Setup → Foundation → P1 → P2 → P3 → Polish)

