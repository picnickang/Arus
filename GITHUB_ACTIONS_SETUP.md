# GitHub Actions Setup for macOS DMG Building

This guide shows you how to automatically build the ARUS macOS .dmg installer using GitHub Actions.

---

## 🎯 What This Does

**Automatically builds a production-ready .dmg installer whenever you:**

- Create a version tag (e.g., `v1.0.0`)
- Manually trigger the workflow
- Push to main branch (optional)

**What gets built:**

- ✅ Complete .dmg installer
- ✅ Pre-built for Apple Silicon (M-series Macs)
- ✅ SHA-256 checksum for verification
- ✅ Release notes
- ✅ Uploaded to GitHub Releases

**Build time:** 10-15 minutes  
**Cost:** Free (GitHub Actions includes macOS runners)

---

## 📋 Prerequisites

1. **GitHub Repository**
   - Code is in a GitHub repository
   - You have push access

2. **No Special Accounts Needed**
   - GitHub Actions is included with every repo
   - macOS runners are free for public repos
   - Private repos: 2,000 minutes/month free

3. **Optional: Apple Developer Account**
   - Not required for basic builds
   - Needed only for code signing/notarization

---

## 🚀 Setup Instructions

### Step 1: Enable GitHub Actions

The workflow file is already created: `.github/workflows/build-macos-dmg.yml`

**Just push it to GitHub:**

```bash
git add .github/workflows/build-macos-dmg.yml
git commit -m "Add macOS DMG build workflow"
git push
```

That's it! GitHub Actions is now configured.

### Step 2: Create Your First Release

**Option A: Using Git Tags (Recommended)**

```bash
# Tag your current version
git tag v1.0.0

# Push the tag to GitHub
git push origin v1.0.0
```

**What happens:**

1. GitHub detects the tag
2. Starts the build workflow
3. Runs on macOS runner (Apple Silicon)
4. Builds the complete .dmg
5. Creates a GitHub Release
6. Uploads .dmg to the release

**Option B: Manual Trigger**

1. Go to your GitHub repo
2. Click "Actions" tab
3. Click "Build macOS DMG Installer"
4. Click "Run workflow"
5. Click green "Run workflow" button

### Step 3: Download Your DMG

1. Go to "Actions" tab
2. Click the completed workflow run
3. Scroll to "Artifacts" section
4. Download `ARUS-macOS-DMG-1.0.0.zip`
5. Extract to get the .dmg file

**Or** (if you created a tag):

1. Go to "Releases" tab
2. See your new release
3. Download `ARUS-1.0.0-macOS-universal.dmg`

---

## 📊 What the Workflow Does

### Detailed Build Steps

```
1. Checkout Code
   ↓ Clones your repository

2. Setup Node.js 20
   ↓ Installs Node.js on macOS runner

3. Install Dependencies
   ↓ Runs npm ci

4. Install DMG Tools
   ↓ Installs create-dmg via Homebrew

5. Build DMG
   ↓ Runs scripts/build-dmg-release.sh
   ↓ This executes:
      • Build application
      • Create seed database
      • Create installer app
      • Create uninstaller app
      • Package into .dmg

6. Calculate Checksums
   ↓ Generates SHA-256 for verification

7. Upload Artifacts
   ↓ Makes .dmg available for download

8. Create Release (if tag)
   ↓ Publishes to GitHub Releases
```

**Total time:** 10-15 minutes

---

## 📁 What You Get

### Artifacts

After the build completes, you get:

```
ARUS-macOS-DMG-1.0.0/
├── ARUS-1.0.0-macOS-universal.dmg    (600-900 MB)
├── RELEASE_NOTES_1.0.0.txt            (Release notes)
└── checksums.txt                      (SHA-256 hash)
```

### GitHub Release (if tag used)

Automatically creates a release with:

- ✅ .dmg installer
- ✅ Release notes
- ✅ Installation guide
- ✅ Checksums
- ✅ Professional description

---

## 🔧 Customization Options

### Change When It Builds

Edit `.github/workflows/build-macos-dmg.yml`:

```yaml
# Build on every push to main
on:
  push:
    branches:
      - main

# Build on pull requests
on:
  pull_request:
    branches:
      - main

# Build on schedule (every Sunday at midnight)
on:
  schedule:
    - cron: '0 0 * * 0'
```

### Add Code Signing

If you have an Apple Developer account:

```yaml
- name: Import signing certificate
  uses: apple-actions/import-codesign-certs@v2
  with:
    p12-file-base64: ${{ secrets.CERTIFICATES_P12 }}
    p12-password: ${{ secrets.CERTIFICATES_P12_PASSWORD }}

- name: Build and sign DMG
  run: |
    export APPLE_DEVELOPER_IDENTITY="Developer ID Application: Your Name"
    bash scripts/build-dmg-release.sh
```

### Build for Intel Mac Too

Already included! The workflow has an optional `build-dmg-intel` job.

Enable it:

```yaml
if: github.event_name == 'workflow_dispatch' # Remove this line
```

Now it builds for both Apple Silicon and Intel!

---

## 💰 Cost Analysis

### GitHub Actions Pricing

**Public Repositories:**

- ✅ Unlimited minutes
- ✅ macOS runners included
- ✅ Free forever

**Private Repositories:**

- ✅ 2,000 minutes/month free
- ✅ macOS runner uses 10× multiplier
- ✅ Each build: ~150 minutes of quota
- ✅ ~13 free builds/month
- ⚠️ Extra: $0.08/minute (macOS)

**Cost per build (if over quota):**

- 15 min build × 10× multiplier = 150 min
- 150 min × $0.08 = **$12.00/build**

**Recommendation:** Use public repo or build locally for frequent releases

---

## 🐛 Troubleshooting

### Build Fails: "npm ci failed"

**Cause:** Package dependency issue

**Fix:**

1. Test locally: `npm ci`
2. Fix any errors
3. Commit and push
4. Re-run workflow

### Build Fails: "create-dmg not found"

**Cause:** Homebrew installation failed

**Fix:**

```yaml
# Add retry logic
- name: Install DMG tools
  run: |
    brew install create-dmg || brew install create-dmg
```

### DMG is Too Large (>1 GB)

**Cause:** Including all node_modules

**Fix:** Implement size optimization (see DMG_PACKAGING_GUIDE.md)

- Pre-build only native modules
- Exclude dev dependencies (already done)
- Use production build only

### Build Works but DMG Won't Install

**Cause:** Missing files or incorrect structure

**Fix:**

1. Download the artifact
2. Test on a Mac manually
3. Check logs in GitHub Actions
4. Fix issues locally
5. Push and rebuild

---

## 📊 Monitoring Builds

### View Build Status

1. Go to repo → "Actions" tab
2. See all workflow runs
3. Green ✅ = success
4. Red ❌ = failed
5. Yellow ⏳ = in progress

### View Logs

1. Click on a workflow run
2. Click "Build ARUS macOS DMG"
3. Expand any step to see logs
4. Download logs for debugging

### Get Notifications

1. Go to repo → Settings → Notifications
2. Enable email for failed workflows
3. Or install GitHub mobile app

---

## 🎯 Best Practices

### Versioning

Use semantic versioning:

```bash
git tag v1.0.0  # First release
git tag v1.0.1  # Bug fix
git tag v1.1.0  # New features
git tag v2.0.0  # Breaking changes
```

### Release Cadence

- ✅ Tag releases after testing
- ✅ Create pre-releases for testing
- ✅ Keep changelog updated
- ✅ Test DMG before announcing

### Testing

Before tagging:

1. Test locally on Mac
2. Verify all features work
3. Check installation process
4. Review release notes
5. Then create tag

---

## 🚀 Advanced: Multi-Architecture Builds

Build separate DMGs for Intel and Apple Silicon:

```yaml
strategy:
  matrix:
    runner: [macos-12, macos-14] # Intel and ARM
    include:
      - runner: macos-12
        arch: Intel
      - runner: macos-14
        arch: AppleSilicon

runs-on: ${{ matrix.runner }}
# Results in:
#   ARUS-1.0.0-macOS-Intel.dmg
#   ARUS-1.0.0-macOS-AppleSilicon.dmg
```

---

## 📝 Quick Reference

### Trigger a Build

```bash
# Create and push tag
git tag v1.0.0 && git push origin v1.0.0

# Manual trigger
# Go to Actions → Build macOS DMG → Run workflow
```

### Download Build

```bash
# Using GitHub CLI
gh release download v1.0.0

# Or visit
https://github.com/YOUR_USERNAME/YOUR_REPO/releases
```

### Update Workflow

```bash
# Edit workflow
nano .github/workflows/build-macos-dmg.yml

# Commit and push
git add .github/workflows/build-macos-dmg.yml
git commit -m "Update build workflow"
git push
```

---

## ✅ Checklist: First Release

- [ ] Push workflow file to GitHub
- [ ] Verify workflow appears in Actions tab
- [ ] Create version tag (v1.0.0)
- [ ] Push tag to GitHub
- [ ] Wait for build to complete (~15 min)
- [ ] Download artifact or release
- [ ] Test .dmg on a Mac
- [ ] Verify installation works
- [ ] Share release link with users

---

## 🎉 Summary

**Setup time:** 5 minutes  
**Build time:** 10-15 minutes  
**Cost:** Free (public repos)  
**Result:** Production-ready .dmg installer

**Command to start:**

```bash
git tag v1.0.0
git push origin v1.0.0
```

**That's it!** GitHub Actions does the rest! 🚀

---

## 📞 Support

**If builds fail:**

1. Check the Actions logs
2. Test the build script locally
3. Review error messages
4. Update and re-run

**For help:**

- Read the logs in Actions tab
- Check DMG_PACKAGING_GUIDE.md
- Review build scripts in scripts/

**The workflow is fully automated and production-ready!** ✅
