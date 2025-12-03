# MailSift - Email Extraction Platform

## Overview

MailSift is a web and mobile application designed to extract email addresses from websites. Users paste a URL, and the application scrapes and returns valid email addresses found on that page. The platform includes user authentication, tiered subscription plans with usage limits, and a modern, user-friendly interface built with React and Express.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- **Framework:** React 18 with TypeScript
- **Routing:** Wouter (lightweight client-side routing)
- **State Management:** TanStack Query (React Query) for server state
- **UI Components:** Radix UI primitives with shadcn/ui component system
- **Styling:** Tailwind CSS with custom design tokens
- **Build Tool:** Vite

**Design System:**
- Dark-first theme with violet/purple accent colors for a tech-focused aesthetic
- Custom fonts: Inter (body), Space Grotesk (headings)
- Component library follows "New York" shadcn style variant
- Responsive design with mobile-first approach

**Key Pages:**
- **Home:** Landing page with hero section, feature showcase, and call-to-action
- **Auth:** Combined login/signup page with tabbed interface
- **Dashboard:** Main application interface for extracting emails and viewing history

**State Management Strategy:**
- Server state cached via React Query with disabled refetching by default
- Session-based authentication for web clients
- JWT token support for API/mobile clients
- Client-side routing with Wouter for minimal bundle size

### Backend Architecture

**Technology Stack:**
- **Runtime:** Node.js with TypeScript
- **Framework:** Express.js
- **Database:** MongoDB with native driver
- **Session Management:** express-session with MemoryStore
- **Authentication:** Dual approach - sessions for web, JWT for mobile/API
- **Email Extraction:** Cheerio for HTML parsing, native fetch for HTTP requests

**API Design:**
RESTful endpoints organized by domain:
- **/api/auth/**: Web authentication endpoints (session-based: signup, login, logout, current user)
- **/api/mobile/auth/**: Mobile authentication endpoints (JWT-based: signup, login)
- **/api/extract**: Email extraction endpoint (supports both session and JWT auth)
- **/api/extractions**: History of past extractions
- **/api/stats**: User statistics and plan limits

**Authentication Strategy:**
The application supports two **strictly separated** authentication mechanisms to prevent security issues:
1. **Session-based (Web):** `/api/auth/*` endpoints use express-session with cookies for browser clients. These endpoints **never** issue JWT tokens.
2. **JWT-based (Mobile/API):** `/api/mobile/auth/*` endpoints issue Bearer tokens for mobile apps and API integrations. Tokens are only issued when explicitly requested through mobile-specific endpoints.

This separation prevents session hijacking from escalating to long-lived JWT access, as JWTs can only be obtained through explicit mobile authentication flows that require credentials.

**Test Account:**
- Email: test@mailsift.com
- Password: test123
- Plan: free

**Email Extraction Logic:**
- Fetches HTML content from provided URL with 10-second timeout
- Parses HTML using Cheerio, removing script/style tags
- Extracts emails using regex pattern matching
- Checks mailto links for additional email addresses
- Deduplicates and validates email format
- Stores extraction results with user association

**Plan Limits System:**
- **Free Plan:** 500 links scanned, 500 emails extracted
- **Basic Plan:** 1,000 links scanned, 1,000 emails extracted  
- **Premium Plan:** Unlimited usage
- Usage tracked per user in MongoDB documents
- Enforced before extraction, returns error if limit exceeded

### Database Schema

**Collections:**

**Users Collection:**
- `_id`: String (MongoDB ObjectId converted to string)
- `email`: String (unique, indexed)
- `password`: String (bcrypt hashed)
- `firstName`: String
- `lastName`: String
- `plan`: String (default: "free")
- `emailsExtracted`: Number (default: 0)
- `linksScanned`: Number (default: 0)
- `createdAt`: Date

**Extractions Collection:**
- `_id`: String (MongoDB ObjectId converted to string)
- `userId`: String (indexed for efficient queries)
- `url`: String
- `status`: String (default: "processing")
- `emails`: Array of Strings
- `scannedAt`: Date

**Schema Validation:**
Zod schemas define type-safe interfaces shared between client and server via the `/shared` directory, ensuring consistency across the full stack.

### Build and Deployment

**Build Process:**
- Client built with Vite, output to `dist/public`
- Server bundled with esbuild, output to `dist/index.cjs`
- Selected dependencies bundled to reduce cold start times
- Custom build script orchestrates both builds sequentially

**Development Workflow:**
- Separate dev servers for client (Vite on port 5000) and server (tsx watch mode)
- Vite HMR integration via middleware mode
- Development-only Replit plugins for debugging and UI enhancements

**Production Optimizations:**
- Static file serving from dist/public
- Session persistence with MemoryStore (production should use connect-pg-simple or Redis)
- Environment-based configuration (NODE_ENV)

## External Dependencies

### Third-Party Services

**Database:**
- **MongoDB:** Primary database via native MongoDB driver (@neondatabase/serverless package name is misleading - the application uses MongoDB, not Neon/Postgres)
- Connection string expected in `MONGODB_URL` environment variable

**Authentication:**
- **bcryptjs:** Password hashing
- **jsonwebtoken:** JWT token generation and verification
- JWT secret configurable via `JWT_SECRET` environment variable
- Session secret via `SESSION_SECRET` environment variable

**Web Scraping:**
- **cheerio:** HTML parsing and DOM traversal for email extraction
- Native fetch API for HTTP requests (Node.js 18+)

### UI Libraries

- **Radix UI:** Headless component primitives for accessibility
- **Framer Motion:** Animation library for interactive UI elements
- **Lucide React:** Icon library
- **Tailwind CSS:** Utility-first CSS framework

### Development Tools

- **Replit Plugins:** Development banner, cartographer (in development mode)
- Custom Vite plugin for OpenGraph image meta tag injection
- TypeScript for type safety across the stack

### Build Dependencies

- **Vite:** Frontend build tool and dev server
- **esbuild:** Server bundling for production
- **tsx:** TypeScript execution for development
- **drizzle-kit:** Database migration tool (configured for PostgreSQL but not actively used since MongoDB migration)

**Note:** The `drizzle.config.ts` and references to Drizzle ORM/PostgreSQL are legacy configuration files. The application currently uses MongoDB with the native driver for all database operations.