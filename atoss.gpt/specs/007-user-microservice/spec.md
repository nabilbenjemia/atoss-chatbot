# Feature Specification: User Microservice Implementation

**Feature Branch**: `feature/007-user-microservice`  
**Created**: 2025-11-08  
**Status**: Draft  
**Input**: User description: "i am responsible for user microservices implementation. it will interact with auth services. in authREADME you find the notes by other developer and have a idea of already implemented feature. Here we want to implement independently, so mock auth, we focus on user microservices"

## Clarifications

### Session 2025-11-08

- Q1: Authorization & Permission Model → A: Implement CRUD with authorization checks but defer detailed permission rules. Code should support both admin and regular user roles with different modification rules, architecture should be maintainable and extensible for future changes per SRP principle.
- Q2: Soft Delete vs Hard Delete → A: Soft Delete Only (Option B). DELETE endpoint sets `active: false`; records remain for audit trails; GET returns 404 for inactive users. Migration to hard-delete or recovery features is easy from this foundation.
- Q3: Mock Auth Implementation → A: User Role Simulation (Option C). Accept bearer tokens with embedded role format (e.g., `Bearer admin:user123` or `Bearer staff:user456`). Allows testing authorization logic without Auth Service dependency; easy transition to real JWT later.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create and Retrieve User Profiles (Priority: P1)

A system administrator or integration service needs to create new user profiles with personal and organizational information, and retrieve user profile data by ID. This is the core functionality that all other user service features depend on.

**Why this priority**: User profile management is the foundational feature. All other operations (update, delete, search) depend on the ability to create and retrieve users. This provides the MVP for the User Service.

**Independent Test**: Can be fully tested by:
1. Calling POST `/users` with user data to create a profile
2. Calling GET `/users/{userId}` to retrieve the created profile
3. Verifying returned data matches input data
Delivers: A functional user database with basic CRUD entry point

**Acceptance Scenarios**:

1. **Given** a valid user profile request with email, password, role, and department, **When** POST `/users` is called, **Then** the system creates a user record and returns the user ID and profile data with HTTP 201 status
2. **Given** a user profile exists in the system, **When** GET `/users/{userId}` is called, **Then** the system returns the complete user profile data with HTTP 200 status
3. **Given** a non-existent user ID, **When** GET `/users/{userId}` is called, **Then** the system returns HTTP 404 with appropriate error message
4. **Given** incomplete required fields in the request, **When** POST `/users` is called, **Then** the system returns HTTP 400 with validation error details

---

### User Story 2 - Update User Profile Information (Priority: P2)

An authenticated user or administrator needs to update their profile information (email, role, department, profile data) after creation. This allows users to maintain current and accurate information. The system MUST support authorization checks to enforce different modification rules based on user role (admin vs staff).

**Why this priority**: Update capability is essential for user account management. Many users need to update their information over time, making this a high-value feature that builds directly on the create/retrieve functionality.

**Independent Test**: Can be fully tested by:
1. Creating a user profile (depends on US1 but tests update independently)
2. Calling PUT `/users/{userId}` with updated fields as different user roles
3. Verifying updates apply based on authorization rules (authorized) or reject (unauthorized)
4. Retrieving the user profile to verify updates were applied correctly
Delivers: Complete user data lifecycle support with authorization enforcement

**Acceptance Scenarios**:

1. **Given** an existing user profile and valid update data with admin authorization, **When** PUT `/users/{userId}` is called, **Then** the system updates the specified fields and returns the updated profile with HTTP 200 status
2. **Given** an existing user profile and an update request with an already-used email, **When** PUT `/users/{userId}` is called, **Then** the system rejects the update and returns HTTP 409 with conflict error
3. **Given** a partial update request (only some fields) with proper authorization, **When** PUT `/users/{userId}` is called, **Then** the system updates only provided fields and preserves unchanged fields with HTTP 200 status
4. **Given** an update request from an unauthorized user (insufficient permissions), **When** PUT `/users/{userId}` is called, **Then** the system rejects the update and returns HTTP 403 Forbidden with error message
5. **Given** a non-existent user ID, **When** PUT `/users/{userId}` is called, **Then** the system returns HTTP 404 with appropriate error message

---

### User Story 3 - Delete User Profiles (Priority: P2)

An administrator or the user themselves needs to remove user profiles from the system when users leave the organization or for compliance purposes. Deletion is soft-delete (marking as inactive) to preserve audit trails and allow future recovery if needed.

**Why this priority**: Delete capability is important for administrative functions and data hygiene, but less critical than create/retrieve/update for core functionality.

**Independent Test**: Can be fully tested by:
1. Creating a user profile
2. Calling DELETE `/users/{userId}` to mark as inactive
3. Attempting to retrieve the deleted user and confirming it returns 404
4. Verifying the record still exists in the database (soft-delete, not hard-delete)
Delivers: Complete user lifecycle management with audit trail preservation

**Acceptance Scenarios**:

1. **Given** an existing user profile and admin authorization, **When** DELETE `/users/{userId}` is called, **Then** the system marks the user as inactive (sets `active: false`) and returns HTTP 204 with no content
2. **Given** a user that has been marked inactive, **When** GET `/users/{userId}` is called, **Then** the system returns HTTP 404 as if the user no longer exists
3. **Given** a delete request from an unauthorized user (insufficient permissions), **When** DELETE `/users/{userId}` is called, **Then** the system rejects the request and returns HTTP 403 Forbidden
4. **Given** a non-existent user ID, **When** DELETE `/users/{userId}` is called, **Then** the system returns HTTP 404 with appropriate error message

---

### User Story 4 - Search and List Users (Priority: P3)

Administrators and supervisory staff need to search and list users by various criteria (role, department, email) to manage the user base and generate reports. This supports administrative functions and batch operations.

**Why this priority**: Search and list functionality is valuable for administration but not critical for the MVP. Core CRUD operations work independently without this feature.

**Independent Test**: Can be fully tested by:
1. Creating multiple user profiles with different roles and departments
2. Calling GET `/users?role=Staff&department=Department%201` to search
3. Verifying returned results match search criteria
Delivers: Administrative user management capabilities

**Acceptance Scenarios**:

1. **Given** multiple users exist in the system with different roles and departments, **When** GET `/users?role=Staff` is called, **Then** the system returns all Staff users with HTTP 200 status
2. **Given** multiple users exist, **When** GET `/users?department=Department%201` is called, **Then** the system returns all users in Department 1 with HTTP 200 status
3. **Given** search criteria with no matching users, **When** GET `/users?role=NonExistent` is called, **Then** the system returns HTTP 200 with empty array
4. **Given** no query parameters provided, **When** GET `/users` is called, **Then** the system returns all users with pagination (limit and offset) supported with HTTP 200 status

---

### Edge Cases

- What happens when a user with insufficient permissions attempts to update or delete another user's profile (authorization check)?
- How does the system return HTTP 403 Forbidden when authorization fails (vs 404 for not found)?
- How does the system handle concurrent updates to the same user profile (optimistic locking or last-write-wins)?
- What happens when email uniqueness constraint is violated during creation or update?
- How does the system handle invalid input data types (non-UUID IDs, malformed emails)?
- What happens when the database connection fails during CRUD operations?
- What happens when a user attempts to retrieve, update, or delete an inactive (soft-deleted) user? (Returns 404 as if user doesn't exist)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a POST `/users` endpoint to create new user profiles with required fields: email (unique), password (hashed), role (Staff/Admin), department (Department 1/Department 2/Department 3)
- **FR-002**: System MUST provide a GET `/users/{userId}` endpoint to retrieve a single user's complete profile by ID
- **FR-003**: System MUST provide a PUT `/users/{userId}` endpoint to update user profile fields (email, role, department, and other profile data)
- **FR-004**: System MUST provide a DELETE `/users/{userId}` endpoint to mark a user profile as inactive (soft-delete, sets `active: false`)
- **FR-005**: System MUST provide a GET `/users` endpoint to list all **active** users with optional query filters: role, department, with pagination support (limit, offset). Inactive users are excluded from results.
- **FR-006**: System MUST validate all input data: email format, required fields, allowed role/department values
- **FR-007**: System MUST return consistent HTTP status codes: 200 (OK), 201 (Created), 204 (No Content), 400 (Bad Request), 403 (Forbidden - insufficient permissions), 404 (Not Found), 409 (Conflict - duplicate email)
- **FR-008**: System MUST return consistent JSON response format with success boolean and data/error fields for all endpoints
- **FR-009**: System MUST store user password in hashed form using bcryptjs (minimum 10 salt rounds, matching Auth Service standards)
- **FR-010**: System MUST validate email uniqueness at database level and return 409 Conflict if duplicate exists
- **FR-011**: System MUST use MongoDB as the database with Mongoose ODM for data persistence
- **FR-012**: System MUST run independently on port 4001 with mock authentication using role-simulated bearer tokens (format: `Bearer <role>:<identifier>` where role is admin or staff)
- **FR-013**: System MUST implement authorization checks on all CRUD endpoints: verify authentication token, extract role from token, enforce role-based permissions
- **FR-015**: System MUST return HTTP 403 Forbidden when an authenticated user lacks permissions for the requested operation
- **FR-016**: System MUST log all CRUD operations with timestamp, operation type, user role, and target user ID for audit trail
- **FR-017**: System MUST treat soft-deleted users (active: false) as non-existent in all GET operations; GET `/users/{userId}` returns 404 for inactive users

### Deferred Requirements (Phase 4+: Auth Service Integration)

- **FR-014**: System SHOULD expose a GET `/users/{userId}/verify` endpoint for Auth Service integration verification (returns `{exists: true/false}`, checks only active users). Deferred to Auth Service integration phase when real JWT validation replaces mock authentication. Complete contract specification available in `contracts/verify-user.md` for reference.

### Key Entities *(include if feature involves data)*

- **User Profile**:
  - `id`: UUID (unique identifier, auto-generated)
  - `email`: String (unique, required, lowercase, valid email format)
  - `passwordHash`: String (bcryptjs hashed, required)
  - `role`: Enum (Staff, Admin - required)
  - `department`: Enum (Department 1, Department 2, Department 3 - required)
  - `firstName`: String (optional, user's first name)
  - `lastName`: String (optional, user's last name)
  - `active`: Boolean (default: true, soft-delete support)
  - `lastLogin`: Date (optional, tracks last successful authentication)
  - `createdAt`: Date (auto-generated, UTC)
  - `updatedAt`: Date (auto-updated on modifications, UTC)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: User can create a profile and retrieve it within 2 seconds (end-to-end latency)
- **SC-002**: System successfully handles 100 concurrent user creation requests without data loss or duplicate entries
- **SC-003**: Email uniqueness validation prevents duplicate profiles; system returns 409 on duplicate email attempt
- **SC-004**: System maintains data consistency across all CRUD operations (no orphaned or partial records)
- **SC-005**: All API endpoints return responses within 500ms for operations on datasets with 10,000+ users
- **SC-006**: Search and list operations support pagination and can retrieve user data for 100,000+ users efficiently
- **SC-007**: System achieves 99% availability with proper error handling and fallback mechanisms
- **SC-008**: All passwords are stored securely with bcryptjs hashing (minimum 10 salt rounds)
- **SC-009**: All timestamps are recorded in UTC and consistently formatted across all responses
- **SC-010**: System passes all validation rules (email format, required fields, role/department constraints) without errors
- **SC-011**: Authorization checks work correctly: unauthorized users receive 403 Forbidden, authorized users proceed normally
- **SC-012**: Soft-delete works correctly: deleted users return 404 on GET, are excluded from list operations, but retain audit trail in database
- **SC-013**: Mock authentication successfully extracts and validates role from bearer tokens in format `Bearer <role>:<identifier>`

## Assumptions

- MongoDB is running and accessible at the configured URI (development: `mongodb://localhost:27017`)
- JWT token from Auth Service (when integrated) will be validated before accessing protected endpoints
- Email addresses are case-insensitive and stored in lowercase
- Password reset functionality is not included in this feature (handled by Auth Service)
- Role and Department enumerations are fixed and limited to: Roles (Staff, Admin), Departments (Department 1, Department 2, Department 3)
- **Soft deletes only**: Deleted users are marked inactive (`active: false`), not permanently removed; this allows future migration to recovery features
- **Mock authentication**: During development, bearer tokens use format `Bearer <role>:<identifier>` (e.g., `Bearer admin:user123`); authorization middleware extracts and validates role
- **Authorization deferred**: Specific rules for who can update/delete which users are deferred to implementation phase; architecture designed to support role-based rules via middleware/service layer (SRP principle)
- **Verify endpoint deferred**: The `GET /users/{userId}/verify` endpoint (FR-014) is deferred to the Auth Service integration phase (Phase 4+). During MVP (Phase 3), the system operates with mock authentication without this endpoint. The complete contract specification exists in `contracts/verify-user.md` as a reference for future implementation.
- The User Service will operate independently during development with mock authentication; integration with Auth Service comes in subsequent phase
- Inactive users are excluded from all list/search operations and return 404 when directly accessed, preserving soft-delete semantics

## Dependencies & Integration Points

- **Auth Service**: Integration point for token verification (future phase); currently mocked
- **MongoDB**: Required for data persistence
- **Express.js**: Framework for HTTP API
- **Mongoose ODM**: MongoDB object modeling
- **bcryptjs**: Password hashing library
- **API Gateway**: Will route `/users/*` requests from port 4000 to this service on port 4001

