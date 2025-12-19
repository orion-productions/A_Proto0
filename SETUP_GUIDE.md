# Complete Setup Guide for New Windows 11 Installation

This guide documents all the steps required to set up the development environment on a fresh Windows 11 installation.

## Prerequisites

- Windows 11
- Administrator access
- Internet connection

## Step-by-Step Installation

### 1. Install Git

**Using winget (recommended):**
```powershell
winget install Git.Git --accept-package-agreements --accept-source-agreements
```

**Or download manually:**
- Visit https://git-scm.com/download/win
- Download and run the installer
- Use default settings (recommended)
- Verify installation:
```powershell
git --version
```

**Note:** After installation, you may need to restart your terminal or refresh the PATH:
```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
```

**Configure Git (required before first commit):**
```powershell
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

Or configure only for this repository:
```powershell
git config user.name "Your Name"
git config user.email "your.email@example.com"
```

### 2. Install Node.js (LTS Version)

**Using winget (recommended):**
```powershell
winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
```

**Or download manually:**
- Visit https://nodejs.org/
- Download and install the LTS version
- Verify installation:
```powershell
node --version
npm --version
```

**Important:** This project requires Node.js 22.x (not 24.x) due to native module compatibility. If you installed Node 24, you'll need to:
1. Uninstall Node 24: `winget uninstall OpenJS.NodeJS.LTS`
2. Install Node 22: Download from https://nodejs.org/dist/v22.21.1/node-v22.21.1-x64.msi
3. Open a new PowerShell window to refresh PATH

### 3. Install Python 3.11+

**Using winget:**
```powershell
winget install Python.Python.3.11 --accept-package-agreements --accept-source-agreements --override "--InstallAllUsers=1 PrependPath=1"
```

**Or download manually:**
- Visit https://www.python.org/downloads/
- Download Python 3.11 or later
- **Important:** During installation, check "Add Python to PATH"
- Verify installation:
```powershell
python --version
```

### 4. Install FFmpeg

**Using winget:**
```powershell
winget install Gyan.FFmpeg --accept-package-agreements --accept-source-agreements
```

**Or using Chocolatey:**
```powershell
choco install ffmpeg
```

**Or download manually:**
- Visit https://ffmpeg.org/download.html
- Extract to `C:\ffmpeg`
- Add `C:\ffmpeg\bin` to your system PATH
- Verify installation:
```powershell
ffmpeg -version
```

### 5. Install Visual Studio Build Tools (Required for Native Modules)

This is required to compile native Node.js modules like `better-sqlite3`.

**Using winget:**
```powershell
winget install Microsoft.VisualStudio.2022.BuildTools --accept-package-agreements --accept-source-agreements --override "--quiet --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

**Manual installation:**
1. Download Visual Studio Build Tools from Microsoft
2. During installation, select "Desktop development with C++" workload
3. Ensure "C++ build tools" and "Windows 10/11 SDK" are included

**Verify installation:**
- The installer will prompt for administrator privileges
- After installation, verify C++ tools are available:
```powershell
& "C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
```

### 6. Install Ollama

**Download and install:**
- Visit https://ollama.ai
- Download the Windows installer
- Run the installer (this is a large download, ~1.15 GB)
- After installation, verify:
```powershell
ollama --version
```

**Pull the default model:**
```powershell
ollama pull qwen2.5:1.5b
```

### 7. Install Python Packages

Install Whisper for audio transcription:
```powershell
python -m pip install openai-whisper
```

This will also install required dependencies:
- torch
- torchaudio
- numpy
- tiktoken
- and others

**Note:** This is a large download and may take several minutes.

**Verify installation:**
```powershell
python -c "import whisper; print('Whisper installed successfully!')"
```

### 8. Install Project Dependencies

**Navigate to project directory:**
```powershell
cd C:\DEVSPACE\A_Proto0
```

**Install root dependencies:**
```powershell
npm install
```

**Install frontend dependencies:**
```powershell
cd frontend
npm install
cd ..
```

**Important:** If you encounter errors with `better-sqlite3` compilation:
1. Ensure Visual Studio Build Tools are fully installed (see step 4)
2. If using Node 24, switch to Node 22 (see step 1)
3. Rebuild the native module:
```powershell
npm rebuild better-sqlite3
```

### 9. Fix PowerShell Execution Policy (if needed)

If you encounter script execution errors:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
```

## Verification Steps

After completing all installations, verify everything works:

```powershell
# Check Git
git --version

# Check Node.js
node --version    # Should show v22.x.x
npm --version

# Check Python
python --version  # Should show Python 3.11.x or later

# Check FFmpeg
ffmpeg -version

# Check Ollama
ollama --version

# Check Whisper
python -c "import whisper; print('OK')"

# Check Visual Studio Build Tools
& "C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64
```

## Starting the Application

Once everything is installed:

1. **Start Ollama** (if not running as a service):
```powershell
ollama serve
```

2. **Start the application** (in a new terminal):
```powershell
cd C:\DEVSPACE\A_Proto0
npm run dev
```

3. **Access the application:**
- Backend: http://localhost:3002
- Frontend: http://localhost:5174

## Troubleshooting

### Node.js Version Issues

**Problem:** `better-sqlite3` fails to compile with Node 24  
**Solution:** Use Node 22 LTS instead. Node 24 requires C++20 which causes compilation issues.

### Python Not Found

**Problem:** `python --version` shows "Python was not found"  
**Solution:** 
- Reinstall Python and ensure "Add Python to PATH" is checked
- Restart PowerShell/terminal after installation
- Verify PATH includes Python installation directory

### Visual Studio Build Tools Not Found

**Problem:** `better-sqlite3` compilation fails with "Could not find Visual Studio"  
**Solution:**
- Ensure Build Tools are fully installed with C++ workload
- Open Visual Studio Installer and verify "Desktop development with C++" is installed
- May need to restart terminal after installation

### FFmpeg Not Found

**Problem:** Whisper transcription fails with "ffmpeg not found"  
**Solution:**
- Ensure FFmpeg is in your system PATH
- Restart terminal after adding to PATH
- Verify with `ffmpeg -version`

### Port Already in Use

**Problem:** Backend or frontend won't start  
**Solution:**
- Check if ports 3002 or 5174 are in use: `netstat -ano | findstr :3002`
- Kill the process using the port or change the port in configuration

## Summary of Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| Git | Latest | Version control |
| Node.js | 22.x LTS | JavaScript runtime |
| Python | 3.11+ | Whisper transcription |
| FFmpeg | Latest | Audio processing |
| Visual Studio Build Tools | 2022 | Native module compilation |
| Ollama | Latest | LLM inference |
| openai-whisper | Latest | Audio transcription |

## Next Steps

After setup is complete, refer to the main [README.md](README.md) for usage instructions and feature documentation.

