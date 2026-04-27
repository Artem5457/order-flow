# Project Guidelines for Claude Code

## 📌 Project Overview
This is a NestJS backend using TypeORM and PostgreSQL with Redis.

## 🧱 Architecture
- Controllers → handle HTTP requests
- Services → business logic
- Repositories → database access (TypeORM)

## 🔐 Security Rules (CRITICAL)

- NEVER read or analyze `.env` files
- NEVER expose secrets or tokens
- NEVER log sensitive data
- Only use `.env.example` for reference

## 📂 Files to Ignore

Do NOT access or analyze:
- .env
- .env.*
- secrets/
- *.pem
- *.key

## 🧠 Coding Rules

- Always check for null/undefined
- Use async/await correctly
- Avoid `any` in TypeScript
- Use repository layer for DB access (TypeORM)
- Validate all external input

## 🧪 Debugging Rules

- Always find root cause, not symptoms
- Explain WHY the issue happens
- Provide exact fix with code

## ⚙️ Workflow Rules

- Do NOT analyze entire project unless explicitly asked
- Prefer working with specific files or diffs
- Keep responses concise and actionable

## 🚫 Forbidden Actions

- Do not modify multiple unrelated files
- Do not introduce breaking changes without warning
- Do not guess missing context

## ✅ Output Style

- Be precise
- Show code fixes
- Group issues by severity