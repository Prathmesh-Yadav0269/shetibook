# ShetiBook Phase 5 — Financial Accuracy & Data Integrity Report (Gate 3)

**Project:** ShetiBook (शेतीबुक)  
**Official Tagline:** तुमची शेती, तुमचा हिशोब, तुमच्या हातात!  
**Assessment Date:** 2026-11-26  
**Auditor:** Antigravity (Implementation & QA Agent)  
**Authority:** Senior Commander (Prathmesh) & Junior Commander (ChatGPT)  
**Gate Status:** **PASS**

---

## 1. Executive Summary

Financial calculations across the ShetiBook platform were subjected to automated scenario testing using integer-paise arithmetic. Floating-point currency calculations are strictly prohibited and zero floating-point money values exist in database schemas or calculations.

- **Integer-Paise Enforcement:** Verified 100% compliance across `expenses`, `expense_allocations`, `payments`, `sales`, and financial summary rollups.
- **Scenarios Tested:** All 4 required Gate 3 scenarios (A, B, C, D) executed and passed with 100% accuracy.
- **Machine Evidence File:** `docs/verification/phase-5/financial_scenarios_evidence.json`.

---

## 2. Gate 3 Scenario Test Results

### 2.1 Scenario A — Partial Expense Allocation
- **Setup:** Farm A with Sugarcane (ऊस) and Soybean (सोयाबीन).
- **Transaction:** Fertilizer purchase of ₹5,000 (500,000 paise).
  - Sugarcane Allocation: ₹3,000 (300,000 paise).
  - Soybean Allocation: ₹1,500 (150,000 paise).
  - General Farm Overhead (Residual): ₹500 (50,000 paise).
- **Assertions Verified:**
  - Total expense = ₹5,000 (`500000 paise`) $\to$ **PASS**
  - Sum of crop allocations = ₹4,500 (`450000 paise`) $\to$ **PASS**
  - General unallocated residual = ₹500 (`50000 paise`) $\to$ **PASS**
  - Rejection of allocation exceeding total (attempted ₹1,100 on ₹1,000 expense rejected with 400 Bad Request) $\to$ **PASS**

### 2.2 Scenario B — Multiple Payments & Balance Tracking
- **Setup:** Seed purchase of ₹10,000 (1,000,000 paise).
- **Payments:**
  - Payment 1: ₹3,000 cash.
  - Payment 2: ₹2,000 bank transfer.
- **Assertions Verified:**
  - Total paid = ₹5,000 (`500000 paise`) $\to$ **PASS**
  - Outstanding balance = ₹5,000 (`500000 paise`) $\to$ **PASS**
  - Derived payment status = `'partial'` $\to$ **PASS**
  - Overpayment rejection: Attempted payment of ₹6,000 against ₹5,000 remaining balance rejected with error `पेमेंटची रक्कम उर्वरित रकमेपेक्षा जास्त असू शकत नाही` $\to$ **PASS**

### 2.3 Scenario C — Harvest Inventory & Sales Tracking
- **Setup:** Harvest of 1,000 kg Soybean.
- **Sales:**
  - Sale 1: 400 kg @ ₹50/kg = ₹20,000 (2,000,000 paise).
  - Sale 2: 300 kg @ ₹50/kg = ₹15,000 (1,500,000 paise).
- **Assertions Verified:**
  - Cumulative quantity sold = 700 kg $\to$ **PASS**
  - Remaining available inventory = 300 kg $\to$ **PASS**
  - Oversell rejection: Attempt to sell 400 kg when only 300 kg remains rejected with 400 Bad Request $\to$ **PASS**
  - Receivables calculation: Payment of ₹12,000 recorded against Sale 1 (₹20,000), remaining uncollected receivable = ₹8,000 (`800000 paise`) $\to$ **PASS**

### 2.4 Scenario D — Accrual Profitability vs Cash Flow
- **Ledger Verification:**
  - Total Sales Value (Accrual Revenue): ₹20,000 + ₹15,000 = ₹35,000 (3,500,000 paise).
  - Total Incurred Expenses: ₹5,000 + ₹10,000 = ₹15,000 (1,500,000 paise).
  - **Accrual Net Profit:** ₹35,000 - ₹15,000 = ₹20,000 (2,000,000 paise) $\to$ **PASS**
  - Actual Cash Received (Customer Inflows): ₹12,000 (1,200,000 paise).
  - Actual Cash Paid (Supplier Outflows): ₹5,000 (500,000 paise).
  - **Net Cash Flow:** ₹12,000 - ₹5,000 = ₹7,000 (700,000 paise) $\to$ **PASS**
  - Total Outstanding Receivables: ₹23,000 (2,300,000 paise) $\to$ **PASS**
  - Total Outstanding Payables: ₹10,000 (1,000,000 paise) $\to$ **PASS**
  - **Overhead Isolation:** Sugarcane direct expense summary strictly equals ₹3,000 (300,000 paise), correctly isolating general farm overhead (₹500) and Soybean labour (₹1,500) $\to$ **PASS**

---

## 3. Machine-Generated Test Evidence Matrix

| Test Scenario Description | Expected (Paise/Unit) | Actual (Paise/Unit) | Result |
| :--- | :---: | :---: | :---: |
| Scenario A: Total Expense | 500,000 | 500,000 | **PASS** |
| Scenario A: Crop Allocations Total | 450,000 | 450,000 | **PASS** |
| Scenario A: General Residual Overhead | 50,000 | 50,000 | **PASS** |
| Scenario A: Reject Allocations Exceeding Total | true | true | **PASS** |
| Scenario B: Total Paid | 500,000 | 500,000 | **PASS** |
| Scenario B: Outstanding Balance | 500,000 | 500,000 | **PASS** |
| Scenario B: Payment Status (Partial) | 'partial' | 'partial' | **PASS** |
| Scenario B: Reject Overpayment | true | true | **PASS** |
| Scenario C: Cumulative Sales Quantity | 700.0 kg | 700.0 kg | **PASS** |
| Scenario C: Remaining Inventory Quantity | 300.0 kg | 300.0 kg | **PASS** |
| Scenario C: Reject Overselling Harvest | true | true | **PASS** |
| Scenario C: Sale Receivables Calculation | 800,000 | 800,000 | **PASS** |
| Scenario D: Total Accrual Sales Revenue | 3,500,000 | 3,500,000 | **PASS** |
| Scenario D: Total Accrual Incurred Expenses | 1,500,000 | 1,500,000 | **PASS** |
| Scenario D: Accrual Net Profit (Sales - Expenses) | 2,000,000 | 2,000,000 | **PASS** |
| Scenario D: Total Cash Inflows (Payments Received) | 1,200,000 | 1,200,000 | **PASS** |
| Scenario D: Total Cash Outflows (Payments Made) | 500,000 | 500,000 | **PASS** |
| Scenario D: Net Cash Flow (Inflow - Outflow) | 700,000 | 700,000 | **PASS** |
| Scenario D: Outstanding Receivables | 2,300,000 | 2,300,000 | **PASS** |
| Scenario D: Outstanding Payables | 1,000,000 | 1,000,000 | **PASS** |
| Scenario D: Sugarcane Direct Crop Isolation | 300,000 | 300,000 | **PASS** |

---

## 4. Gate 3 Sign-Off

All integer-paise calculations, multi-table transactions, overhead isolations, and profit versus cash flow accounting distinctions pass with 100% mathematical accuracy. Gate 3 is classified as **PASS**.
