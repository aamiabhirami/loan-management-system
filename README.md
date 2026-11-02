# Mitra Loan Management

An India-focused loan-servicing workspace built with Next.js 16, React, Tailwind CSS, shadcn/ui, Highcharts, NextAuth credentials authentication, Mongoose, and MongoDB.

For detailed role-by-role instructions covering administrator, director, shareholder, field-manager, and customer workflows, see the [Mitra User Guide](./USER_GUIDE.md).

## Included workflows

- Role-based access for customers (`user`), field managers/collection agents (`privileged`), administrators (`admin`), directors, and shareholders. Customer records and loan/collection data are scoped server-side; privileged users manage their assigned customers; organization administrators manage the organization.
- Configurable loan products with weekly, fortnightly, or monthly reducing-balance schedules, actual/365 or actual/360 day counts, a configurable household debt-to-income limit, grace periods, late fees, penalty interest, and optional caps.
- Loan application, borrower-consented credit-check, administrator approval/rejection, sandbox disbursement, installment collections, and printable receipts.
- Joint-liability groups, field-collected cash/UPI/bank-transfer records, collection notification adapter, PAR 30/60/90 portfolio views, and append-only application audit events.
- Business expense records, director and field-manager payroll with earnings/deductions and monthly reports, and private customer document uploads to Cloudinary with authorized downloads.
- Credit-bureau, disbursement, and notification interfaces currently use clearly labeled sandbox implementations. Sandbox bureau output is not a report and cannot support a real credit decision; sandbox disbursement never transfers funds.

## Requirements

- Node.js 22.14 or newer (the finance test runner uses Node's TypeScript type stripping).
- A MongoDB replica set or transaction-capable MongoDB deployment. Application mutations write their business record and audit event in the same transaction. A standalone MongoDB server is not sufficient.

## Local setup

1. Install packages with `npm install`.
2. Create `.env.local` from `.env.example` and set:
   - `MONGODB_URI` to a replica-set/Atlas connection string.
   - `NEXTAUTH_URL` to the application origin.
   - `NEXTAUTH_SECRET` to a cryptographically random secret (for example, generate 32 random bytes).
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` from the Cloudinary console to enable private customer document uploads and downloads.
3. Set `ADMIN_NAME` and `ADMIN_EMAIL` in `.env.local` for the first administrator. Leave `ADMIN_PASSWORD` blank to have the bootstrap command generate and display a secure one-time password, or set your own temporary password of at least 12 characters. Run `npm run setup:admin`, save the generated password if applicable, then remove any temporary password from the environment. The command refuses to create a second administrator.
4. Run `npm run dev` and sign in with the bootstrap account.
5. Create an active loan product, then provision field managers and customers in **Team access**. Assign customers to a field manager before using group/collection workflows.

For local MongoDB, start MongoDB as a replica set and initialize it before connecting. Never commit `.env.local` or real credentials.

## Financial and workflow notes

- Money is stored as integer paise. Schedule interest accrues on the actual number of days in each period using the selected annual day-count basis; the final installment is adjusted for paise rounding.
- Product penalty terms are applied to due installments when a collection is recorded. Validate the chosen rate, grace period, fee, cap, accounting treatment, customer disclosures, and collection allocation order with the lender's finance/compliance team.
- The affordability gate compares the product's configurable debt-to-income ceiling with self-declared household income and outside monthly debt plus estimated payments on this organization's active loans. It is an intake safeguard, not bureau verification; confirm and configure policy with the lender's compliance team.
- PAR measures shown are the outstanding principal of active loans with an unpaid installment past the relevant age. The 90+ day measure is an operational NPA proxy, not an RBI or other statutory classification.
- A borrower must be signed in to consent to a sandbox credit inquiry. The sandbox does not connect to CIBIL, Equifax, Experian, or CRIF High Mark.
- Field collections are recorded atomically with installment allocations and their audit events. Receipts confirm an application record, not a bank settlement.
- Expense and payroll entries are accounting records only; marking payroll paid does not initiate a bank transfer. Expense receipt references remain external. Customer documents are uploaded to Cloudinary using authenticated/private delivery and can only be downloaded through an authorized, short-lived link; uploads are limited to PDF/JPEG/PNG files up to 10 MB.
- Field capture currently requires connectivity. Offline synchronization, SMS delivery, payment-rail integrations, and Bluetooth printer support need organization-approved providers/device workflows and are not enabled by the sandbox adapters.
- Audit rows are append-only through the application/Mongoose model. Database operators with direct database privileges can still alter data; production immutability requires separately controlled infrastructure, backups, and audit-log retention.
- Authentication uses NextAuth's credentials provider. Protect `NEXTAUTH_SECRET` and MongoDB credentials, configure TLS, backups, access logging, rate limits, retention, and security monitoring before production.
- India-specific bureau access, privacy/consent, KYC/AML, RBI, NBFC-MFI, provisioning/NPA, interest/fee disclosures, data-locality, and reporting obligations require lender-specific legal and compliance review. This starter is not a compliance certification.

## Commands

```text
npm run dev          # Development server
npm run typecheck    # TypeScript validation
npm test             # Financial and workflow tests
npm run lint         # ESLint
npm run build        # Production build
npm run setup:admin  # One-time bootstrap for the first administrator
```
"# loan-management-system" 
