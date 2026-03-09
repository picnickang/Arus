# Code Signing Guide for ARUS Marine

This guide covers code signing and distributing the ARUS Marine Tauri v2 desktop application for macOS and Windows.

## Table of Contents

1. [macOS Code Signing & Notarization](#macos-code-signing--notarization)
2. [Windows Code Signing](#windows-code-signing)
3. [Tauri Updater Signing](#tauri-updater-signing)
4. [Testing Unsigned Builds](#testing-unsigned-builds)
5. [Troubleshooting](#troubleshooting)

---

## macOS Code Signing & Notarization

### Prerequisites

1. **Apple Developer Account**
   - Enroll at: https://developer.apple.com/programs/
   - Cost: $99/year (individual) or $299/year (organization)

2. **Xcode Command Line Tools**
   ```bash
   xcode-select --install
   ```

### Step 1: Create Certificates

1. Open **Keychain Access** on macOS
2. Go to **Keychain Access > Certificate Assistant > Request a Certificate from a Certificate Authority**
3. Enter your email and name, select "Saved to disk"
4. Go to [Apple Developer Certificates](https://developer.apple.com/account/resources/certificates)
5. Click **+** → Select **Developer ID Application** → Upload CSR
6. Download and install the certificate

### Step 2: Create App ID

1. Go to [Identifiers](https://developer.apple.com/account/resources/identifiers)
2. Click **+** → Select **App IDs** → Choose **App** type
3. Enter:
   - Description: "ARUS Marine"
   - Bundle ID: `com.arus.marine` (matches `src-tauri/tauri.conf.json`)
4. Register

### Step 3: Configure Notarization

Create an app-specific password:
1. Go to [Apple ID account](https://appleid.apple.com/)
2. Go to **Security > App-Specific Passwords** → Generate
3. Name it "ARUS Marine Notarization"

Store credentials:
```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAM_ID)"
export APPLE_ID="your-apple-id@example.com"
export APPLE_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="TEAM_ID"
```

### Step 4: Build and Sign

```bash
npm run tauri:build
```

Tauri v2 handles signing and notarization automatically when the environment variables are set.

### Step 5: Verify Signing

```bash
codesign --verify --deep --strict --verbose=2 "src-tauri/target/release/bundle/macos/ARUS Marine.app"

spctl -a -t exec -vv "src-tauri/target/release/bundle/macos/ARUS Marine.app"
```

---

## Windows Code Signing

### Prerequisites

1. **Code Signing Certificate** from a Certificate Authority:
   - **DigiCert** (recommended): ~$500/year
   - **Sectigo**: ~$200/year
   - **GlobalSign**: ~$250/year

2. **Certificate Format:** `.pfx` or `.p12` (PKCS#12)

### Step 1: Obtain Certificate

1. Purchase "Code Signing Certificate" or "EV Code Signing Certificate"
2. Complete identity verification
3. Download certificate as `.pfx`

**Note:** EV certificates provide instant SmartScreen reputation (no "unknown publisher" warning).

### Step 2: Configure Signing

Set environment variables:
```bash
export TAURI_SIGNING_PRIVATE_KEY="path/to/certificate.pfx"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="YOUR_PASSWORD"
```

### Step 3: Build and Sign

```bash
npm run tauri:build
```

### Step 4: Verify Signing (Windows)

```powershell
Get-AuthenticodeSignature "src-tauri\target\release\bundle\nsis\ARUS Marine Setup.exe"
```

---

## Tauri Updater Signing

Tauri's built-in updater requires a signing key to verify update integrity.

### Generate Update Signing Keys

```bash
npx @tauri-apps/cli signer generate -w ~/.tauri/arus-marine.key
```

This generates a keypair. Store the private key securely.

### Configure for Builds

```bash
export TAURI_SIGNING_PRIVATE_KEY=$(cat ~/.tauri/arus-marine.key)
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="your-password"
```

The public key is configured in `src-tauri/tauri.conf.json` under `plugins.updater.pubkey`.

---

## Testing Unsigned Builds

### macOS

Unsigned builds will show a Gatekeeper warning. Workaround:
```bash
xattr -cr "/Applications/ARUS Marine.app"
```

Or go to **System Preferences > Security & Privacy > Open Anyway**.

### Windows

Unsigned builds will show SmartScreen warning. Click **More info > Run anyway**.

---

## Troubleshooting

### macOS

**"No identity found":**
```bash
security find-identity -v -p codesigning
```

**Notarization fails:**
```bash
xcrun notarytool log <submission-id> --keychain-profile "ARUS-Marine-Profile"
```

### Windows

**Certificate not trusted:**
- Ensure certificate chain is complete
- CA certificate must be from a trusted authority

### General

**Build fails — missing Rust:**
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

**Build fails — missing system dependencies (Linux):**
```bash
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

---

## Cost Summary

| Item | Cost | Frequency |
|------|------|-----------|
| **macOS** | | |
| Apple Developer Program | $99 | Annual |
| Code signing certificate | Included | - |
| Notarization | Free | - |
| **Windows** | | |
| Standard Code Signing | $200-300 | Annual |
| EV Code Signing | $300-500 | Annual |
| **TOTAL (Standard)** | **$299-399/year** | |
| **TOTAL (with EV)** | **$399-599/year** | |

---

## Resources

- [Tauri v2 Code Signing](https://v2.tauri.app/distribute/sign/)
- [Tauri v2 Updater](https://v2.tauri.app/plugin/updater/)
- [Apple Developer Portal](https://developer.apple.com/)
- [Notarizing macOS Software](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [Windows Code Signing](https://docs.microsoft.com/en-us/windows/win32/seccrypto/using-signtool-to-sign-a-file)
