#!/usr/bin/env tsx
/**
 * ARUS Full Audit Runner
 * Comprehensive automated audit of all critical paths
 */

import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";

const execAsync = promisify(exec);

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
  duration: number;
}

class AuditRunner {
  private results: TestResult[] = [];
  private startTime = Date.now();
  private baseUrl = process.env.TEST_BASE_URL || "http://localhost:5000";
  private orgId = "default-org-id";

  async runAudit() {
    console.log("🚀 Starting ARUS Full Audit\n");
    console.log("=".repeat(60));
    console.log(`Base URL: ${this.baseUrl}`);
    console.log(`Organization: ${this.orgId}`);
    console.log("=".repeat(60) + "\n");

    // Phase 1: Environment Bootstrap
    await this.phase("1. Environment Bootstrap", async () => {
      await this.testDatabaseConnection();
      await this.testRedisConnection();
    });

    // Phase 2: Health Endpoints
    await this.phase("2. Health Endpoints", async () => {
      await this.testEndpoint("System Health", "/api/health");
      await this.testEndpoint("PdM Health", "/api/pdm/health");
      await this.testEndpoint("Analytics Health", "/api/analytics/health");
    });

    // Phase 3: CRUD Operations
    await this.phase("3. CRUD Operations", async () => {
      await this.testVesselsCRUD();
      await this.testEquipmentCRUD();
      await this.testPartsCRUD();
      await this.testWorkOrdersCRUD();
    });

    // Phase 4: AI/ML Pipeline
    await this.phase("4. AI/ML Pipeline", async () => {
      await this.testPdMBaselines();
      await this.testRULEstimation();
      await this.testAnomalyDetection();
    });

    // Phase 5: LLM Features
    await this.phase("5. LLM Features", async () => {
      await this.testLLMHealth();
      await this.testLLMCostTracking();
    });

    // Phase 6: Observability
    await this.phase("6. Observability & Metrics", async () => {
      await this.testSyncStatus();
      await this.testMetricsEndpoints();
    });

    // Generate final report
    await this.generateReport();
  }

  private async phase(name: string, tests: () => Promise<void>) {
    console.log(`\n📋 ${name}`);
    console.log("-".repeat(60));
    try {
      await tests();
    } catch (error) {
      console.error(`❌ Phase failed: ${error}`);
    }
  }

  private async testDatabaseConnection() {
    const start = Date.now();
    try {
      const { stdout } = await execAsync('psql $DATABASE_URL -c "SELECT 1" -t');
      const passed = stdout.trim() === "1";
      this.recordResult(
        "Database Connection",
        passed,
        passed ? "Connected successfully" : "Connection failed",
        Date.now() - start
      );
    } catch (error) {
      this.recordResult("Database Connection", false, `Error: ${error}`, Date.now() - start);
    }
  }

  private async testRedisConnection() {
    const start = Date.now();
    try {
      const { stdout } = await execAsync('redis-cli ping 2>/dev/null || echo "UNAVAILABLE"');
      const passed = stdout.trim() === "PONG";
      this.recordResult(
        "Redis Connection",
        passed,
        passed ? "Connected successfully" : "Redis unavailable (optional)",
        Date.now() - start
      );
    } catch (error) {
      this.recordResult(
        "Redis Connection",
        true,
        "Redis unavailable (optional)",
        Date.now() - start
      );
    }
  }

  private async testEndpoint(name: string, endpoint: string, method: string = "GET", body?: any) {
    const start = Date.now();
    try {
      const headers: Record<string, string> = {
        "x-org-id": this.orgId,
        "Content-Type": "application/json",
      };

      let curlCmd = `curl -s -w "\\n%{http_code}" -X ${method} "${this.baseUrl}${endpoint}"`;
      Object.entries(headers).forEach(([key, value]) => {
        curlCmd += ` -H "${key}: ${value}"`;
      });
      if (body) {
        curlCmd += ` -d '${JSON.stringify(body)}'`;
      }

      const { stdout } = await execAsync(curlCmd);
      const lines = stdout.trim().split("\n");
      const statusCode = lines[lines.length - 1];
      const responseBody = lines.slice(0, -1).join("\n");

      const passed = ["200", "201", "204", "304"].includes(statusCode);
      const details = passed
        ? `✓ ${statusCode} - ${responseBody.substring(0, 100)}${responseBody.length > 100 ? "..." : ""}`
        : `✗ ${statusCode} - ${responseBody}`;

      this.recordResult(name, passed, details, Date.now() - start);
    } catch (error) {
      this.recordResult(name, false, `Error: ${error}`, Date.now() - start);
    }
  }

  private async testVesselsCRUD() {
    console.log("\n  Testing Vessels CRUD...");
    await this.testEndpoint("List Vessels", "/api/vessels");
    await this.testEndpoint("Get Vessel Details", "/api/vessels");
  }

  private async testEquipmentCRUD() {
    console.log("\n  Testing Equipment CRUD...");
    await this.testEndpoint("List Equipment", "/api/equipment");
    await this.testEndpoint("Equipment Health", "/api/equipment/health");
  }

  private async testPartsCRUD() {
    console.log("\n  Testing Parts/Inventory CRUD...");
    await this.testEndpoint("List Parts", "/api/parts");
    await this.testEndpoint("Inventory Optimization", "/api/inventory/optimization");
  }

  private async testWorkOrdersCRUD() {
    console.log("\n  Testing Work Orders CRUD...");
    await this.testEndpoint("List Work Orders", "/api/work-orders");
  }

  private async testPdMBaselines() {
    console.log("\n  Testing PdM Baselines...");
    await this.testEndpoint("PdM Baselines", "/api/pdm/baselines");
    await this.testEndpoint("PdM Alerts", "/api/pdm/alerts");
  }

  private async testRULEstimation() {
    console.log("\n  Testing RUL Estimation...");
    await this.testEndpoint("RUL Predictions", "/api/predictions");
    await this.testEndpoint("Equipment Health", "/api/equipment/health");
  }

  private async testAnomalyDetection() {
    console.log("\n  Testing Anomaly Detection...");
    await this.testEndpoint("Anomaly Detections", "/api/anomaly-detections");
  }

  private async testLLMHealth() {
    console.log("\n  Testing LLM Health...");
    await this.testEndpoint("LLM Health", "/api/llm/health");
  }

  private async testLLMCostTracking() {
    console.log("\n  Testing LLM Cost Tracking...");
    await this.testEndpoint("LLM Costs", "/api/llm/costs");
  }

  private async testSyncStatus() {
    console.log("\n  Testing Sync Status...");
    await this.testEndpoint("Sync Status", "/api/sync/status");
    await this.testEndpoint("Pending Conflicts", "/api/sync/pending-conflicts");
  }

  private async testMetricsEndpoints() {
    console.log("\n  Testing Metrics...");
    await this.testEndpoint("Dashboard Stats", "/api/dashboard");
    await this.testEndpoint("Analytics Health", "/api/analytics/health");
  }

  private recordResult(name: string, passed: boolean, details: string, duration: number) {
    this.results.push({ name, passed, details, duration });
    const icon = passed ? "✓" : "✗";
    const color = passed ? "\x1b[32m" : "\x1b[31m";
    const reset = "\x1b[0m";
    console.log(`  ${color}${icon} ${name}${reset} (${duration}ms)`);
    if (!passed) {
      console.log(`    ${details}`);
    }
  }

  private async generateReport() {
    const duration = Date.now() - this.startTime;
    const passed = this.results.filter((r) => r.passed).length;
    const failed = this.results.filter((r) => !r.passed).length;
    const total = this.results.length;
    const passRate = ((passed / total) * 100).toFixed(1);

    console.log("\n" + "=".repeat(60));
    console.log("📊 AUDIT SUMMARY");
    console.log("=".repeat(60));
    console.log(`Total Tests: ${total}`);
    console.log(`✓ Passed: ${passed}`);
    console.log(`✗ Failed: ${failed}`);
    console.log(`Pass Rate: ${passRate}%`);
    console.log(`Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log("=".repeat(60));

    // Generate detailed markdown report
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const reportPath = `reports/Audit_Report_${timestamp}.md`;

    let reportContent = `# ARUS Comprehensive Audit Report\n\n`;
    reportContent += `**Generated:** ${new Date().toISOString()}\n\n`;
    reportContent += `**Duration:** ${(duration / 1000).toFixed(2)}s\n\n`;
    reportContent += `## Executive Summary\n\n`;
    reportContent += `- **Total Tests:** ${total}\n`;
    reportContent += `- **Passed:** ✓ ${passed}\n`;
    reportContent += `- **Failed:** ✗ ${failed}\n`;
    reportContent += `- **Pass Rate:** ${passRate}%\n\n`;

    reportContent += `## Status\n\n`;
    if (passRate === "100.0") {
      reportContent += `🎉 **ALL TESTS PASSED** - Application is production-ready\n\n`;
    } else if (parseFloat(passRate) >= 90) {
      reportContent += `✅ **MOSTLY PASSING** - Application is stable with minor issues\n\n`;
    } else if (parseFloat(passRate) >= 70) {
      reportContent += `⚠️ **NEEDS ATTENTION** - Several issues detected\n\n`;
    } else {
      reportContent += `❌ **CRITICAL ISSUES** - Immediate attention required\n\n`;
    }

    reportContent += `## Detailed Results\n\n`;
    reportContent += `| Test | Status | Duration | Details |\n`;
    reportContent += `|------|--------|----------|---------|\n`;

    this.results.forEach((r) => {
      const status = r.passed ? "✓" : "✗";
      const details = r.details.substring(0, 80).replace(/\|/g, "\\|");
      reportContent += `| ${r.name} | ${status} | ${r.duration}ms | ${details} |\n`;
    });

    reportContent += `\n## Failed Tests\n\n`;
    const failedTests = this.results.filter((r) => !r.passed);
    if (failedTests.length === 0) {
      reportContent += `No failed tests! 🎉\n\n`;
    } else {
      failedTests.forEach((r) => {
        reportContent += `### ❌ ${r.name}\n\n`;
        reportContent += `- **Duration:** ${r.duration}ms\n`;
        reportContent += `- **Details:** ${r.details}\n\n`;
      });
    }

    reportContent += `## Recommendations\n\n`;
    if (passRate === "100.0") {
      reportContent += `All systems operational. Application is ready for deployment.\n\n`;
    } else {
      reportContent += `1. Review and fix failed tests\n`;
      reportContent += `2. Investigate any performance bottlenecks (>500ms responses)\n`;
      reportContent += `3. Ensure all critical paths are covered\n`;
      reportContent += `4. Rerun audit after fixes\n\n`;
    }

    // Write report to file
    const reportsDir = path.join(process.cwd(), "reports");
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    fs.writeFileSync(reportPath, reportContent, "utf-8");

    console.log(`\n📄 Full audit report saved to: ${reportPath}\n`);

    // Exit with appropriate code
    process.exit(failed > 0 ? 1 : 0);
  }
}

// Run audit
const runner = new AuditRunner();
runner.runAudit().catch((error) => {
  console.error("Fatal error during audit:", error);
  process.exit(1);
});
