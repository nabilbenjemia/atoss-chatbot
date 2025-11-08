<!--
SYNC IMPACT REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Version Change: 1.0.0 → 1.1.0
Rationale: MINOR version bump - Added three new software engineering principles

Modified Principles: None

Added Sections:
  • VII. Single Responsibility Principle (class/file design)
  • VIII. Low Coupling & High Cohesion (subsystem design)
  • IX. Version Control & Repository Hygiene (Git workflow)

Removed Sections: None

Templates Requiring Updates:
  ⚠ .specify/templates/plan-template.md - Review SRP and coupling requirements
  ⚠ .specify/templates/spec-template.md - Consider entity design guidance
  ⚠ .specify/templates/tasks-template.md - Add file organization validation tasks
  ⚠ .specify/templates/commands/*.md - Not present in repository

Follow-up TODOs:
  ✅ Create .gitignore template for MERN stack projects (COMPLETED)
  ⚠ Document recommended file organization patterns per SRP
  ⚠ Define subsystem boundaries for coupling analysis
  ⚠ Update code review checklist with new principles
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-->

# ATOSS.GPT Constitution

## Core Principles

### I. MERN Stack Architecture (NON-NEGOTIABLE)

All application components MUST use the MERN stack exclusively:
- **MongoDB**: All persistent data storage
- **Express.js**: Backend API framework
- **React.js**: Frontend UI framework
- **Node.js**: Runtime environment for all JavaScript execution

**Rationale**: Stack consistency ensures maintainability, reduces cognitive load, enables
full-stack JavaScript development, and leverages ecosystem synergies. No alternative
technologies may be introduced without constitutional amendment.

### II. Microservices Pattern

The application MUST follow microservices architecture with clear service boundaries:
- API Gateway as single entry point
- Authentication Service for user credentials and JWT management
- User Service for profile management
- Chatbot Service for conversational AI interactions
- Learning Service for training material generation
- Services communicate via REST APIs over HTTP

**Rationale**: Microservices enable independent deployment, scaling, and maintenance of
distinct functional domains. Clear boundaries prevent coupling and support team autonomy.

### III. Plain Language Communication

All user-facing content MUST prioritize plain language over technical jargon:
- Chatbot responses use conversational, accessible language
- Error messages provide clear guidance without technical codes
- Learning materials explain concepts without assuming prior knowledge
- UI labels and instructions are concise and action-oriented

**Rationale**: ATOSS.GPT exists to simplify onboarding. Plain language reduces barriers
to understanding and accelerates user competency with the ATOSS platform.

### IV. AI-Driven Knowledge Access

The chatbot MUST be the primary interface for accessing ATOSS platform guidelines:
- Natural language query support
- Context-aware responses based on user role and department
- Ability to reference and cite specific guideline sections
- Fallback to human support when confidence is low

**Rationale**: Conversational AI transforms passive documentation into active assistance,
meeting users where they are and reducing time-to-answer for common questions.

### V. Semi-Automated Learning Material Generation

Learning content generation MUST balance automation with human oversight:
- System generates structured learning materials from knowledge base
- Content requires manual review before publication
- Templates ensure consistency across materials
- Version control tracks content evolution

**Rationale**: Automation accelerates content creation while human review maintains
quality and accuracy. Semi-automation is more sustainable than fully manual processes.

### VI. Security & Authentication

Security MUST be enforced at all application layers:
- JWT-based authentication with refresh token rotation
- Role-based access control (Staff, Admin)
- Department-based data segregation
- Password hashing with bcrypt (minimum 10 salt rounds)
- HTTPS required for all production traffic
- Secure token storage (httpOnly cookies or secure storage APIs)

**Rationale**: User data and ATOSS platform guidelines are sensitive. Defense-in-depth
security protects against unauthorized access and data breaches.

### VII. Single Responsibility Principle (NON-NEGOTIABLE)

Every class, module, and file MUST have exactly one reason to change:
- Each class represents ONE concept or responsibility
- Each file contains ONE cohesive unit of functionality
- Controllers handle HTTP concerns only (no business logic)
- Services contain business logic only (no HTTP or data access details)
- Models define data structure only (no business rules)
- Utility functions are pure and focused on single operations
- Mixed responsibilities MUST be refactored into separate components

**Rationale**: Single Responsibility Principle (SRP) ensures code is maintainable,
testable, and understandable. When a component has multiple reasons to change, it
becomes fragile and difficult to modify safely. SRP reduces cognitive load and enables
parallel development without conflicts.

**Examples**:
- ❌ BAD: `UserController` that validates input, queries database, sends emails
- ✅ GOOD: `UserController` (HTTP), `UserService` (business logic), `UserRepository`
  (data access), `EmailService` (notifications)

### VIII. Low Coupling & High Cohesion

Subsystems MUST minimize dependencies while maximizing internal relatedness:
- **Low Coupling**: Services depend on interfaces/contracts, not implementations
- **High Cohesion**: Related functionality grouped together within subsystems
- Microservices communicate only through defined REST APIs
- Shared logic extracted to separate libraries/utilities
- Database schemas isolated per service (no shared tables across services)
- Frontend components organized by feature, not by technical layer
- Circular dependencies are strictly prohibited

**Rationale**: Low coupling enables independent development and deployment of subsystems.
High cohesion ensures changes to related functionality occur in one place. Together, they
create maintainable, scalable architecture that supports team autonomy and reduces
integration friction.

**Coupling Constraints**:
- Authentication Service → MongoDB only
- User Service → Authentication Service API (for token validation) + MongoDB
- Chatbot Service → User Service API + Learning Service API
- Learning Service → User Service API + MongoDB
- API Gateway → All service APIs (routing only, no business logic)

**Cohesion Requirements**:
- All user profile operations in User Service
- All authentication operations in Authentication Service
- All conversational AI in Chatbot Service
- All content generation in Learning Service

### IX. Version Control & Repository Hygiene

Git workflow MUST maintain clean, traceable history:
- **Commit Messages**: Follow conventional commits format (`type(scope): message`)
  - Types: `feat`, `fix`, `docs`, `refactor`, `chore`, `style`, `test`
  - Example: `feat(auth): add password reset functionality`
- **Branch Strategy**: Feature branches from `main`, merge via pull request
  - Branch naming: `feature/###-description`, `fix/###-description`
  - No direct commits to `main` branch
- **.gitignore Requirements**: MUST ignore:
  - `node_modules/` (all JavaScript dependencies)
  - `.env` and `.env.*` files (secrets and environment config)
  - Build artifacts: `dist/`, `build/`, `.next/`, `.cache/`
  - IDE files: `.vscode/`, `.idea/`, `*.swp`, `.DS_Store`
  - Logs: `*.log`, `logs/`, `npm-debug.log*`
  - MongoDB data directories if running locally
  - Coverage reports: `coverage/`, `.nyc_output/`
- **Tracking Strategy**: DO track:
  - Source code: `src/`, `frontend/src/`, `backend/src/`
  - Configuration templates: `.env.example`, `config/*.example.json`
  - Documentation: `README.md`, `docs/`, `*.md`
  - Tests: `tests/`, `__tests__/`, `*.test.js`, `*.spec.js`
  - Package definitions: `package.json`, `package-lock.json`
  - Infrastructure as code: `docker-compose.yml`, Dockerfiles
- **Pull Request Requirements**:
  - Descriptive title and body explaining changes
  - Link to related issue/spec if applicable
  - Constitution compliance verified by reviewer
  - No merge conflicts before approval

**Rationale**: Clean version control enables collaboration, code review, rollback, and
debugging. Conventional commits support automated changelog generation. Proper ignore
patterns prevent secrets leakage and repository bloat. Feature branches enable parallel
development without interference.

## Technology Stack Requirements

### Mandatory Technologies
- **Database**: MongoDB with Mongoose ODM
- **Backend**: Node.js + Express.js (version 5.x or later)
- **Frontend**: React.js + Vite build tool
- **Authentication**: JWT (jsonwebtoken library)
- **Password Security**: bcryptjs
- **HTTP Client**: axios
- **API Gateway**: express-http-proxy
- **Environment Management**: dotenv

### Prohibited Technologies
- Alternative databases (PostgreSQL, MySQL, etc.) without amendment
- Alternative backend frameworks (Fastify, Koa, etc.) without amendment
- Alternative frontend frameworks (Vue, Angular, Svelte) without amendment

### Optional/Discretionary Technologies
- UI component libraries (Material-UI, Ant Design, etc.)
- State management (Redux, Zustand, Context API)
- Form validation libraries
- Logging frameworks (Winston, Pino)
- API documentation tools (Swagger/OpenAPI)

## Development Workflow

### Feature Development Process
1. **Specification**: Document feature requirements and API contracts
2. **Implementation**: Build backend service logic and API endpoints
3. **Frontend Integration**: Develop React components consuming APIs
4. **Manual Verification**: Developer tests functionality end-to-end
5. **Code Review**: Peer review for code quality and architecture alignment
6. **Deployment**: Merge to main branch and deploy to target environment

### No Automated Testing Requirement
Automated tests (unit, integration, E2E) are NOT required. Quality assurance is the
developer's responsibility through manual testing and code review.

**Rationale**: Project scope and team structure prioritize rapid development. Testing
infrastructure would add complexity without proportional value given current scale.

### Code Review Standards
- All code changes require peer review before merge
- Reviews MUST verify constitution compliance
- Reviewers check for security vulnerabilities
- API contracts must match documentation
- Code follows established patterns and conventions

### Documentation Requirements
- API endpoints documented with request/response schemas
- Database schema changes documented in migration notes
- Architecture decisions captured in ADR format
- README files maintained for each microservice

## Governance

### Constitution Authority
This constitution supersedes all other development practices and guidelines. In case of
conflict between this document and other project documentation, the constitution prevails.

### Amendment Procedure
1. Propose amendment with rationale and impact analysis
2. Document affected systems and required migrations
3. Obtain approval from project stakeholders
4. Update constitution with new version number following semantic versioning
5. Update dependent templates and documentation
6. Communicate changes to all team members

### Versioning Policy
- **MAJOR** (x.0.0): Backward-incompatible governance changes, principle removals
- **MINOR** (0.x.0): New principles added, material expansions to existing principles
- **PATCH** (0.0.x): Clarifications, typo fixes, non-semantic refinements

### Compliance Review
- Constitution compliance MUST be verified during code reviews
- Architectural decisions MUST reference relevant constitutional principles
- Violations MUST be justified and documented as technical debt
- Repeated violations trigger constitutional review and potential amendment

### Living Document
This constitution is a living document. As the project evolves, principles may be added,
refined, or retired through the amendment process. Regular reviews ensure alignment with
project needs.

**Version**: 1.1.0 | **Ratified**: 2025-11-08 | **Last Amended**: 2025-11-08
