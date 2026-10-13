import { test, expect } from "@playwright/test";

/**
 * Stage 7B.7: Playwright Browser End-to-End Testing Suite
 *
 * Runs in serial to ensure shared, isolated lifecycle state:
 * 1. Authentication & Role-Based Navigation (Admin -> /admin, Issuer -> /issuer, Student -> /student)
 * 2. Protected Routes & Access Control (401 redirect to /login, 403 Access Denied)
 * 3. Issuance form validation & credential creation by authorized Issuer
 * 4. Student Vault isolation & inspection of claims and cryptographic proof
 * 5. QR modal generation & copy URL action
 * 6. Public verification portal (/verify?id=... and raw JSON) & privacy preservation
 * 7. Tamper rejection in verification portal
 * 8. On-chain / authoritative revocation by Issuer with documented reason
 * 9. Post-revocation verification (CREDENTIAL_REVOKED) & vault status reflection
 * 10. Logout & session cleanup
 *
 * CONSTRAINTS:
 * - Uses newly generated isolated test accounts and credentials.
 * - Never modifies or revokes the existing Alice demo credential.
 * - Captures screenshots on failure automatically.
 */

test.describe.serial("Stage 7B.7: VeriCred Full Browser E2E Lifecycle", () => {
  let testStudentEmail = "";
  let testStudentName = "";
  const testStudentPassword = "StudentPass123!";
  let testCredentialTitle = "";
  let issuedCredentialId = "";

  test.beforeAll(() => {
    const timestamp = Date.now();
    testStudentEmail = `e2e_student_${timestamp}@test.edu`;
    testStudentName = `E2E Student ${timestamp}`;
    testCredentialTitle = `Bachelor of Science in Distributed Systems ${timestamp}`;
  });

  // Capture console errors for diagnostics
  test.beforeEach(async ({ page }) => {
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        console.log(`[Browser Console Error] ${msg.text()}`);
      }
    });
  });

  // --------------------------------------------------------------------------
  // 1. Authentication & Role-Based Navigation
  // --------------------------------------------------------------------------

  test("1.1 should display login page and reject invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle(/VeriCred/i);

    // Verify form elements exist
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    // Fill invalid credentials
    await page.fill('input[type="email"]', "nonexistent@example.com");
    await page.fill('input[type="password"]', "WrongPassword999!");
    await page.click('button[type="submit"]');

    // Expect error alert
    const alert = page.locator(".alert.alert-danger");
    await expect(alert).toBeVisible({ timeout: 10000 });
  });

  test("1.2 should log in as ADMIN and navigate to /admin", async ({ page }) => {
    await page.goto("/login");

    await page.fill('input[type="email"]', "admin@credentialplatform.local");
    await page.fill('input[type="password"]', "AdminPass123!");
    await page.click('button[type="submit"]');

    // Should redirect to /admin
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.locator("h1")).toContainText(/Platform Governance/i);
    await expect(page.locator("text=Total Registered Users")).toBeVisible();
  });

  test("1.3 should log in as ISSUER and navigate to /issuer", async ({ page }) => {
    await page.goto("/login");

    await page.fill('input[type="email"]', "registrar@university.edu");
    await page.fill('input[type="password"]', "Password123!");
    await page.click('button[type="submit"]');

    // Should redirect to /issuer
    await expect(page).toHaveURL(/\/issuer/);
    await expect(page.locator("h1")).toContainText(/Academic Credential Issuance/i);
    await expect(page.locator("#credTitle")).toBeVisible();
  });

  test("1.4 should register a new isolated student account and land in /student vault", async ({ page }) => {
    await page.goto("/register");

    await page.fill("#name", testStudentName);
    await page.fill("#email", testStudentEmail);
    await page.selectOption("#role", "HOLDER");
    await page.fill("#password", testStudentPassword);

    await page.click('button[type="submit"]');

    // Newly registered HOLDER should navigate to /student
    await expect(page).toHaveURL(/\/student/);
    await expect(page.locator("h1")).toContainText(/Student Credential Vault/i);
    // Vault should initially be empty for this new student
    await expect(page.locator("text=No Credentials in Your Vault")).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // 2. Access Control & Protected Routes (401 & 403)
  // --------------------------------------------------------------------------

  test("2.1 should redirect unauthenticated requests to /login", async ({ page }) => {
    // Clear storage to ensure unauthenticated state
    await page.goto("/login");
    await page.evaluate(() => localStorage.clear());

    // Try navigating to protected routes
    await page.goto("/issuer");
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/student");
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("2.2 should display 403 Access Denied when student visits restricted /issuer", async ({ page }) => {
    // Log in as our newly registered student
    await page.goto("/login");
    await page.fill('input[type="email"]', testStudentEmail);
    await page.fill('input[type="password"]', testStudentPassword);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/student/);

    // Attempt direct navigation to /issuer
    await page.goto("/issuer");

    // Must display 403 Access Denied
    const alert = page.locator(".alert.alert-danger");
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/403 - Access Denied/i);
    await expect(alert).toContainText(/Your account role \(HOLDER\) is not authorized/i);

    // Workspace form must NOT be rendered
    await expect(page.locator("#credTitle")).not.toBeVisible();
  });

  // --------------------------------------------------------------------------
  // 3. Credential Issuance by Authorized Issuer
  // --------------------------------------------------------------------------

  test("3.1 should allow authorized ISSUER to issue, digitally sign, and anchor credential", async ({ page }) => {
    // Log in as Issuer
    await page.goto("/login");
    await page.fill('input[type="email"]', "registrar@university.edu");
    await page.fill('input[type="password"]', "Password123!");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/issuer/);

    // Fill issuance form for the isolated test student
    await page.fill("#credTitle", testCredentialTitle);
    await page.fill("#studentName", testStudentName);
    await page.fill("#studentEmail", testStudentEmail);
    await page.fill("#majorField", "Distributed Systems & Cryptography");
    await page.fill("#gpaField", "3.95");
    await page.fill("#gradYear", "2026");

    // Submit issuance
    await page.click('button[type="submit"]:has-text("Issue & Digitally Sign Credential")');

    // Verify success banner appears
    const successAlert = page.locator(".alert.alert-success");
    await expect(successAlert).toBeVisible({ timeout: 20000 });
    await expect(successAlert).toContainText(new RegExp(`Successfully issued and signed credential for ${testStudentName}`, "i"));

    // Find the newly issued credential row in the registry table
    const table = page.locator(".data-table tbody");
    await expect(table).toBeVisible();

    const newCredRow = table.locator("tr").filter({ hasText: testCredentialTitle });
    await expect(newCredRow).toBeVisible();

    // Extract the Credential ID
    const credIdCell = newCredRow.locator("td.font-mono");
    issuedCredentialId = (await credIdCell.textContent()).trim();
    expect(issuedCredentialId).toMatch(/^urn:uuid:[0-9a-f-]+$/);
    console.log(`[E2E] Successfully issued test credential ID: ${issuedCredentialId}`);
  });

  // --------------------------------------------------------------------------
  // 4. Student Vault Isolation & Custody
  // --------------------------------------------------------------------------

  test("4.1 should display the newly issued credential in the recipient student vault", async ({ page }) => {
    expect(issuedCredentialId).toBeTruthy();

    // Log in as the recipient test student
    await page.goto("/login");
    await page.fill('input[type="email"]', testStudentEmail);
    await page.fill('input[type="password"]', testStudentPassword);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/student/);

    // Check that empty state is gone and the credential card is rendered
    await expect(page.locator("text=No Credentials in Your Vault")).not.toBeVisible();

    const credCard = page.locator(".card").filter({ hasText: testCredentialTitle });
    await expect(credCard).toBeVisible();
    await expect(credCard).toContainText(testStudentName);
    await expect(credCard).toContainText(issuedCredentialId);

    // Verify StatusBadge is Active / Issued
    const badge = credCard.locator(".badge-success");
    await expect(badge).toBeVisible();
    await expect(badge).toContainText(/Active \/ Issued/i);
  });

  test("4.2 should allow student to inspect claims and ECDSA cryptographic proof", async ({ page }) => {
    // Log in as student
    await page.goto("/login");
    await page.fill('input[type="email"]', testStudentEmail);
    await page.fill('input[type="password"]', testStudentPassword);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/student/);

    const credCard = page.locator(".card").filter({ hasText: testCredentialTitle });
    await credCard.locator('button:has-text("Inspect")').click();

    // Modal should be visible
    const modal = page.locator(".modal-overlay");
    await expect(modal).toBeVisible();
    await expect(modal.locator("h3")).toContainText(/Verifiable Credential Claims & Proof/i);

    // Inspect claims preformatted content
    const claimsPre = modal.locator("pre").first();
    await expect(claimsPre).toContainText(/Distributed Systems & Cryptography/i);
    await expect(claimsPre).toContainText(/3.95/i);

    // Close modal
    await modal.locator('button:has-text("Close")').click();
    await expect(modal).not.toBeVisible();
  });

  // --------------------------------------------------------------------------
  // 5. QR Code Generation & Verification Deep-Link
  // --------------------------------------------------------------------------

  test("5.1 should render QR code modal in student vault with correct deep-link", async ({ page }) => {
    // Log in as student
    await page.goto("/login");
    await page.fill('input[type="email"]', testStudentEmail);
    await page.fill('input[type="password"]', testStudentPassword);
    await page.click('button[type="submit"]');

    const credCard = page.locator(".card").filter({ hasText: testCredentialTitle });
    await credCard.locator('button:has-text("Share QR")').click();

    const modal = page.locator(".modal-overlay");
    await expect(modal).toBeVisible();
    await expect(modal.locator("h3")).toContainText(/Share Verifiable Credential QR/i);

    // QR SVG element (role="img") should be rendered
    const qrSvg = modal.locator('svg[role="img"]');
    await expect(qrSvg).toBeVisible();

    // Verify copy button exists and functions
    const copyButton = modal.locator('button:has-text("Copy Verification URL")');
    await expect(copyButton).toBeVisible();
    await copyButton.click();

    // Button text should temporarily toggle to Link Copied!
    await expect(modal.locator("text=Link Copied!")).toBeVisible();

    // Close modal
    await modal.locator('button:has-text("Done")').click();
    await expect(modal).not.toBeVisible();
  });

  // --------------------------------------------------------------------------
  // 6. Public Verification Portal (ID & JSON)
  // --------------------------------------------------------------------------

  test("6.1 should verify authentic credential anonymously via query ID", async ({ page }) => {
    expect(issuedCredentialId).toBeTruthy();

    // Clear session to ensure completely public/anonymous verification
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());

    // Navigate to deep-link verification portal URL
    await page.goto(`/verify?id=${encodeURIComponent(issuedCredentialId)}`);

    // Verify automatic verification execution
    const verdictBanner = page.locator("text=Credential is Authentic & Valid");
    await expect(verdictBanner).toBeVisible({ timeout: 15000 });

    // Verify all 4 audit checks display green success badges
    await expect(page.locator(".badge-success:has-text('Valid Signature')")).toBeVisible();
    await expect(page.locator(".badge-success:has-text('Tamper-Proof Match')")).toBeVisible();
    await expect(page.locator(".badge-success:has-text('Approved Issuer')")).toBeVisible();
    await expect(page.locator(".badge-success:has-text('Active & Unrevoked')")).toBeVisible();

    // Privacy preservation check: Student PII (GPA, major, email) should NOT be exposed in verification audit
    const resultCard = page.locator(".card").last();
    await expect(resultCard).not.toContainText("3.95");
    await expect(resultCard).not.toContainText("Distributed Systems & Cryptography");
  });

  test("6.2 should reject tampered JSON payload in raw verification mode", async ({ page }) => {
    await page.goto("/verify");

    // Switch to Raw JSON tab
    await page.click('button:has-text("Verify by Raw JSON Payload")');
    await expect(page.locator("#jsonArea")).toBeVisible();

    // Construct tampered payload
    const tamperedPayload = {
      "@context": ["https://www.w3.org/2018/credentials/v1"],
      id: "urn:uuid:tampered-credential-id",
      type: ["VerifiableCredential"],
      issuer: {
        id: "did:ethr:0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
        name: "State University of Technology",
        ethereumAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      },
      credentialSubject: {
        name: "Tampered Name",
        degree: "Forged Ph.D.",
      },
      proof: {
        type: "EcdsaSecp256k1Signature2019",
        proofValue: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      },
    };

    await page.fill("#jsonArea", JSON.stringify(tamperedPayload, null, 2));
    await page.click('button[type="submit"]:has-text("Verify Credential Integrity")');

    // Verdict must be Verification Failed
    const failureBanner = page.locator("text=Verification Failed");
    await expect(failureBanner).toBeVisible({ timeout: 15000 });

    // Signature must be flagged as Invalid / Corrupt
    await expect(page.locator(".badge-danger:has-text('Invalid / Corrupt')")).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // 7. Revocation Lifecycle & Post-Revocation Reflection
  // --------------------------------------------------------------------------

  test("7.1 should allow authorized ISSUER to revoke the credential with documented reason", async ({ page }) => {
    expect(issuedCredentialId).toBeTruthy();

    // Log in as Issuer
    await page.goto("/login");
    await page.fill('input[type="email"]', "registrar@university.edu");
    await page.fill('input[type="password"]', "Password123!");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/issuer/);

    // Locate the newly issued credential row
    const row = page.locator(".data-table tbody tr").filter({ hasText: testCredentialTitle });
    await expect(row).toBeVisible();

    // Click Revoke button
    const revokeBtn = row.locator('button:has-text("Revoke")');
    await expect(revokeBtn).toBeVisible();
    await revokeBtn.click();

    // Revocation modal opens
    const modal = page.locator(".modal-overlay");
    await expect(modal).toBeVisible();
    await expect(modal.locator("h3")).toContainText(/Confirm Credential Revocation/i);

    // Fill reason
    await modal.locator("#reasonInput").fill("Revoked during Stage 7B.7 automated testing audit");
    await modal.locator('button[type="submit"]:has-text("Confirm & Revoke")').click();

    // Success alert should confirm revocation
    const successAlert = page.locator(".alert.alert-success");
    await expect(successAlert).toBeVisible({ timeout: 20000 });
    await expect(successAlert).toContainText(/has been revoked/i);

    // Revoke button should now be gone from that row
    await expect(row.locator('button:has-text("Revoke")')).not.toBeVisible();
  });

  test("7.2 should report CREDENTIAL_REVOKED at public /verify endpoint after revocation", async ({ page }) => {
    expect(issuedCredentialId).toBeTruthy();

    // Navigate anonymously to verification portal
    await page.goto(`/verify?id=${encodeURIComponent(issuedCredentialId)}`);

    // Verdict banner must be Verification Failed
    await expect(page.locator("text=Verification Failed")).toBeVisible({ timeout: 15000 });

    // Both Revocation Check and Smart Contract Status badges must display Revoked
    const revokedBadges = page.locator(".badge-danger:has-text('Revoked')");
    await expect(revokedBadges.first()).toBeVisible();
    await expect(revokedBadges).toHaveCount(2);
  });

  test("7.3 should reflect updated REVOKED status badge in student vault", async ({ page }) => {
    // Log in as recipient student
    await page.goto("/login");
    await page.fill('input[type="email"]', testStudentEmail);
    await page.fill('input[type="password"]', testStudentPassword);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/student/);

    const credCard = page.locator(".card").filter({ hasText: testCredentialTitle });
    await expect(credCard).toBeVisible();

    // Status badge on the card should now be Revoked (badge-danger)
    const revokedBadge = credCard.locator(".badge-danger:has-text('Revoked')");
    await expect(revokedBadge).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // 8. Logout & Session Termination
  // --------------------------------------------------------------------------

  test("8.1 should log out user and clear stored tokens", async ({ page }) => {
    // Log in
    await page.goto("/login");
    await page.fill('input[type="email"]', testStudentEmail);
    await page.fill('input[type="password"]', testStudentPassword);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/student/);

    // Click Logout in Navbar
    await page.locator('button:has-text("Logout")').click();

    // Should redirect to /login
    await expect(page).toHaveURL(/\/login/);

    // Verify localStorage auth tokens are cleared
    const token = await page.evaluate(() => localStorage.getItem("auth_token"));
    const user = await page.evaluate(() => localStorage.getItem("auth_user"));
    expect(token).toBeNull();
    expect(user).toBeNull();
  });
});
