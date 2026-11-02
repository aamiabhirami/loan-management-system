# Mitra User Guide

This guide describes the current Mitra application flows for customers, field managers/collection agents, administrators, directors, and shareholders. It is written for the features present in this starter; screens and integrations may differ after your organization configures production providers.

## Contents

- [1. Sign in and navigate](#1-sign-in-and-navigate)
- [2. Roles and access](#2-roles-and-access)
- [3. First-time administrator setup](#3-first-time-administrator-setup)
- [4. Administrator workflows](#4-administrator-workflows)
- [5. Field manager workflows](#5-field-manager-workflows)
- [6. Customer workflows](#6-customer-workflows)
- [7. Shared loan and collection lifecycle](#7-shared-loan-and-collection-lifecycle)
- [8. Dashboard, reports, receipts, and audit](#8-dashboard-reports-receipts-and-audit)
- [9. Important operating limits](#9-important-operating-limits)
- [10. Troubleshooting](#10-troubleshooting)

## 1. Sign in and navigate

1. Open the application at the address configured for your installation (the local development default is `http://localhost:3000`).
2. On **Sign in to Mitra**, enter the work email and password provisioned for your account.
3. After a successful sign-in, Mitra opens the dashboard. Your role is shown in the workspace header; the sidebar only shows sections available to that role.
4. To leave a shared or public computer, use **Sign out** in the upper-right corner.

If you cannot sign in, check that the account is active, confirm the exact email and password with the organization administrator, and verify that the application can reach MongoDB. Do not share passwords in chat, email, or receipts.

### Account settings

All roles can open **Account settings** to update their name, phone, and address. The sign-in email is read-only here. To change a password, provide the current password and a new password of at least 12 characters, then save. Contact an administrator if the account is inactive or the assigned role is wrong.

## 2. Roles and access

| Role | Records and actions |
| --- | --- |
| **Customer** (`user`) | View their own dashboard, applications/loans, and receipts; apply for a loan for themselves; provide consent for a pending application's sandbox credit inquiry; manage their profile. |
| **Field manager** (`privileged`) | View their assigned customers and the loans, groups, and collections in their scope; create customer accounts assigned to themselves; create and service applications for assigned customers; organize their groups; review portfolio reports; manage their profile. |
| **Administrator** (`admin`), **Director** (`director`), **Shareholder** (`shareholder`) | Organization-wide administrator access, including account and assignment management, products, groups, loan decisions and sandbox disbursement; expenses, payroll, customer-document references, portfolio information, and audit trail. |

Access restrictions are enforced by the server as well as the navigation. A field manager cannot browse another manager's assigned customers. Customers cannot access administrative screens or another customer's records. Inactive accounts cannot sign in.

## 3. First-time administrator setup

An administrator should prepare the workspace in this order:

1. **Configure a loan product** in **Loan products**. Applications cannot be submitted without an active product.
2. **Create field-manager accounts** in **Team access**. Use a unique email and a temporary password of at least 12 characters; share that password securely.
3. **Create customer accounts** in **Team access**. Assign each customer to the correct active field manager, or leave them unassigned until ownership is decided.
4. Review customer KYC status and account activation from the customer/team list.
5. Create the organization's **JLG groups** and assign a field manager.
6. Provision director and shareholder accounts when needed; both roles have organization-wide administrator access.
7. Start receiving loan applications, reviewing the dashboard, and recording collections.

The first administrator is provisioned through the one-time bootstrap process described in [README.md](./README.md). The bootstrap refuses to create a second administrator.

## 4. Administrator workflows

### 4.1 Configure a loan product

Open **Loan products**, choose **New product**, and enter:

- A name, unique product code, and optional description.
- Minimum and maximum principal in rupees.
- Minimum and maximum tenure in months.
- Annual interest rate and day-count basis (Actual/365 or Actual/360).
- Repayment cadence: weekly, fortnightly, or monthly. Weekly products require a payment weekday; monthly products require a day of the month (dates beyond a month's length fall on that month's last day).
- Maximum debt-to-income percentage for the affordability check.
- Grace days, fixed late charge, annual penalty rate, and optional penalty cap.

Review every value against the organization's approved lending policy, disclosures, and compliance guidance before making the product active. Product settings apply to new applications. An administrator can edit a product only until its first loan application is created; after that, the product terms are locked to preserve the terms used by that application. Deactivating a product prevents it from being selected for new applications and does not erase existing loans.

### 4.2 Provision and manage organization accounts

In **Team access**, choose **Add account** and provide the person's name, email, optional phone, and temporary password (at least 12 characters). Administrators select a role:

- **Customer**: optionally assign an active field manager.
- **Field manager**: create the manager first, then assign customers and groups to them.
- **Administrator**: gives organization-wide administrative access; grant sparingly.

Search the account list by name or email. Use the KYC review selector to track **Not started**, **Pending**, **Verified**, or **Rejected**. This is a status field, not a document-verification or KYC provider integration. **Deactivate** prevents access; **Reactivate** restores access.

### 4.3 Review and decide loan applications

Open **Loan accounts** or the dashboard's pending-review link. Search by borrower or product and review the principal, product terms, cadence, next-installment estimate, affordability ratio, and credit-check indicator.

For a pending application, verify the required supporting evidence and policy outside the sandbox before making any real-world decision. The **Approve** control remains visible but disabled until its prerequisites are met; the adjacent message explains what is blocking approval:

1. The borrower must provide consent and create the application's credit-check record (see the customer workflow).
2. The application must pass the product's debt-to-income affordability limit.
3. Select **Approve** only when authorized and all lender checks are complete. An application over the configured affordability limit cannot be approved.
4. Select **Decline** to reject it; enter a reason when prompted.
5. For an approved application in a non-production environment, **Disburse** records a sandbox disbursement and creates the repayment schedule. It does not transfer funds.

If consent or a credit check is missing, the borrower must sign in and submit **Consent + check** for that application; staff cannot provide consent on the borrower's behalf. When an application passes affordability but has no usable bureau check, an administrator may choose **Approve without bureau check** and must provide a reason. This override is recorded in the audit trail and does not bypass the affordability limit. Live disbursement is not configured in production.

The lifecycle shown in the loan list includes pending approval, approved, active, and rejected states. The repayment schedule is generated at disbursement using the product's reducing-balance policy.

### 4.4 Manage groups, servicing, and oversight

- In **JLG groups**, create a group with a name, center, optional meeting day, a field manager, and 2–30 customers. Activate or deactivate a group as its operational use changes.
- In **Collections**, review organization-scope receipts. Administrators can record collections just like field managers.
- In **Portfolio reports**, review outstanding principal, PAR 30/60/90+ values, monthly collections, and loan status charts.
- In **Audit trail**, review the latest 100 operational events, their actor, affected record, metadata, and recorded time.

The dashboard shows upcoming installment reminders during the seven days before payment and red overdue warnings after the due date. Warnings follow the same customer/field-manager/administrator access scope as the rest of the dashboard.

### 4.5 Record business expenses, payroll, and customer documents

- In **Expenses**, record each business cost with a category, INR amount, date, payee, optional notes, and optional receipt storage key. Store receipts in private external storage first; Mitra records the key but does not upload or serve the file.
- In **Payroll**, choose an active director or field manager/collection agent, define the pay period, and enter earnings and deductions as one `Label, amount` line per component. New records are drafts. Review the monthly gross, deductions, and net report, then mark a draft paid only after payment is handled through your approved payment process. This action records status only and does not transfer funds. Payroll records are unique per staff member and period.
- In **Customer documents**, choose a customer, enter a document name and category, choose a PDF/JPEG/PNG file up to 10 MB, then select **Upload document**. Mitra verifies the file's content signature and uploads it to Cloudinary with authenticated delivery. Downloads pass through an access-checked application route that issues a short-lived Cloudinary link. Removing a document also deletes its Cloudinary asset. Configure the three `CLOUDINARY_*` server environment variables before using this workflow; keep the API secret private.

## 5. Field manager workflows

### 5.1 Set up your assigned customers

Open **Customers** to see only customers assigned to you. Use **Add a customer** to create an account with their name, email, optional phone, and a temporary password of at least 12 characters. Customers created by a field manager are assigned to that manager. Field managers cannot create organization-administrator or field-manager accounts, reassign customers, or manage accounts outside their scope.

Use the KYC review selector to track operational status and deactivate/reactivate a customer account when authorized. The selector records a status only; it does not verify identity documents.

### 5.2 Create a JLG group

In **JLG groups**, choose **New group**, enter a group name and center, optionally choose a meeting day, and select 2–30 customers in your access scope. Create the group, then use its status action to deactivate or reactivate it. An administrator assigns field managers when creating groups; a field manager creates groups within their own scope.

### 5.3 Submit a customer's loan application

Open **Loan accounts**, expand **Create a loan application**, and choose the customer, active product, principal, term, and (optionally) a JLG group. Enter the customer's self-declared monthly household income and outside monthly debt. Submit to create a pending application.

The affordability calculation also includes estimated payments on this organization's active loans. Confirm income, debts, product eligibility, and required documentation using your approved operating procedures; these form fields are self-declared and are not independently verified by Mitra.

### 5.4 Record a field collection

In **Collections**, choose an active loan account with a due installment. Enter the amount actually received, select **Cash**, **UPI**, or **Bank transfer**, and optionally enter the external payment reference. Select **Record collection** once, then verify the success message and receipt code.

Mitra applies the collection to due installments in date order and records the allocation. Open the receipt link to check the borrower, amount, date/time, channel, reference, and principal/interest/penalty allocation; use **Print receipt** to print or save a print-to-PDF copy. If no due installment is available, the collection form is disabled. Do not use the receipt as proof of bank settlement.

### 5.5 Review your portfolio

The dashboard shows your scoped portfolio and recent accounts. **Portfolio reports** provides scoped outstanding principal, PAR aging, loan status, and monthly collection charts. These are operational views; review exceptions and follow the organization's escalation policy.

## 6. Customer workflows

### 6.1 View your account

After sign-in, use **Overview** for your own portfolio summary, **Loan accounts** for your own applications/loans, and **Collections** to review receipts in your access scope. Customer access is limited to their own account; customers do not see team, customer-management, group-management, report, product, or audit administration screens.

### 6.2 Apply for a loan

In **Loan accounts**, expand **Create a loan application**. Select an available active product, enter the requested principal and term, and provide self-declared monthly household income and other monthly debt. Submit the application and review its status in the loan list.

The system computes an affordability indicator using the selected product's debt-to-income ceiling, your submitted figures, and estimated payments on your other active loans with this organization. An application that exceeds the limit is held from approval. The calculation is an intake safeguard, not a credit-bureau decision.

### 6.3 Give consent for the sandbox credit inquiry

For a pending application that needs a check, select **Consent + check** on that application. Only the borrower can submit this explicit consent. Mitra records the consent and a sandbox inquiry against the application. The result is not connected to CIBIL, Equifax, Experian, or CRIF High Mark and is not a bureau report or a real credit decision. Contact your lender for an approved live credit-check process.

### 6.4 Review collections and change your profile

Open **Collections** to follow recorded receipts. Open a receipt to inspect its installment allocation and print a copy. To change your contact information or password, use **Account settings**. The email used to sign in cannot be changed from this screen.

### 6.5 Keep your document references

Open **Customer documents** to upload and view your PDF, JPEG, or PNG files (up to 10 MB). Documents are kept in private Cloudinary storage. Download requires signing in and being the customer or an authorized organization administrator/assigned field manager. Removing a record deletes the Cloudinary file as well.

## 7. Shared loan and collection lifecycle

1. An administrator activates a product and authorized staff provision the borrower.
2. A customer submits an application for themselves, or a field manager/administrator submits one for an assigned/in-scope customer.
3. Mitra validates product bounds and calculates an affordability ratio from self-declared income/debt plus this organization's active obligations.
4. The application waits for review. The borrower records explicit consent for the sandbox inquiry.
5. An administrator may approve only after the recorded consent/check and a passed affordability gate. The administrator may decline a pending application with a reason.
6. In non-production, an administrator can run sandbox disbursement on an approved application. Mitra creates the reducing-balance schedule and marks the loan active; no money moves.
7. A field manager or administrator records collections against an active loan. Mitra allocates the received amount to due installments by date, and a receipt is available for printing.
8. Dashboard/report metrics and audit entries update as servicing actions are recorded.

Do not treat sandbox checks or sandbox disbursements as completed production lending operations.

## 8. Dashboard, reports, receipts, and audit

### Dashboard and charts

The dashboard summarizes the records within the signed-in user's role scope: portfolio outstanding, collections this month, customers, overdue installments, recent loans, and collection/status charts. Administrators also see a shortcut to pending approvals when that queue is non-empty.

### PAR and NPA proxy

PAR 30, PAR 60, and PAR 90+ show outstanding principal in active accounts with at least one unpaid installment at the corresponding delinquency age. PAR 90+ is an operational NPA proxy only. It is not a statutory RBI/NBFC-MFI classification, provisioning result, or regulatory report.

### Receipts

A receipt confirms that Mitra recorded a collection and shows how it was allocated. It does not confirm bank settlement or payment-rail reconciliation. Keep receipts according to the organization's retention and customer-disclosure policies.

### Audit trail

Administrators can review the latest 100 recorded operational events. Application audit rows are append-only through the application model and written transactionally with supported mutations. They are not tamper-proof against direct database administrators; production audit immutability needs separately governed storage, backups, and retention controls.

## 9. Important operating limits

- **Credit bureau:** the current adapter is sandbox-only. It produces no bureau report and must not support real lending decisions.
- **Disbursement:** sandbox disbursement records no transfer. Live disbursement is not configured; the application disables sandbox disbursement in production.
- **Collections:** field capture requires connectivity. The notification adapter is sandbox-only; SMS, payment rails, offline synchronization, and Bluetooth printers are not enabled.
- **Affordability:** income and external debt are self-declared; this is not bureau verification or a substitute for underwriting.
- **Penalties:** product late charges/grace periods are configuration inputs. Confirm legal basis, disclosures, accounting, caps, and collection allocation policy before use.
- **Compliance:** lender-specific privacy/consent, KYC/AML, RBI/NBFC-MFI, data-locality, provisioning, and reporting obligations require qualified compliance review. Mitra is not a compliance certification.
- **Transactions:** the application requires a transaction-capable MongoDB replica set or deployment for supported mutations and audit events.

## 10. Troubleshooting

| Symptom | What to check |
| --- | --- |
| Sign-in page will not load | Confirm the Mitra server is running and open the origin configured in `NEXTAUTH_URL`. Do not assume another application on the default port is Mitra. |
| Credentials are rejected | Check the email, password, and account activation status with the administrator. A password change requires the current password. |
| Data/API request fails | Check the MongoDB connection and server logs. Application mutations require MongoDB transactions. |
| No loan product appears | Ask an administrator to create and activate a product within the requested amount/term bounds. |
| Application cannot be approved | Check the affordability hold and whether the borrower has recorded consent/check. Sandbox output is not valid for a real lending decision. |
| Collection form has no loan choice | There may be no active loan with an installment currently due, or the loan may be outside your role scope. |
| Customer/group is not visible | Verify that the customer is assigned to the signed-in field manager and is in the correct group/role scope. |
| Cannot reach bureau, SMS, or payment service | Those integrations are not live in this version; contact the organization administrator about an approved provider rollout. |

For unresolved issues, capture the page, action, timestamp, and any non-sensitive error message for your administrator. Do not include passwords, session cookies, or database credentials in support reports.
