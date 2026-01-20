# Code Signing Guide for ARUS Marine

This guide covers everything you need to know about code signing and distributing the ARUS Marine Electron application for macOS and Windows.

## Table of Contents

1. [macOS Code Signing & Notarization](#macos-code-signing--notarization)
2. [Windows Code Signing](#windows-code-signing)
3. [Testing Unsigned Builds](#testing-unsigned-builds)
4. [Troubleshooting](#troubleshooting)

---

## macOS Code Signing & Notarization

### Prerequisites

1. **Apple Developer Account**
   - Enroll at: https://developer.apple.com/programs/
   - Cost: $99/year (individual) or $299/year (organization)
   - Required for App Store distribution and notarization

2. **Xcode Command Line Tools**
   ```bash
   xcode-select --install
   ```

### Step 1: Create Certificates

#### A. Development Certificate (for local testing)

1. Open **Keychain Access** on macOS
2. Go to **Keychain Access > Certificate Assistant > Request a Certificate from a Certificate Authority**
3. Enter your email and name
4. Select "Saved to disk" and continue
5. Go to [Apple Developer Certificates](https://developer.apple.com/account/resources/certificates)
6. Click **+** to create new certificate
7. Select **Apple Development** and continue
8. Upload the Certificate Signing Request (CSR)
9. Download the certificate and double-click to install

#### B. Distribution Certificate (for App Store)

1. Repeat steps 1-4 above
2. Go to [Apple Developer Certificates](https://developer.apple.com/account/resources/certificates)
3. Select **Mac App Distribution** for App Store
4. OR select **Developer ID Application** for distribution outside App Store
5. Download and install the certificate

### Step 2: Create App ID

1. Go to [Identifiers](https://developer.apple.com/account/resources/identifiers)
2. Click **+** to create new identifier
3. Select **App IDs** and continue
4. Choose **App** type
5. Enter:
   - Description: "ARUS Marine"
   - Bundle ID: `com.arus.marine` (matches electron-builder.json)
6. Select capabilities if needed (none required for basic app)
7. Register

### Step 3: Create Provisioning Profile (for App Store only)

1. Go to [Profiles](https://developer.apple.com/account/resources/profiles)
2. Click **+** to create new profile
3. Select **Mac App Store** and continue
4. Select your App ID (`com.arus.marine`)
5. Select your Distribution certificate
6. Name it "ARUS Marine App Store Profile"
7. Download the provisioning profile

### Step 4: Configure Code Signing in electron-builder

The current `electron-builder.json` is already configured for code signing:

```json
{
  "mac": {
    "identity": "Developer ID Application: YOUR NAME (TEAM_ID)",
    "hardenedRuntime": true,
    "gatekeeperAssess": false,
    "entitlements": "build/entitlements.mac.plist",
    "entitlementsInherit": "build/entitlements.mac.plist"
  }
}
```

#### Update Identity

1. Find your certificate identity:
   ```bash
   security find-identity -v -p codesigning
   ```

2. Copy the identity name (e.g., "Developer ID Application: Your Name (ABC123)")

3. Add to electron-builder.json:
   ```json
   {
     "mac": {
       "identity": "Developer ID Application: Your Name (ABC123)",
       ...
     }
   }
   ```

   Or set as environment variable:
   ```bash
   export CSC_NAME="Developer ID Application: Your Name (ABC123)"
   ```

### Step 5: Notarization Setup

Apple requires notarization for all apps distributed outside the App Store.

#### A. Create App-Specific Password

1. Go to [Apple ID account](https://appleid.apple.com/)
2. Sign in with your Apple Developer account
3. Go to **Security > App-Specific Passwords**
4. Click **+** to generate new password
5. Name it "ARUS Marine Notarization"
6. Copy the password (format: `xxxx-xxxx-xxxx-xxxx`)

#### B. Store Credentials

Add to your environment or CI/CD:

```bash
export APPLE_ID="your-apple-id@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="ABC123"  # Find in Apple Developer account
```

Or use keychain:
```bash
xcrun notarytool store-credentials "ARUS-Marine-Profile" \
  --apple-id "your-apple-id@example.com" \
  --team-id "ABC123" \
  --password "xxxx-xxxx-xxxx-xxxx"
```

#### C. Add Notarization to electron-builder

Update `electron-builder.json`:

```json
{
  "mac": {
    "notarize": {
      "teamId": "ABC123"
    }
  },
  "afterSign": "scripts/notarize.js"
}
```

Create `scripts/notarize.js`:

```javascript
const { notarize } = require('@electron/notarize');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  
  if (electronPlatformName !== 'darwin') {
    return;
  }

  const appName = context.packager.appInfo.productFilename;

  return await notarize({
    appBundleId: 'com.arus.marine',
    appPath: `${appOutDir}/${appName}.app`,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID,
  });
};
```

Install notarization package:
```bash
npm install --save-dev @electron/notarize
```

### Step 6: Build and Sign

```bash
# Export signing variables
export CSC_NAME="Developer ID Application: Your Name (ABC123)"
export APPLE_ID="your-apple-id@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="ABC123"

# Build and sign
npm run dist:mac
```

The build process will:
1. ✅ Sign the app with your certificate
2. ✅ Notarize the app with Apple
3. ✅ Staple the notarization ticket
4. ✅ Create a signed DMG

### Step 7: Verify Signing

```bash
# Check code signature
codesign --verify --deep --strict --verbose=2 release/mac/ARUS\ Marine.app

# Check notarization
spctl -a -t exec -vv release/mac/ARUS\ Marine.app

# Should output: "source=Notarized Developer ID"
```

---

## Windows Code Signing

### Prerequisites

1. **Code Signing Certificate**
   - Purchase from a Certificate Authority (CA):
     - **DigiCert** (recommended): ~$500/year
     - **Sectigo** (formerly Comodo): ~$200/year
     - **GlobalSign**: ~$250/year
   
2. **Certificate Formats**
   - You'll receive either:
     - `.pfx` file (PKCS#12) - most common
     - `.p12` file (also PKCS#12)
   - Plus a password to protect the certificate

### Step 1: Obtain Certificate

#### Option A: Standard Code Signing Certificate

1. Choose a Certificate Authority (CA)
2. Purchase "Code Signing Certificate" or "EV Code Signing Certificate"
3. Complete identity verification:
   - Individual: Government ID, phone verification
   - Organization: Business documents, D&B number
4. Download certificate as `.pfx` or `.p12`

**Note:** EV (Extended Validation) certificates are more expensive ($300-500/year) but provide instant SmartScreen reputation, removing the "unknown publisher" warning immediately.

#### Option B: Self-Signed Certificate (Development Only)

For testing purposes only (will show warnings to users):

**PowerShell (Windows):**
```powershell
$cert = New-SelfSignedCertificate -Type CodeSigning -Subject "CN=ARUS Marine Dev" -CertStoreLocation Cert:\CurrentUser\My
$password = ConvertTo-SecureString -String "YOUR_PASSWORD" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath "arus-dev-cert.pfx" -Password $password
```

**Linux/macOS (using OpenSSL):**
```bash
# Generate private key
openssl genrsa -out arus-dev.key 2048

# Create certificate signing request
openssl req -new -key arus-dev.key -out arus-dev.csr -subj "/CN=ARUS Marine Dev"

# Generate self-signed certificate
openssl x509 -req -days 365 -in arus-dev.csr -signkey arus-dev.key -out arus-dev.crt

# Convert to PFX format
openssl pkcs12 -export -out arus-dev.pfx -inkey arus-dev.key -in arus-dev.crt -password pass:YOUR_PASSWORD
```

### Step 2: Configure electron-builder

Update `electron-builder.json`:

```json
{
  "win": {
    "certificateFile": "certs/windows-cert.pfx",
    "certificatePassword": "YOUR_CERT_PASSWORD",
    "target": ["nsis", "portable"],
    "icon": "build/icon-256.png",
    "publisherName": "ARUS Team",
    "signingHashAlgorithms": ["sha256"],
    "rfc3161TimeStampServer": "http://timestamp.digicert.com"
  }
}
```

**Security Best Practice:** Use environment variables instead of hardcoding:

```json
{
  "win": {
    "certificateFile": "./certs/windows-cert.pfx",
    "target": ["nsis", "portable"]
  }
}
```

Set environment variables:
```bash
export WIN_CSC_LINK="./certs/windows-cert.pfx"
export WIN_CSC_KEY_PASSWORD="YOUR_CERT_PASSWORD"
```

### Step 3: Build and Sign

```bash
# Export signing variables
export WIN_CSC_LINK="./certs/windows-cert.pfx"
export WIN_CSC_KEY_PASSWORD="YOUR_CERT_PASSWORD"

# Build and sign (on Windows or with Wine)
npm run dist:win
```

### Step 4: Verify Signing (Windows only)

```powershell
# Check signature
Get-AuthenticodeSignature "release\ARUS Marine Setup.exe"

# Should show:
# Status: Valid
# SignerCertificate: CN=ARUS Team, ...
```

### SmartScreen Reputation

Even with a valid certificate, Windows SmartScreen may show warnings for new applications:

- **Standard Certificate:** Takes 3-6 months of user downloads to build reputation
- **EV Certificate:** Instant reputation, no warnings from day 1

**Recommendation:** Start with standard certificate, upgrade to EV if needed based on user feedback.

---

## Testing Unsigned Builds

### macOS

Unsigned builds will show:

> "ARUS Marine.app" can't be opened because Apple cannot check it for malicious software.

**Workaround for testing:**

```bash
# Remove quarantine attribute
xattr -cr "/Applications/ARUS Marine.app"

# Or use command line to open
open -a "ARUS Marine"
```

**Or enable in System Preferences:**
1. Go to **System Preferences > Security & Privacy**
2. Click **Open Anyway** after first launch attempt

### Windows

Unsigned builds will show:

> Windows protected your PC - Unknown publisher

**Workaround for testing:**

1. Click **More info**
2. Click **Run anyway**

---

## Electron-Builder Configuration Summary

### Current Configuration

```json
{
  "mac": {
    "category": "public.app-category.business",
    "target": [
      { "target": "dmg", "arch": ["x64", "arm64"] },
      { "target": "zip", "arch": ["x64", "arm64"] }
    ],
    "icon": "build/icon-1024.png",
    "darkModeSupport": true,
    "hardenedRuntime": true,
    "gatekeeperAssess": false,
    "entitlements": "build/entitlements.mac.plist",
    "entitlementsInherit": "build/entitlements.mac.plist",
    "minimumSystemVersion": "10.13.0"
  },
  "win": {
    "target": ["nsis", "portable"],
    "icon": "build/icon-256.png"
  }
}
```

### Production Configuration (with signing)

```json
{
  "mac": {
    "identity": "Developer ID Application: Your Name (TEAM_ID)",
    "notarize": {
      "teamId": "TEAM_ID"
    },
    ...
  },
  "win": {
    "certificateFile": "./certs/windows-cert.pfx",
    "signingHashAlgorithms": ["sha256"],
    "rfc3161TimeStampServer": "http://timestamp.digicert.com",
    ...
  }
}
```

---

## Troubleshooting

### macOS

**Issue:** "No identity found"

```bash
# List available identities
security find-identity -v -p codesigning

# Import certificate if needed
security import certificate.p12 -k ~/Library/Keychains/login.keychain
```

**Issue:** Notarization fails

```bash
# Check notarization log
xcrun notarytool log <submission-id> --keychain-profile "ARUS-Marine-Profile"

# Common issues:
# - Missing hardened runtime entitlements
# - Unsigned helper apps or frameworks
# - Invalid bundle identifier
```

**Issue:** Gatekeeper blocks app

```bash
# Disable Gatekeeper for testing (not recommended for production)
sudo spctl --master-disable

# Re-enable
sudo spctl --master-enable
```

### Windows

**Issue:** "signtool.exe not found"

Install Windows SDK:
- Download from: https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/
- Or install via Visual Studio

**Issue:** Timestamp server timeout

Try alternative timestamp servers in electron-builder.json:
```json
{
  "win": {
    "rfc3161TimeStampServer": "http://timestamp.comodoca.com"
  }
}
```

**Issue:** Certificate not trusted

Ensure certificate chain is complete:
- CA certificate must be from a trusted authority
- Intermediate certificates must be included
- Root certificate must be in Windows trust store

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

## Next Steps

1. ✅ Icons configured (automatically converted by electron-builder)
2. ✅ Entitlements configured (`build/entitlements.mac.plist`)
3. ⏳ **Obtain Apple Developer account** ($99/year)
4. ⏳ **Create certificates** (follow steps above)
5. ⏳ **Test unsigned build** first
6. ⏳ **Configure signing** (update electron-builder.json)
7. ⏳ **Build signed release** (`npm run dist:mac`)

---

## Resources

- [electron-builder Code Signing](https://www.electron.build/code-signing)
- [Apple Developer Portal](https://developer.apple.com/)
- [Notarizing macOS Software](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [Windows Code Signing](https://docs.microsoft.com/en-us/windows/win32/seccrypto/using-signtool-to-sign-a-file)
- [DigiCert Code Signing](https://www.digicert.com/signing/code-signing-certificates)

---

**Need Help?**

If you encounter issues:
1. Check the [electron-builder documentation](https://www.electron.build/)
2. Review build logs in `release/` directory
3. Test with unsigned builds first
4. Verify certificates are installed correctly
