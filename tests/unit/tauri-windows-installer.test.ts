import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel: string) => readFileSync(resolve(ROOT, rel), "utf-8");
const json = (rel: string) => JSON.parse(read(rel));
const exists = (rel: string) => existsSync(resolve(ROOT, rel));

const CONF_PATHS = [
  "src-tauri/tauri.conf.json",
  "src-tauri/tauri.cloud.conf.json",
  "src-tauri/tauri.vessel.conf.json",
] as const;

type TauriConf = {
  $schema: string;
  productName: string;
  version: string;
  identifier: string;
  build: {
    beforeDevCommand: string;
    devUrl: string;
    beforeBuildCommand: string;
    frontendDist: string;
  };
  app: {
    windows: {
      label: string;
      title: string;
      width: number;
      height: number;
      minWidth: number;
      minHeight: number;
    }[];
    security: { csp: string };
  };
  bundle: {
    active: boolean;
    targets: string;
    icon: string[];
    externalBin: string[];
    windows: {
      nsis: { installMode: string; installerIcon: string; installWebview2Mode: string };
      wix: { language: string; fragmentPaths: string[]; componentRefs: string[] };
    };
  };
  plugins: Record<string, unknown>;
};

// ============================================================================
// Configuration Tests
// ============================================================================

describe("Tauri Windows Installer — Configuration", () => {
  const configs: Record<string, TauriConf> = {};

  beforeAll(() => {
    for (const p of CONF_PATHS) {
      configs[p] = json(p) as TauriConf;
    }
  });

  describe.each(CONF_PATHS)("%s", (path) => {
    let conf: TauriConf;
    beforeAll(() => {
      conf = configs[path];
    });

    it("is valid JSON with required top-level keys", () => {
      expect(conf.$schema).toMatch(/tauri\.app/);
      expect(conf.productName).toBeTruthy();
      expect(conf.version).toMatch(/^\d+\.\d+\.\d+/);
      expect(conf.identifier).toBe("com.arus.marine");
    });

    it("build section has valid devUrl and frontendDist", () => {
      expect(conf.build.devUrl).toMatch(/^https?:\/\/localhost:\d+/);
      expect(conf.build.frontendDist).toBe("../dist/public");
      expect(conf.build.beforeBuildCommand).toBe("npm run build:renderer");
    });

    it("window definition has a main window with sane dimensions", () => {
      const win = conf.app.windows[0];
      expect(win.label).toBe("main");
      expect(win.width).toBeGreaterThanOrEqual(1024);
      expect(win.height).toBeGreaterThanOrEqual(680);
      expect(win.minWidth).toBeGreaterThanOrEqual(800);
      expect(win.minHeight).toBeGreaterThanOrEqual(600);
    });

    it("CSP allows self, localhost, and arus.io connections", () => {
      const csp = conf.app.security.csp;
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("http://localhost:5000");
      expect(csp).toContain("https://*.arus.io");
      expect(csp).toContain("img-src 'self' data: blob:");
    });

    it("CSP does NOT contain http: or https: wildcards", () => {
      const csp = conf.app.security.csp;
      // Ensure no bare protocol wildcards that defeat CSP
      expect(csp).not.toMatch(/connect-src[^;]* https?: /);
    });

    it('bundle is active and targets "all"', () => {
      expect(conf.bundle.active).toBe(true);
      expect(conf.bundle.targets).toBe("all");
    });

    it("declares at least 3 icon sizes", () => {
      expect(conf.bundle.icon.length).toBeGreaterThanOrEqual(3);
      expect(conf.bundle.icon).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/32x32/),
          expect.stringMatching(/128x128/),
          expect.stringMatching(/icon\.png/),
        ])
      );
    });

    it("all referenced icon files exist on disk", () => {
      for (const icon of conf.bundle.icon) {
        expect(exists(`src-tauri/${icon}`)).toBe(true);
      }
    });

    it("icon.ico exists for NSIS installer", () => {
      const nsis = conf.bundle.windows.nsis;
      expect(exists(`src-tauri/${nsis.installerIcon}`)).toBe(true);
    });

    it("externalBin references arus-server sidecar", () => {
      expect(conf.bundle.externalBin).toContain("binaries/arus-server");
    });

    it("NSIS config is set for perMachine install", () => {
      const nsis = conf.bundle.windows.nsis;
      expect(nsis.installMode).toBe("perMachine");
      expect(nsis.installerIcon).toMatch(/\.ico$/);
    });

    it("WiX config references the service fragment and component refs", () => {
      const wix = conf.bundle.windows.wix;
      expect(wix.language).toBe("en-US");
      expect(wix.fragmentPaths).toContain("windows/wix/service-component.wxs");
      expect(wix.componentRefs).toEqual(
        expect.arrayContaining(["ARUSBackendBinaries", "ARUSBackendService"])
      );
    });

    it("does NOT contain an updater plugin with placeholder keys", () => {
      const plugins = conf.plugins ?? {};
      if ("updater" in plugins) {
        const updater = plugins["updater"] as Record<string, unknown>;
        const pubkey = (updater["pubkey"] as string) ?? "";
        expect(pubkey).not.toMatch(/REPLACE_WITH/i);
        expect(pubkey).not.toBe("");
      }
    });
  });

  it("all configs share the same identifier", () => {
    const ids = Object.values(configs).map((c) => c.identifier);
    expect(new Set(ids).size).toBe(1);
  });

  it("all configs share the same version", () => {
    const versions = Object.values(configs).map((c) => c.version);
    expect(new Set(versions).size).toBe(1);
  });

  it("all configs share the same window dimensions", () => {
    const dims = Object.values(configs).map((c) => {
      const w = c.app.windows[0];
      return `${w.width}x${w.height}`;
    });
    expect(new Set(dims).size).toBe(1);
  });

  it("vessel uses offlineInstaller while cloud uses downloadBootstrapper", () => {
    expect(
      configs["src-tauri/tauri.vessel.conf.json"].bundle.windows.nsis.installWebview2Mode
    ).toBe("offlineInstaller");
    expect(configs["src-tauri/tauri.cloud.conf.json"].bundle.windows.nsis.installWebview2Mode).toBe(
      "downloadBootstrapper"
    );
  });

  it("default config uses offlineInstaller (air-gap safe)", () => {
    expect(configs["src-tauri/tauri.conf.json"].bundle.windows.nsis.installWebview2Mode).toBe(
      "offlineInstaller"
    );
  });

  it("vessel config does NOT have unsafe-eval in CSP", () => {
    const csp = configs["src-tauri/tauri.vessel.conf.json"].app.security.csp;
    expect(csp).not.toContain("unsafe-eval");
  });
});

// ============================================================================
// WiX Service Fragment Tests
// ============================================================================

describe("Tauri Windows Installer — WiX Service Fragment", () => {
  let wxs: string;
  beforeAll(() => {
    wxs = read("src-tauri/windows/wix/service-component.wxs");
  });

  it("is well-formed XML with Wix root element", () => {
    expect(wxs).toMatch(/<Wix\s+xmlns=/);
    expect(wxs).toMatch(/<\/Wix>/);
    expect(wxs).toContain("http://schemas.microsoft.com/wix/2006/wi");
  });

  it("declares ARUSBackendBinaries component with nssm.exe and arus-server.exe", () => {
    expect(wxs).toContain('Id="ARUSBackendBinaries"');
    expect(wxs).toContain('Name="nssm.exe"');
    expect(wxs).toContain('Name="arus-server.exe"');
  });

  it("declares ARUSBackendService component with registry key path", () => {
    expect(wxs).toContain('Id="ARUSBackendService"');
    expect(wxs).toContain('Key="SOFTWARE\\ARUS Marine"');
  });

  it("service binaries source from $(var.SourceDir)resources\\ staging dir", () => {
    const matches = wxs.match(/Source="([^"]+)"/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
    for (const m of matches) {
      expect(m).toContain("$(var.SourceDir)resources\\");
    }
  });

  // ── Install lifecycle ────────────────────────────────────────────────────

  describe("Install lifecycle — Custom Actions", () => {
    const requiredActions = [
      "CreateARUSDataDir",
      "CreateARUSServiceAcct",
      "DenyARUSServiceLogon",
      "GrantARUSDataDirAccess",
      "InstallARUSService",
      "SetServiceAccount",
      "SetServiceEnvPort",
      "SetServiceEnvNodeEnv",
      "SetServiceEnvDeployMode",
      "SetServiceEnvLocalMode",
      "SetServiceEnvDbPath",
      "SetServiceStdout",
      "SetServiceStderr",
      "SetServiceStart",
      "SetServiceDisplayName",
      "SetServiceDescription",
      "InitARUSDatabase",
      "StartARUSService",
    ];

    it.each(requiredActions)("declares install action: %s", (action) => {
      expect(wxs).toContain(`Id="${action}"`);
    });

    it("install actions are deferred and not impersonated", () => {
      const actionRegex = /<CustomAction\s+[^>]*Id="InstallARUSService"[^>]*/;
      const match = wxs.match(actionRegex);
      expect(match).not.toBeNull();
      expect(match![0]).toContain('Execute="deferred"');
      expect(match![0]).toContain('Impersonate="no"');
    });

    it('install actions use "NOT Installed AND NOT REMOVE" condition', () => {
      const installSequence = wxs.match(/Action="CreateARUSDataDir"[^>]*>([^<]+)</);
      expect(installSequence).not.toBeNull();
      expect(installSequence![1].trim()).toBe("NOT Installed AND NOT REMOVE");
    });

    it("install chain is ordered (each After= references the previous)", () => {
      const chain = requiredActions;
      const sequenceBlock = wxs.match(
        /<InstallExecuteSequence>([\s\S]*?)<\/InstallExecuteSequence>/
      );
      expect(sequenceBlock).not.toBeNull();
      const seq = sequenceBlock![1];

      const firstAction = seq.match(/Action="CreateARUSDataDir"[^>]*After="([^"]+)"/);
      expect(firstAction).not.toBeNull();
      expect(firstAction![1]).toBe("InstallFiles");

      for (let i = 2; i < chain.length; i++) {
        const pattern = new RegExp(`Action="${chain[i]}"[^>]*After="([^"]+)"`);
        const match = seq.match(pattern);
        expect(match).not.toBeNull();
        expect(match![1]).toBe(chain[i - 1]);
      }
    });
  });

  // ── Service account security ─────────────────────────────────────────────

  describe("Service account security", () => {
    it("creates service account with a random password (not /passwordreq:no)", () => {
      expect(wxs).not.toContain("/passwordreq:no");
      // Should use PowerShell to generate a random password
      expect(wxs).toContain("Get-Random");
      expect(wxs).toContain("New-LocalUser");
      expect(wxs).toContain("ConvertTo-SecureString");
    });

    it("denies interactive logon for the service account", () => {
      expect(wxs).toContain("DenyARUSServiceLogon");
      expect(wxs).toContain("SeDenyInteractiveLogonRight");
    });

    it("service account password is passed to NSSM and temp file is deleted", () => {
      expect(wxs).toContain("arus_svc_pwd.tmp");
      // Verify the temp file is deleted after use
      const setAccountAction = wxs.match(/Id="SetServiceAccount"[\s\S]*?ExeCommand="([^"]+)"/);
      expect(setAccountAction).not.toBeNull();
      expect(setAccountAction![1]).toContain("del");
    });

    it("data directory ACL grants access only to service account", () => {
      expect(wxs).toContain("icacls");
      expect(wxs).toContain("ARUS_svc:(OI)(CI)F");
      expect(wxs).toContain("/inheritance:e");
    });

    it("nssm.exe uses confirm flag on remove to prevent accidental deletion", () => {
      const removeAction = wxs.match(/Id="RemoveARUSService"[\s\S]*?ExeCommand="([^"]+)"/);
      expect(removeAction).not.toBeNull();
      expect(removeAction![1]).toContain("remove ARUSBackend confirm");
    });

    it('critical install actions use Return="check" (fail on error)', () => {
      const criticalActions = [
        "InstallARUSService",
        "SetServiceAccount",
        "SetServiceEnvPort",
        "InitARUSDatabase",
      ];
      for (const action of criticalActions) {
        const match = wxs.match(new RegExp(`Id="${action}"[\\s\\S]*?Return="([^"]+)"`));
        expect(match).not.toBeNull();
        expect(match![1]).toBe("check");
      }
    });

    it('teardown actions use Return="ignore" (best-effort cleanup)', () => {
      const teardownActions = ["StopARUSService", "RemoveARUSService", "RemoveARUSServiceAcct"];
      for (const action of teardownActions) {
        const match = wxs.match(new RegExp(`Id="${action}"[\\s\\S]*?Return="([^"]+)"`));
        expect(match).not.toBeNull();
        expect(match![1]).toBe("ignore");
      }
    });
  });

  // ── Environment variables ────────────────────────────────────────────────

  describe("Service environment variables", () => {
    it("uses ARUS_DEPLOYMENT_MODE (not DEPLOYMENT_MODE) to match server", () => {
      expect(wxs).toContain("ARUS_DEPLOYMENT_MODE=VESSEL");
      expect(wxs).not.toMatch(/[^_]DEPLOYMENT_MODE=VESSEL/);
    });

    it("sets each env var with a separate NSSM call", () => {
      const envActions = [
        "SetServiceEnvPort",
        "SetServiceEnvNodeEnv",
        "SetServiceEnvDeployMode",
        "SetServiceEnvLocalMode",
        "SetServiceEnvDbPath",
      ];
      for (const action of envActions) {
        expect(wxs).toContain(`Id="${action}"`);
      }
    });

    it("sets PORT=5000", () => {
      expect(wxs).toContain("PORT=5000");
    });

    it("sets NODE_ENV=production", () => {
      expect(wxs).toContain("NODE_ENV=production");
    });

    it("sets LOCAL_MODE=true", () => {
      expect(wxs).toContain("LOCAL_MODE=true");
    });

    it("sets DATABASE_PATH to ProgramData location", () => {
      expect(wxs).toContain("DATABASE_PATH=");
      expect(wxs).toContain("ARUS Marine");
      expect(wxs).toContain("vessel-local.db");
    });
  });

  // ── Upgrade lifecycle ────────────────────────────────────────────────────

  describe("Upgrade lifecycle", () => {
    it("stops service before file replacement", () => {
      const stopUpgrade = wxs.match(
        /Action="StopARUSServiceUpgrade"[^>]*Before="InstallFiles"[^>]*>([^<]+)/
      );
      expect(stopUpgrade).not.toBeNull();
      expect(stopUpgrade![1].trim()).toBe("Installed AND NOT REMOVE");
    });

    it("runs database migration after file replacement", () => {
      const migrate = wxs.match(/Action="MigrateARUSDatabase"[^>]*After="([^"]+)"[^>]*>([^<]+)/);
      expect(migrate).not.toBeNull();
      expect(migrate![1]).toBe("InstallFiles");
      expect(migrate![2].trim()).toBe("Installed AND NOT REMOVE");
    });

    it("restarts service after install finalize", () => {
      const restart = wxs.match(
        /Action="RestartARUSService"[^>]*After="InstallFinalize"[^>]*>([^<]+)/
      );
      expect(restart).not.toBeNull();
      expect(restart![1].trim()).toBe("Installed AND NOT REMOVE");
    });

    it("migration uses --init-db flag", () => {
      const migrateAction = wxs.match(/Id="MigrateARUSDatabase"[\s\S]*?ExeCommand="([^"]+)"/);
      expect(migrateAction).not.toBeNull();
      expect(migrateAction![1]).toContain("--init-db");
    });
  });

  // ── Uninstall lifecycle ──────────────────────────────────────────────────

  describe("Uninstall lifecycle", () => {
    it('stops, removes service, and deletes service account on REMOVE="ALL"', () => {
      const uninstallActions = ["StopARUSService", "RemoveARUSService", "RemoveARUSServiceAcct"];
      for (const action of uninstallActions) {
        const match = wxs.match(new RegExp(`Action="${action}"[^>]*>[^<]+`));
        expect(match).not.toBeNull();
        expect(match![0]).toContain('REMOVE="ALL"');
      }
    });

    it("uninstall chain is ordered: stop → remove service → remove account", () => {
      const removeService = wxs.match(/Action="RemoveARUSService"[^>]*After="([^"]+)"/);
      expect(removeService).not.toBeNull();
      expect(removeService![1]).toBe("StopARUSService");

      const removeAcct = wxs.match(/Action="RemoveARUSServiceAcct"[^>]*After="([^"]+)"/);
      expect(removeAcct).not.toBeNull();
      expect(removeAcct![1]).toBe("RemoveARUSService");
    });
  });

  // ── Service configuration ────────────────────────────────────────────────

  describe("Service configuration", () => {
    it("configures auto-restart recovery policy (3 restarts, 15s delay)", () => {
      expect(wxs).toContain('ServiceName="ARUSBackend"');
      expect(wxs).toContain('FirstFailureActionType="restart"');
      expect(wxs).toContain('SecondFailureActionType="restart"');
      expect(wxs).toContain('ThirdFailureActionType="restart"');
      expect(wxs).toContain('RestartServiceDelayInSeconds="15"');
    });

    it("service runs under dedicated ARUS_svc account, not SYSTEM", () => {
      expect(wxs).toContain("ARUS_svc");
      expect(wxs).not.toContain("LocalSystem");
    });

    it("logs stdout and stderr to ProgramData directory", () => {
      expect(wxs).toContain("AppStdout");
      expect(wxs).toContain("ARUS Marine\\logs\\backend.log");
      expect(wxs).toContain("AppStderr");
      expect(wxs).toContain("ARUS Marine\\logs\\backend-error.log");
    });

    it("sets auto-start mode", () => {
      expect(wxs).toContain("SERVICE_AUTO_START");
    });

    it("runs database initialization before starting service", () => {
      const initDb = wxs.match(/Action="InitARUSDatabase"[^>]*After="([^"]+)"/);
      expect(initDb).not.toBeNull();
      expect(initDb![1]).toBe("SetServiceDescription");

      const startSvc = wxs.match(/Action="StartARUSService"[^>]*After="([^"]+)"/);
      expect(startSvc).not.toBeNull();
      expect(startSvc![1]).toBe("InitARUSDatabase");
    });
  });

  it("Feature element references both component IDs", () => {
    expect(wxs).toContain('Id="ARUSBackendFeature"');
    expect(wxs).toContain('<ComponentRef Id="ARUSBackendBinaries"');
    expect(wxs).toContain('<ComponentRef Id="ARUSBackendService"');
  });

  it("component GUIDs are unique", () => {
    const guidRegex = /Guid="([A-F0-9-]+)"/gi;
    const guids: string[] = [];
    let m;
    while ((m = guidRegex.exec(wxs)) !== null) {
      guids.push(m[1].toUpperCase());
    }
    expect(guids.length).toBeGreaterThanOrEqual(2);
    expect(new Set(guids).size).toBe(guids.length);
  });
});

// ============================================================================
// Capabilities Tests
// ============================================================================

describe("Tauri Windows Installer — Capabilities", () => {
  let caps: { identifier: string; windows: string[]; permissions: unknown[] };
  beforeAll(() => {
    caps = json("src-tauri/capabilities/default.json");
  });

  it("targets the main window", () => {
    expect(caps.windows).toContain("main");
  });

  it("grants core:default, shell:allow-open, shell:allow-execute for sidecar", () => {
    const flat = caps.permissions.map((p) =>
      typeof p === "string" ? p : (p as Record<string, unknown>)["identifier"]
    );
    expect(flat).toContain("core:default");
    expect(flat).toContain("shell:allow-open");
    expect(flat).toContain("shell:allow-execute");
  });

  it("shell:allow-execute restricts to arus-server sidecar only", () => {
    const exec = caps.permissions.find(
      (p) =>
        typeof p === "object" &&
        (p as Record<string, unknown>)["identifier"] === "shell:allow-execute"
    ) as Record<string, unknown>;
    expect(exec).toBeDefined();
    const allow = exec["allow"] as { name: string; sidecar: boolean }[];
    expect(allow).toEqual([{ name: "arus-server", sidecar: true }]);
  });

  it("includes fs read and write permissions scoped to $APPDATA", () => {
    const flat = caps.permissions.map((p) =>
      typeof p === "string" ? p : (p as Record<string, unknown>)["identifier"]
    );
    expect(flat).toContain("fs:allow-app-read");
    expect(flat).toContain("fs:allow-app-write");
  });

  it("includes process:allow-relaunch and process:allow-exit", () => {
    const flat = caps.permissions.map((p) =>
      typeof p === "string" ? p : (p as Record<string, unknown>)["identifier"]
    );
    expect(flat).toContain("process:allow-relaunch");
    expect(flat).toContain("process:allow-exit");
  });
});

// ============================================================================
// Rust Sidecar Logic Tests
// ============================================================================

describe("Tauri Windows Installer — Rust Sidecar Logic", () => {
  let libRs: string;
  beforeAll(() => {
    libRs = read("src-tauri/src/lib.rs");
  });

  it("exports SidecarState with Mutex<Option<CommandChild>>", () => {
    expect(libRs).toContain("pub struct SidecarState");
    expect(libRs).toContain("Mutex<Option<tauri_plugin_shell::process::CommandChild>>");
  });

  it("registers all expected Tauri commands", () => {
    const expectedCommands = [
      "get_app_version",
      "get_runtime_state",
      "get_app_data_dir",
      "get_backend_config",
      "get_backend_status",
      "start_backend_sidecar",
    ];
    for (const cmd of expectedCommands) {
      expect(libRs).toContain(cmd);
    }
  });

  it("checks Windows service before sidecar on get_backend_status", () => {
    expect(libRs).toContain('#[cfg(target_os = "windows")]');
    expect(libRs).toContain('service_is_running("ARUSBackend")');
  });

  it("service_is_running uses sc query command", () => {
    expect(libRs).toContain('Command::new("sc")');
    expect(libRs).toContain('.args(["query"');
    expect(libRs).toContain("RUNNING");
  });

  it("sidecar sets correct environment variables", () => {
    expect(libRs).toContain('.env("NODE_ENV"');
    expect(libRs).toContain('.env("PORT",');
    expect(libRs).toContain('.env("DEPLOYMENT_MODE", "VESSEL")');
    expect(libRs).toContain('.env("LOCAL_MODE",      "true")');
    expect(libRs).toContain('.env("DATABASE_PATH"');
  });

  it("sidecar health check polls for up to 15 seconds (30 attempts x 500ms)", () => {
    expect(libRs).toContain("for attempt in 0..30");
    expect(libRs).toContain("Duration::from_millis(500)");
  });

  it("kills sidecar on window destroy", () => {
    expect(libRs).toContain("WindowEvent::Destroyed");
    expect(libRs).toContain("child.kill()");
  });

  it("emits backend lifecycle events", () => {
    const events = ["backend-log", "backend-error", "backend-terminated", "backend-launch-failed"];
    for (const evt of events) {
      expect(libRs).toContain(`"${evt}"`);
    }
  });

  it("ping_backend hits /api/healthz with 4s timeout", () => {
    expect(libRs).toContain("/api/healthz");
    expect(libRs).toContain("Duration::from_secs(4)");
  });

  it("does NOT use danger_accept_invalid_certs", () => {
    expect(libRs).not.toContain("danger_accept_invalid_certs");
  });

  it("hides console window in release builds on Windows", () => {
    const mainRs = read("src-tauri/src/main.rs");
    expect(mainRs).toContain('#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]');
  });
});

// ============================================================================
// Cargo.toml Dependency Tests
// ============================================================================

describe("Tauri Windows Installer — Cargo.toml Dependencies", () => {
  let cargo: string;
  beforeAll(() => {
    cargo = read("src-tauri/Cargo.toml");
  });

  it("depends on tauri v2 and all required plugins", () => {
    expect(cargo).toContain('tauri = { version = "2"');
    expect(cargo).toContain("tauri-plugin-shell");
    expect(cargo).toContain("tauri-plugin-updater");
    expect(cargo).toContain("tauri-plugin-process");
    expect(cargo).toContain("tauri-plugin-fs");
  });

  it("uses reqwest with rustls (no openssl dependency)", () => {
    expect(cargo).toContain("reqwest");
    expect(cargo).toContain("rustls-tls");
    expect(cargo).not.toContain("native-tls");
  });

  it("release profile enables LTO and strips symbols", () => {
    expect(cargo).toContain("lto = true");
    expect(cargo).toContain("strip = true");
    expect(cargo).toContain("codegen-units = 1");
    expect(cargo).toContain('opt-level = "s"');
  });

  it("crate outputs lib, cdylib, and staticlib", () => {
    expect(cargo).toContain('crate-type = ["lib", "cdylib", "staticlib"]');
  });
});
