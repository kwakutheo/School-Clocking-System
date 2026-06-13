# Security Review Report

I have conducted a static security review of the backend codebase, simulating an external security audit while utilizing access to the source code. Below are the key findings, categorized by severity, along with recommendations for remediation.

## 1. Information Leakage / User Enumeration (Medium Severity)

### The Issue
The authentication endpoints leak information about which users and emails exist in the system.
- **Password Reset (`auth.service.ts` -> `requestPasswordReset`)**: If an invalid username is provided, it throws: `"No account found with that username."`. If the email is wrong, it throws: `"The email address does not match..."`.
- **Registration**: Returns specific `"Username already in use"` or `"Email already in use"` errors.

### Impact
An attacker can perform rapid enumeration attacks to compile a list of valid usernames and their associated email addresses. This data is highly valuable for targeted phishing campaigns or brute-force attacks.

### Recommendation
Standardize the response for password resets. Regardless of whether the user exists or the email matches, the system should always return a generic success message (e.g., *"If an account matches those details, a reset PIN has been sent."*). 

---

## 2. Multi-Tenancy Architecture Gap (Medium Severity)

### The Issue
The system utilizes a clever TypeORM patch (`tenant-query.patch.ts`) to automatically inject `tenantId` boundaries into `.find()`, `.findOne()`, and `.createQueryBuilder()` methods. However, it **does not patch** `.update()` or `.delete()`.

### Impact
Currently, the services (like `EmployeesService` and `BranchesService`) correctly mitigate this by fetching the entity using `.findById()` (which enforces the tenant scope) before modifying or deleting it. However, this is an architectural fragility. If a developer in the future uses `this.repo.update(id, data)` directly without manually verifying the `tenantId`, it will immediately introduce a severe **Insecure Direct Object Reference (IDOR)** vulnerability, allowing a user in School A to modify or delete data in School B.

### Recommendation
Extend the TypeORM patch in `tenant-query.patch.ts` to also intercept `.update()` and `.delete()` queries to automatically append the `tenantId` to the `WHERE` clause, or establish a strict linting rule that forbids using `update/delete` without prior fetching.

---

## 3. Unverified JWT Decoding in Middleware (Low Severity)

### The Issue
In `tenant.middleware.ts`, the application extracts the `tenantId` by decoding the JWT using `jwt.decode(token)`.

```typescript
// tenant.middleware.ts
const decoded: any = jwt.decode(token); 
if (decoded.hasOwnProperty('tenantId')) {
  tenantId = decoded.tenantId;
}
```

### Impact
`jwt.decode()` parses the token without verifying the cryptographic signature. While the actual API endpoints are protected later in the request lifecycle by `JwtAuthGuard` (which properly verifies the signature), unauthenticated routes or global routes could theoretically have their tenant context manipulated by a forged token. 

### Recommendation
Use `jwt.verify(token, secret)` in the middleware to ensure the token is cryptographically sound before trusting any data inside it to establish the `tenantLocalStorage` context.

---

## 4. Plaintext PIN Logging Fallback (Low Severity)

### The Issue
In `auth.service.ts`, if SMTP credentials are not configured, the system falls back to logging the 6-digit password reset PIN in plaintext to the server console.

### Impact
While this is extremely useful for local development, if the application is ever deployed to production without SMTP credentials by mistake, anyone with access to the server logs (like a junior DevOps engineer) could intercept reset PINs and hijack admin accounts.

### Recommendation
Wrap the console logging fallback in an explicit environment check: `if (process.env.NODE_ENV === 'development')`. If it's production and SMTP is missing, it should fail securely rather than logging the PIN.
