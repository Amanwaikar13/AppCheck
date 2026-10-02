# AppCheck

## Web Application Security & Code Quality Analyzer

AppCheck is a full-stack web application designed to analyze web applications for common security weaknesses, exposed secrets, vulnerable dependencies, insecure configurations, and potentially dangerous coding patterns.

The application supports two primary scanning methods:

1. **URL Scan** — Analyze a running web application.
2. **Source Code Scan** — Upload a project ZIP and analyze its source code.




## 📌 Project Overview

Modern web applications use multiple frameworks, APIs, databases, authentication systems, third-party packages, and external services.

A small configuration mistake or insecure coding pattern can introduce security risks.

AppCheck aims to provide a single platform where developers can run automated security checks and view the results through a clear and developer-friendly dashboard.

### High-Level Flow

```text
                         ┌─────────────────────┐
                         │      AppCheck       │
                         └──────────┬──────────┘
                                    │
                     ┌──────────────┴──────────────┐
                     │                             │
                     ▼                             ▼
                URL SCAN                      SOURCE SCAN
                     │                             │
             Running Website                  ZIP Upload
                     │                             │
                     ▼                             ▼
                OWASP ZAP                     Semgrep
                HTTP Checks                   Gitleaks
                Security Headers              npm audit
                Cookie Checks                 OSV Scanner
                TLS Checks                    Custom Rules
                     │                             │
                     └──────────────┬──────────────┘
                                    │
                                    ▼
                         Result Normalization
                                    │
                                    ▼
                                MongoDB
                                    │
                                    ▼
                          Security Dashboard
                                    │
                                    ▼
                             Security Report


🎯 Project Goals

AppCheck is designed to:

Analyze running web applications.
Analyze application source code.
Detect common security weaknesses.
Detect exposed secrets and credentials.
Identify vulnerable dependencies.
Analyze security headers and cookies.
Detect potentially insecure coding patterns.
Provide actionable recommendations.
Maintain scan history.
Generate security reports.
Demonstrate practical application-security concepts.


🔍 Scan Modes

1. URL Scan

The user provides a live web application URL.

Example:

https://example.com

AppCheck performs authorized security checks against the running application.

Planned URL Checks
HTTPS configuration
HTTP → HTTPS redirect
HSTS
Content-Security-Policy
X-Frame-Options
X-Content-Type-Options
Referrer-Policy
Secure cookies
HttpOnly cookies
SameSite cookies
CORS configuration indicators
Information disclosure
Source-map exposure
TLS-related configuration
Common web application vulnerabilities
Primary Scanner

OWASP ZAP

OWASP ZAP will be used for dynamic application security testing.

📦 2. Source Code Scan

Users can upload a project as a ZIP file.

Example:

my-project.zip

AppCheck analyzes the source code without executing the uploaded application.
Planned Source-Code Checks


🔐 Secrets Detection

Detect potential:

API keys
Passwords
Access tokens
Private keys
Cloud credentials
Database credentials
JWT secrets
.env files

Tool: Gitleaks

🛡️ Insecure Code Detection

Analyze source code for potentially dangerous patterns such as:

Injection
XSS
Command execution
Unsafe functions
Authentication weaknesses
Authorization-related patterns
Insecure configuration
Unsafe data handling

Tool: Semgrep


📦 Dependency Vulnerabilities

Analyze project dependencies for known vulnerabilities.

Tools:

npm audit
OSV-Scanner
⚙️ Configuration Analysis

Potential checks include:

Debug configuration
Environment files
Hardcoded credentials
Weak JWT configuration
Insecure CORS configuration
Sensitive information in logs
Missing validation indicators

🧰 Technology Stack

Frontend
Next.js
React
JavaScript
Redux Toolkit
React Hook Form
Axios
Tailwind CSS
Recharts
TanStack Table
Backend
Node.js
Express.js
JavaScript
REST API
JWT
bcrypt
Multer
Helmet
express-rate-limit
Zod
Pino
Database
MongoDB
Mongoose
MongoDB Atlas
Security Tools
OWASP ZAP
Semgrep
Gitleaks
npm audit
OSV-Scanner
Development Tools
Git
GitHub
Postman
Docker
VS Code


🏗️ Architecture
                         ┌──────────────────────┐
                         │       Next.js        │
                         │    React Frontend    │
                         └──────────┬───────────┘
                                    │
                                  Axios
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │    Express API       │
                         │      Node.js         │
                         └──────────┬───────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
              ▼                     ▼                     ▼
       Authentication          Scan Manager           MongoDB
                                    │
                         ┌──────────┴──────────┐
                         │                     │
                         ▼                     ▼
                     URL Scan             Source Scan
                         │                     │
                         ▼                     ▼
                    OWASP ZAP             Semgrep
                                         Gitleaks
                                        npm audit
                                      OSV-Scanner
                         │                     │
                         └──────────┬──────────┘
                                    │
                                    ▼
                           Result Normalization
                                    │
                                    ▼
                                 MongoDB
                                    │
                                    ▼
                           Security Dashboard
                                    │
                                    ▼
                              Final Report


🔄 URL Scan Flow

User
 │
 │ Enter URL
 ▼
Next.js
 │
 │ POST /api/scans/url
 ▼
Express API
 │
 ├── Validate URL
 ├── Authenticate User
 ├── Create Scan
 └── Create Scan Job
          │
          ▼
     Scan Processor
          │
          ▼
       OWASP ZAP
          │
          ▼
      Raw Results
          │
          ▼
  Result Normalization
          │
          ▼
       MongoDB
          │
          ▼
    React Dashboard
          │
          ▼
    Security Report


🔄 Source Code Scan Flow

User
 │
 │ Upload ZIP
 ▼
Next.js
 │
 │ multipart/form-data
 ▼
Express API
 │
 ├── Authenticate
 ├── Validate File
 ├── Validate Size
 └── Create Scan
          │
          ▼
   Temporary Directory
          │
          ▼
    Safe ZIP Extraction
          │
          ▼
   ┌──────┼───────────┐
   │      │           │
   ▼      ▼           ▼
Semgrep Gitleaks   npm audit
                       │
                       ▼
                  OSV Scanner
   │      │           │
   └──────┼───────────┘
          │
          ▼
   Result Normalization
          │
          ▼
       MongoDB
          │
          ▼
   Security Dashboard
          │
          ▼
      Final Report
          │
          ▼
 Temporary Files Deleted


🔐 Security Architecture

AppCheck itself will also be developed with security in mind.

Authentication
JWT authentication
Password hashing using bcrypt
Protected routes
Authentication middleware
Authorization

Role-Based Access Control:

User
Admin
User

Users can:

Create scans
View their own scans
View their own findings
View reports
Admin

Admins can additionally:

View users
View all scans
View system statistics
Manage users


🛡️ API Security

Planned protections:

Input validation
Rate limiting
Helmet
CORS configuration
Centralized error handling
Secure environment variables
Authentication middleware
Authorization middleware


📁 File Upload Security

Uploaded source code is considered untrusted data.

The application will implement:

ZIP Upload
     │
     ▼
File Type Validation
     │
     ▼
File Size Validation
     │
     ▼
Safe Temporary Directory
     │
     ▼
Safe ZIP Extraction
     │
     ▼
Path Traversal Protection
     │
     ▼
Security Scanning
     │
     ▼
Results Stored
     │
     ▼
Temporary Files Deleted

The uploaded application will not be executed by AppCheck.



🔑 Sensitive Data Protection

AppCheck will not expose complete secrets discovered during scanning.

Example:

Detected:

sk_live_****************7x

Instead of:

sk_live_actual_secret_value

Passwords, JWT secrets, API keys, and other sensitive information must never be logged or returned to the frontend.



📊 Security Findings

Different security tools produce different result formats.

AppCheck will normalize their results into a common finding structure.

Example:

{
  "severity": "CRITICAL",
  "category": "Secrets",
  "title": "Hardcoded API Secret",
  "description": "A potential API credential was detected.",
  "recommendation": "Move the credential to an environment variable.",
  "sourceTool": "Gitleaks",
  "file": "backend/config.js",
  "line": 18,
  "status": "open"
}

This allows the frontend to display findings consistently regardless of which scanner detected them.

🚦 Severity Levels

Findings will be categorized into:

🔴 Critical
🟠 High
🟡 Medium
🔵 Low

AppCheck will also provide an AppCheck Security Score.

The AppCheck Security Score is a project-specific risk indicator and is not an industry-standard security rating.


📈 Dashboard

The planned dashboard will include:

Overview
Security Score
Total Scans
Critical Findings
High Findings
Medium Findings
Low Findings
Charts
Findings by severity
Findings by category
Scan history
Vulnerability trends
Tables
Recent scans
Recent findings
Scan status
Finding details


📋 Scan History

Users will be able to view previous scans.

Example:

Target              Type       Status       Score
--------------------------------------------------
example.com         URL        Completed    82
project.zip         Source     Completed    71
demo-app.com        URL        Completed    94

Users can open a previous scan to view its complete report.


🔑 Authentication Flow

Register
   │
   ▼
Password Hashing
   │
   ▼
MongoDB
   │
   ▼
Login
   │
   ▼
Password Verification
   │
   ▼
JWT
   │
   ▼
Protected Application


🗂️ Planned Project Structure

appcheck/
│
├── frontend/
│   ├── app/
│   ├── components/
│   ├── features/
│   ├── hooks/
│   ├── lib/
│   ├── services/
│   └── store/
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   │   ├── zap/
│   │   │   ├── semgrep/
│   │   │   ├── gitleaks/
│   │   │   ├── dependencies/
│   │   │   └── custom-rules/
│   │   ├── utils/
│   │   └── validators/
│   │
│   └── server.js
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── DATABASE.md
│   ├── SECURITY.md
│   └── DEVELOPMENT.md
│
├── .gitignore
└── README.md


🧪 Testing Strategy

AppCheck will be tested only against applications that we own or are explicitly authorized to test.

A dedicated intentionally vulnerable demo application may be used to test the scanning functionality.

Vulnerable Demo Application
            │
            ▼
         AppCheck
            │
            ▼
      Detect Findings
            │
            ▼
      Fix Vulnerability
            │
            ▼
        Scan Again
            │
            ▼
    Verify Improvement

This provides a safe and repeatable way to validate the scanner.


⚠️ Responsible Use

AppCheck is intended for:

Development environments
Applications owned by the user
Authorized security assessments
Local security testing
Security education

Users should only scan applications when they have permission to test them.

AppCheck is an automated analysis tool and cannot guarantee that an application is secure.

Automated security tools may produce:

False positives
False negatives
Potential findings requiring manual verification

Complex business-logic vulnerabilities and authorization issues may require manual security testing.


🚧 Development Status

Phase 1 — Project Setup
 Next.js setup
 React setup
 JavaScript configuration
 Tailwind CSS
 Redux Toolkit
 Node.js setup
 Express setup
 MongoDB Atlas
 Frontend ↔ Backend connection
 MongoDB connection
 Initial health API

Phase 2 — Frontend
 Professional dashboard
 Navigation
 Authentication UI
 Scan creation UI
 Scan history
 Findings UI
 Reports
 Responsive design

Phase 3 — Backend
 Authentication API
 Authorization
 MongoDB models
 Scan APIs
 Finding APIs
 Error handling
 Logging
 Validation

Phase 4 — URL Scanner
 OWASP ZAP integration
 Security header checks
 Cookie checks
 HTTPS/TLS checks
 CORS checks
 Result normalization

Phase 5 — Source Scanner
 ZIP upload
 Secure extraction
 Semgrep integration
 Gitleaks integration
 npm audit
 OSV Scanner
 Custom security rules

Phase 6 — Reporting
 Security score
 Findings dashboard
 Charts
 Reports
 Scan history

Phase 7 — Hardening & Deployment
 Security audit
 Dependency audit
 Testing
 Production configuration
 Deployment
 Documentation


🗺️ Development Roadmap

                    APP CHECK
                        │
                        ▼
              ┌─────────────────┐
              │ 1. Project Setup│
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ 2. Frontend UI  │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ 3. Authentication│
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ 4. REST API     │
              │ MongoDB         │
              └────────┬────────┘
                       │
             ┌─────────┴─────────┐
             ▼                   ▼
      ┌─────────────┐     ┌──────────────┐
      │ 5. URL Scan │     │ 6. Source    │
      │ OWASP ZAP   │     │ Code Scan    │
      └──────┬──────┘     └──────┬───────┘
             │                   │
             └─────────┬─────────┘
                       ▼
              ┌─────────────────┐
              │ 7. Normalization│
              │ & Findings      │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ 8. Reports      │
              │ & Dashboard     │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ 9. Security     │
              │ Hardening       │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ 10. Deployment  │
              └─────────────────┘


📚 Learning Objectives

Frontend
React
Next.js
JavaScript
Redux Toolkit
React Hook Form
API integration
Responsive UI
Charts
Tables
File uploads
State management

Backend
Node.js
Express.js
REST APIs
Authentication
Authorization
JWT
Password hashing
Validation
Error handling
Logging
File processing

Database
MongoDB
Mongoose
Data modeling
Querying
Indexing
Security
OWASP concepts
SAST
DAST
Authentication
Authorization
JWT
Password security
XSS
Injection
Secrets management
Security headers
CORS
CSRF concepts
Dependency vulnerabilities
File upload security
Path traversal
Rate limiting
Software Engineering
Git
GitHub
API testing
Docker
Environment configuration
Deployment
Application architecture
Background processing
Logging and monitoring
