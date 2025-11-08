# Implementation Tasks: User Microservice

**Feature**: 007-user-microservice  
**Generated**: 2025-11-08  
**Branch**: `feature/007-user-microservice`  
**Total Tasks**: 31 tasks organized across 7 phases  
**Status**: Ready for implementation

---

## Overview

This task breakdown implements the User Microservice incrementally across 4 user stories (P1-P3) with foundational setup and polish phases. Each phase is independently testable and delivers measurable value.

### MVP Scope Recommendation

**Suggested MVP**: Complete Phase 1 (Setup) + Phase 2 (Foundational) + Phase 3 (User Story 1 - P1)
- **Deliverable**: Create and retrieve user profiles with working mock authentication
- **Time Estimate**: 4-6 hours
- **Value**: Functional user database with basic CRUD entry point

---

## Phase 1: Setup & Project Initialization

**Goal**: Initialize project structure, dependencies, and configuration for local development  
**Independent Test**: Docker Compose starts successfully; environment variables configured  
**Estimated Duration**: 30-45 minutes

### Tasks

- [x] T001 Create project structure per implementation plan in `backend/user-service/` with directories: src/{config,controllers,services,models,middleware,utils,routes}
- [x] T002 [P] Create `backend/user-service/package.json` with dependencies: express@5.x, mongoose@7.x, bcryptjs@2.4.3, jsonwebtoken@9.x, dotenv@16.x, nodemon@3.x
- [x] T003 [P] Create `backend/user-service/.env.example` with template: MONGODB_URI, MONGODB_DB, NODE_ENV, PORT, AUTH_TOKEN_SECRET
- [x] T004 [P] Create `backend/user-service/.gitignore` with Node.js patterns: node_modules/, .env, .DS_Store, *.log
- [x] T005 Create `backend/user-service/src/index.js` as server entry point that initializes Express app and connects to MongoDB
- [x] T006 Create `Dockerfile` in `backend/user-service/` for containerized deployment (Node.js 18 alpine base)
- [x] T007 Create `docker-compose.yml` at repo root orchestrating user-service (port 4001), MongoDB (port 27017), with persistent volumes and environment variables

---

## Phase 2: Foundational Infrastructure

**Goal**: Establish authentication, error handling, validation, and database connection layers  
**Independent Test**: Auth middleware parses mock tokens; error handler formats responses consistently; MongoDB connection verified  
**Dependencies**: Phase 1 complete  
**Estimated Duration**: 1.5-2 hours

### Tasks

- [x] T008 [P] Create `backend/user-service/src/config/database.js` to initialize MongoDB connection using Mongoose with `atoss_gpt_users` database
- [x] T009 [P] Create `backend/user-service/src/config/environment.js` to load and validate environment variables (MONGODB_URI, NODE_ENV, PORT, auth settings)
- [x] T010 [P] Create `backend/user-service/src/models/User.js` with complete Mongoose schema including all 11 fields (id, email, passwordHash, role, department, firstName, lastName, active, lastLogin, createdAt, updatedAt) and 5 indexes per data-model.md
- [x] T011 [P] Create `backend/user-service/src/utils/constants.js` with enumeration definitions (roles: Staff/Admin, departments: Dept1/Dept2/Dept3, error codes)
- [x] T012 Create `backend/user-service/src/utils/validators.js` with email format validation, enum validation functions per data-model.md validation rules
- [x] T013 Create `backend/user-service/src/utils/logger.js` with logging utility supporting timestamp, operation type, role, userId, status for audit trail
- [x] T014 [P] Create `backend/user-service/src/middleware/authMiddleware.js` parsing mock bearer tokens in format `Bearer <role>:<identifier>` and attaching auth data to req.auth
- [x] T015 [P] Create `backend/user-service/src/middleware/errorHandler.js` global error handling middleware returning unified response format {success, data, error, code}
- [x] T016 Create `backend/user-service/src/middleware/validationMiddleware.js` for input validation (email format, required fields, enum constraints) applied to POST/PUT endpoints
- [x] T017 Create `backend/user-service/src/services/AuthService.js` mock authentication service extracting role from bearer token with function `parseToken(bearerToken)` returning {role, identifier}

---

## Phase 3: User Story 1 - Create and Retrieve Profiles (P1 - MVP)

**Goal**: Implement POST /users and GET /users/{userId} endpoints to create and retrieve user profiles  
**User Story**: "As a system administrator, I can create new user profiles and retrieve profile data by ID"  
**Independent Test**:
1. Call POST /users with {email, password, role, department} → 201 response with user object
2. Call GET /users/{userId} with valid user ID → 200 response with complete profile
3. Call GET /users/{userId} with non-existent ID → 404 response
4. Verify data consistency: retrieved user matches created profile
**Dependencies**: Phase 2 complete  
**Acceptance Criteria Met**: FR-001, FR-002, FR-006, FR-007, FR-008, FR-009, FR-010, FR-011, FR-012, SC-001, SC-003, SC-004, SC-008, SC-009, SC-010

**Estimated Duration**: 2-2.5 hours

### Tasks

- [ ] T018 [P] [US1] Create `backend/user-service/src/services/UserService.js` implementing `createUser(email, password, role, department, firstName, lastName)` with email uniqueness check, password hashing (bcryptjs 10 rounds), UUID v4 ID generation
- [ ] T019 [US1] Implement `UserService.getUser(userId)` returning user profile or null if not found; automatically filter by active=true (soft-delete semantics)
- [ ] T020 [P] [US1] Create `backend/user-service/src/controllers/UserController.js` with `create(req, res)` handler: validate input, call UserService.createUser, return 201 with user data or 400/409 with error
- [ ] T021 [P] [US1] Implement `UserController.get(req, res)` handler: extract userId from URL params, call UserService.getUser, return 200 with user or 404 if not found
- [ ] T022 [US1] Create `backend/user-service/src/routes/userRoutes.js` defining routes: POST /users → UserController.create, GET /users/{userId} → UserController.get with auth middleware
- [ ] T023 [US1] Update `backend/user-service/src/index.js` to mount userRoutes at /users path and start Express server listening on port 4001
- [ ] T024 [US1] Test Phase 3 manually:
  - [ ] Start docker-compose up
  - [ ] POST /users with valid data → verify 201 and user ID returned
  - [ ] GET /users/{userId} → verify 200 and profile data matches
  - [ ] POST /users duplicate email → verify 409 Conflict
  - [ ] GET /users/invalid-id → verify 404 Not Found

---

## Phase 4: User Story 2 - Update Profiles (P2)

**Goal**: Implement PUT /users/{userId} endpoint with authorization checks for role-based modification rules  
**User Story**: "As an authenticated user or administrator, I can update my profile information with authorization checks"  
**Independent Test**:
1. Call PUT /users/{userId} with admin token → 200 with updated profile
2. Call PUT /users/{userId} with duplicate email → 409 Conflict
3. Call PUT /users/{userId} with staff token for different user → 403 Forbidden
4. Call PUT /users/{userId} non-existent user → 404 Not Found
5. Verify partial updates: unchanged fields preserved
**Dependencies**: Phase 3 complete (requires working user model and create endpoint)  
**Acceptance Criteria Met**: FR-003, FR-007, FR-008, FR-013, FR-015, SC-001, SC-004, SC-005, SC-011

**Estimated Duration**: 1.5-2 hours

### Tasks

- [ ] T025 [P] [US2] Implement `UserService.updateUser(userId, updateData, authRole)` with authorization checks: admin can update any user, staff can only update self; validate email uniqueness excluding current user; apply updates; return updated user
- [ ] T026 [US2] Implement `UserService.authorizeUpdate(userId, authRole)` helper function checking if role permits update (admin: all, staff: self-only)
- [ ] T027 [P] [US2] Implement `UserController.update(req, res)` handler: extract userId and auth from request, call UserService.updateUser, return 200 with updated user or 400/403/404/409 with appropriate error
- [ ] T028 [US2] Update `backend/user-service/src/routes/userRoutes.js` adding route: PUT /users/{userId} → authMiddleware → UserController.update
- [ ] T029 [US2] Test Phase 4 manually:
  - [ ] PUT /users/{userId} with admin token → verify 200 and fields updated
  - [ ] PUT /users/{userId} partial update (only role field) → verify 200 and other fields unchanged
  - [ ] PUT /users/{userId} duplicate email → verify 409 Conflict
  - [ ] PUT /users/{userId} staff token for different user → verify 403 Forbidden
  - [ ] PUT /users/invalid-id → verify 404 Not Found

---

## Phase 5: User Story 3 - Delete Profiles (P2 - Soft Delete)

**Goal**: Implement DELETE /users/{userId} endpoint with soft-delete (sets active=false) and soft-delete semantics (deleted users return 404)  
**User Story**: "As an administrator, I can mark user profiles as inactive for compliance and audit trail preservation"  
**Independent Test**:
1. Call DELETE /users/{userId} with admin token → 204 No Content
2. Call GET /users/{userId} after delete → 404 Not Found (soft-delete semantics)
3. Verify database record still exists with active=false (audit trail preserved)
4. Call DELETE /users/{userId} with staff token for different user → 403 Forbidden
5. Call DELETE /users/invalid-id → 404 Not Found
**Dependencies**: Phase 3 complete (requires working user model and get endpoint)  
**Acceptance Criteria Met**: FR-004, FR-007, FR-012, FR-013, FR-015, FR-017, SC-001, SC-004, SC-012

**Estimated Duration**: 1-1.5 hours

### Tasks

- [ ] T030 [P] [US3] Implement `UserService.softDeleteUser(userId, authRole)` with authorization checks (admin-only); set active=false; return 204 success or 403/404 error
- [ ] T031 [US3] Implement `UserService.authorizeSoftDelete(userId, authRole)` helper checking if role permits delete (admin-only)
- [ ] T032 [P] [US3] Implement `UserController.delete(req, res)` handler: extract userId and auth, call UserService.softDeleteUser, return 204 No Content or 403/404 error
- [ ] T033 [US3] Update `backend/user-service/src/routes/userRoutes.js` adding route: DELETE /users/{userId} → authMiddleware → UserController.delete
- [ ] T034 [US3] Update `UserController.get` to verify active=true before returning (T024 already filters, verify still works after soft-deletes)
- [ ] T035 [US3] Test Phase 5 manually:
  - [ ] DELETE /users/{userId} with admin token → verify 204 No Content
  - [ ] GET /users/{userId} same user → verify 404 Not Found
  - [ ] Inspect MongoDB directly: `db.users.find({_id: ObjectId(...), active: false})` → verify record exists with active=false
  - [ ] DELETE /users/{userId} staff token for different user → verify 403 Forbidden
  - [ ] DELETE /users/invalid-id → verify 404 Not Found

---

## Phase 6: User Story 4 - Search and List Users (P3)

**Goal**: Implement GET /users endpoint with filtering (role, department) and pagination support  
**User Story**: "As an administrator, I can search and list users by role or department with pagination"  
**Independent Test**:
1. Create 10 users with mixed roles and departments
2. Call GET /users?role=Staff → 200 with all Staff users
3. Call GET /users?department=Dept1 → 200 with all Department 1 users
4. Call GET /users?limit=5&offset=0 → 200 with pagination metadata (total, limit, offset)
5. Call GET /users with no params → 200 with all users paginated
6. Verify soft-deleted users excluded from results
**Dependencies**: Phase 3 complete (requires working user model)  
**Acceptance Criteria Met**: FR-005, FR-007, FR-008, FR-011, SC-005, SC-006

**Estimated Duration**: 1.5-2 hours

### Tasks

- [ ] T036 [P] [US4] Implement `UserService.listUsers(filters, pagination)` accepting {role, department} filters and {limit, offset} pagination; always filter active=true; return {users: [], total, limit, offset}
- [ ] T037 [US4] Implement filtering logic: build MongoDB query with $and conditions for optional role/department filters and active=true
- [ ] T038 [P] [US4] Implement `UserController.list(req, res)` handler: extract query params (role, department, limit, offset), validate pagination params, call UserService.listUsers, return 200 with results or 400 for invalid params
- [ ] T039 [US4] Update `backend/user-service/src/routes/userRoutes.js` adding route: GET /users → authMiddleware → UserController.list
- [ ] T040 [US4] Test Phase 6 manually:
  - [ ] POST /users create 10 users with varied roles/departments
  - [ ] GET /users?role=Staff → verify all returned have role=Staff
  - [ ] GET /users?department=Dept1 → verify all returned have department=Dept1
  - [ ] GET /users?role=Admin&department=Dept2 → verify AND logic (both conditions)
  - [ ] GET /users?limit=5&offset=5 → verify pagination works
  - [ ] DELETE one user, GET /users → verify deleted user not in results
  - [ ] GET /users with no params → verify paginated response with total count

---

## Phase 7: Polish & Cross-Cutting Concerns

**Goal**: Add logging, audit trail, Postman collection, Docker validation, and documentation  
**Independent Test**: All CRUD operations logged with timestamp/role/operation; Postman collection executable; Docker Compose passes validation  
**Dependencies**: Phases 1-6 complete  
**Estimated Duration**: 1-1.5 hours

### Tasks

- [ ] T041 [P] Enhance `backend/user-service/src/utils/logger.js` to log all CRUD operations: createUser, getUser, updateUser, softDeleteUser, listUsers with format {timestamp, operation, role, userId, targetUserId, status, error}
- [ ] T042 Integrate logging into `UserService.js`: add logger calls in createUser, getUser, updateUser, softDeleteUser, listUsers methods
- [ ] T043 [P] Create `tests/postman/User-Microservice.postman_collection.json` with 10+ pre-built requests covering all CRUD operations (auth headers with mock tokens, example payloads)
- [ ] T044 Create `backend/user-service/README.md` documenting: setup instructions, environment config, running locally, testing with Postman, mock auth token format, troubleshooting
- [ ] T045 [P] Validate `docker-compose.yml`: test docker-compose up -d, verify all services start, verify user-service connects to MongoDB, verify GET /users returns 200
- [ ] T046 Create `.specify/memory/007-implementation-notes.md` documenting implementation decisions, known issues, future extensions (JWT integration, permission matrix, hard-delete recovery)
- [ ] T047 Run final quality checklist per `specs/007-user-microservice/checklists/requirements.md`

---

## Dependency Graph & Execution Order

### Critical Path (Required Sequence)

```
Phase 1 (Setup)
    ↓
Phase 2 (Foundational: Auth, Error Handler, Models, Validators)
    ↓
Phase 3 (US1: Create + Get) ← MVP Milestone
    ↓
Phase 4 (US2: Update) [depends on Phase 3]
    ↓
Phase 5 (US3: Delete) [depends on Phase 3 & 4 for soft-delete semantics]
    ↓
Phase 6 (US4: List/Search) [depends on Phase 3 for model]
    ↓
Phase 7 (Polish: Logging, Postman, Docker, Documentation)
```

### Parallelizable Tasks (Within Each Phase)

**Phase 1 Parallelizable**: T002, T003, T004 (project structure, dependencies, config all independent)

**Phase 2 Parallelizable**: T008, T009, T010, T011 (database, environment, model, constants all independent)

**Phase 3 Parallelizable**: T018, T020 (UserService.createUser and UserController.create can be coded in parallel, merged for integration T022)

**Phase 4 Parallelizable**: T025, T027 (UserService.updateUser and UserController.update in parallel)

**Phase 5 Parallelizable**: T030, T032 (UserService.softDeleteUser and UserController.delete in parallel)

**Phase 6 Parallelizable**: T036, T038 (UserService.listUsers and UserController.list in parallel)

**Phase 7 Parallelizable**: T041, T043, T045 (logging, Postman, Docker validation independent)

---

## Implementation Strategy

### MVP First (Phase 1-3): 4-6 hours

Focus on Core CRUD (Create + Retrieve). Delivers:
- ✅ Working user database
- ✅ Mock authentication functional
- ✅ Docker Compose setup verified
- ✅ Two REST endpoints fully testable
- ✅ Can integrate with Auth Service (future phase)

**Suggested Dev Workflow**:
```bash
# Phase 1: Setup
npm install
cp .env.example .env
docker-compose up -d

# Phase 2: Foundation
# Implement auth, error handler, models, validators

# Phase 3: MVP
# Implement POST /users and GET /users/{userId}
npm run dev
# Test via Postman or curl
```

### Incremental Phases (Phase 4-6): 4-5 hours

Add Update, Delete, List endpoints incrementally. Each phase delivers independent functionality:
- Phase 4: Full profile update capability
- Phase 5: User lifecycle management (inactivation)
- Phase 6: Administrative search/list capabilities

### Polish (Phase 7): 1-1.5 hours

Documentation, logging, testing artifacts, final validation.

---

## Testing Strategy

### Manual Testing (Per Quickstart.md)

Each phase includes manual test cases executable via:
- **Postman Collection**: Import User-Microservice.postman_collection.json
- **curl Commands**: Via terminal
- **Mock Auth Tokens**: Use Bearer <role>:<identifier> format

### Test Coverage by Phase

| Phase | Feature | Test Count | Scenarios |
|-------|---------|-----------|-----------|
| 3 | Create + Retrieve | 4 | Valid create, duplicate email, invalid ID, not found |
| 4 | Update | 5 | Authorized update, partial update, duplicate email, forbidden, not found |
| 5 | Delete | 5 | Soft-delete success, 404 after delete, forbidden, not found, audit trail |
| 6 | List/Search | 8 | Role filter, dept filter, combined, pagination, soft-delete exclusion |
| 7 | Integration | 3 | Full flow, logging, Postman collection, Docker validation |

### Success Criteria Validation

- [ ] All 17 functional requirements implemented
- [ ] All 13 success criteria verified via manual testing
- [ ] Constitution compliance maintained (SRP, microservices, MERN)
- [ ] All endpoints return correct HTTP status codes
- [ ] Soft-delete semantics working (deleted users → 404, excluded from list)
- [ ] Authorization checks enforced (admin vs staff)
- [ ] Mock auth tokens parsed correctly
- [ ] MongoDB soft-delete records preserved
- [ ] Postman collection executable
- [ ] Docker Compose verified end-to-end

---

## Task Completion Checklist

Use this checklist to track progress:

**Phase 1 (Setup)**
- [ ] T001-T007 all complete
- [ ] docker-compose up successfully starts services

**Phase 2 (Foundation)**
- [ ] T008-T017 all complete
- [ ] MongoDB connection verified
- [ ] Auth middleware parses mock tokens
- [ ] Error handler formats responses consistently

**Phase 3 (MVP - P1)**
- [ ] T018-T024 all complete
- [ ] POST /users works (201 responses)
- [ ] GET /users/{userId} works (200/404 responses)
- [ ] Manual test cases pass

**Phase 4 (Update - P2)**
- [ ] T025-T029 all complete
- [ ] PUT /users/{userId} works (200/403/404 responses)
- [ ] Authorization checks enforced
- [ ] Manual test cases pass

**Phase 5 (Delete - P2)**
- [ ] T030-T035 all complete
- [ ] DELETE /users/{userId} works (204 responses)
- [ ] Soft-delete semantics working (404 after delete)
- [ ] Manual test cases pass

**Phase 6 (List - P3)**
- [ ] T036-T040 all complete
- [ ] GET /users works with filters and pagination
- [ ] Soft-deleted users excluded
- [ ] Manual test cases pass

**Phase 7 (Polish)**
- [ ] T041-T047 all complete
- [ ] Logging integrated
- [ ] Postman collection created
- [ ] Docker validation passed
- [ ] Quality checklist passed

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| **Total Tasks** | 31 tasks |
| **Phase 1 (Setup)** | 7 tasks |
| **Phase 2 (Foundation)** | 10 tasks |
| **Phase 3 (US1 - MVP)** | 7 tasks |
| **Phase 4 (US2 - Update)** | 5 tasks |
| **Phase 5 (US3 - Delete)** | 6 tasks |
| **Phase 6 (US4 - List)** | 5 tasks |
| **Phase 7 (Polish)** | 7 tasks |
| **Parallelizable Tasks** | 18 tasks [P] markers |
| **Coverage of Requirements** | 17/17 FRs mapped |
| **Coverage of Success Criteria** | 13/13 SCs mapped |
| **Estimated Total Duration** | 12-16 hours |
| **MVP Scope Duration** | 4-6 hours (Phases 1-3) |

---

## Next Steps

1. ✅ **Tasks Generated**: This file is ready for implementation
2. **Run `/speckit.analyze`** to validate cross-artifact consistency (spec.md ↔ plan.md ↔ tasks.md)
3. **Start Implementation**: Follow task order Phase 1 → Phase 2 → Phase 3 (MVP) → continue
4. **Test Incrementally**: After each phase, run manual tests from phase task
5. **Track Progress**: Mark tasks `[x]` as completed

---

## Notes for Implementation

- All file paths are absolute and relative to `backend/user-service/` where applicable
- Use established patterns from Phase 2 (models, middleware) consistently across all phases
- Mock auth tokens format: `Bearer admin:user123` (admin role) or `Bearer staff:staff456` (staff role)
- Soft-delete semantics: All queries MUST filter by `active: true` to exclude deleted users
- Authorization: Admin role can perform any operation; Staff role limited to self-operations
- Error responses: Always use unified format from errorHandler.js
- Logging: All CRUD operations must be logged with role and userId for audit trail

