<#
.SYNOPSIS
    VeriCred Host Bootstrap and Prerequisite Installer
.DESCRIPTION
    Safely installs official Node.js LTS and/or MongoDB Community Server on fresh Windows PCs.
    Verifies Authenticode digital signatures before executing MSI installers.
    Requires Administrator privileges (requests UAC elevation if not elevated).
#>

[CmdletBinding()]
param (
    [switch]$InstallNode,
    [switch]$InstallMongoDB
)

$ErrorActionPreference = "Stop"

# Helper: Test for Administrator rights
function Test-IsAdministrator {
    $currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Helper: Elevate script if not already running as Admin
function Elevate-IfRequired {
    if (-not (Test-IsAdministrator)) {
        Write-Host "===============================================================" -ForegroundColor Yellow
        Write-Host "Administrator privileges are required to configure system software." -ForegroundColor Yellow
        Write-Host "Requesting Windows User Account Control (UAC) elevation..." -ForegroundColor Yellow
        Write-Host "===============================================================" -ForegroundColor Yellow
        
        $scriptPath = $MyInvocation.MyCommand.Definition
        $argList = "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""
        if ($InstallNode) { $argList += " -InstallNode" }
        if ($InstallMongoDB) { $argList += " -InstallMongoDB" }
        
        try {
            $proc = Start-Process -FilePath "powershell.exe" -ArgumentList $argList -Verb RunAs -Wait -PassThru
            exit $proc.ExitCode
        } catch {
            Write-Error "Administrator elevation was denied by user. Setup cannot proceed automatically."
            exit 1
        }
    }
}

# Helper: Verify official Authenticode digital signature
function Test-MsiSignature {
    param ([string]$FilePath, [string]$ExpectedSubjectPattern)
    
    Write-Host "Verifying Authenticode digital signature on installer..." -ForegroundColor Cyan
    $sig = Get-AuthenticodeSignature -FilePath $FilePath
    if ($sig.Status -ne "Valid") {
        throw "Signature verification failed for $FilePath. Status: $($sig.Status). Installation aborted for security."
    }
    
    if ($ExpectedSubjectPattern -and ($sig.SignerCertificate.Subject -notmatch $ExpectedSubjectPattern)) {
        throw "Signature subject mismatch. Expected pattern '$ExpectedSubjectPattern', found '$($sig.SignerCertificate.Subject)'."
    }
    
    Write-Host "[OK] Digital signature is valid and verified ($($sig.SignerCertificate.Subject))" -ForegroundColor Green
}

# Function: Install Node.js LTS
function Install-NodeJsLts {
    Write-Host "`n[STEP] Preparing Node.js LTS installation..." -ForegroundColor Cyan
    
    # Official Node.js LTS v20.18.0 x64 MSI
    $nodeUrl = "https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi"
    $tempDir = [System.IO.Path]::GetTempPath()
    $msiPath = Join-Path $tempDir "node-v20.18.0-x64.msi"
    
    Write-Host "Downloading official Node.js LTS MSI from nodejs.org..." -ForegroundColor Cyan
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
    Invoke-WebRequest -Uri $nodeUrl -OutFile $msiPath -UseBasicParsing
    
    # Verify signature from OpenJS Foundation
    Test-MsiSignature -FilePath $msiPath -ExpectedSubjectPattern "OpenJS Foundation"
    
    Write-Host "Executing silent installation of Node.js LTS..." -ForegroundColor Cyan
    $proc = Start-Process -FilePath "msiexec.exe" -ArgumentList "/i `"$msiPath`" /qn /norestart" -Wait -PassThru
    if ($proc.ExitCode -ne 0 -and $proc.ExitCode -ne 3010) {
        throw "msiexec for Node.js exited with failure code $($proc.ExitCode)"
    }
    
    Write-Host "[OK] Node.js LTS successfully installed." -ForegroundColor Green
    Remove-Item -Path $msiPath -Force -ErrorAction SilentlyContinue
}

# Function: Install MongoDB Community Server
function Install-MongoDbCommunity {
    Write-Host "`n[STEP] Preparing MongoDB Community Server installation..." -ForegroundColor Cyan
    
    # Official MongoDB Community Server v7.0.14 x64 MSI
    $mongoUrl = "https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-7.0.14-signed.msi"
    $tempDir = [System.IO.Path]::GetTempPath()
    $msiPath = Join-Path $tempDir "mongodb-windows-x86_64-7.0.14-signed.msi"
    
    Write-Host "Downloading official MongoDB Community Server MSI from fastdl.mongodb.org..." -ForegroundColor Cyan
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
    Invoke-WebRequest -Uri $mongoUrl -OutFile $msiPath -UseBasicParsing
    
    # Verify signature from MongoDB, Inc.
    Test-MsiSignature -FilePath $msiPath -ExpectedSubjectPattern "MongoDB"
    
    Write-Host "Executing silent installation of MongoDB Community Server Windows Service..." -ForegroundColor Cyan
    $proc = Start-Process -FilePath "msiexec.exe" -ArgumentList "/i `"$msiPath`" ADDLOCAL=`"ServerService,Client`" SHOULD_INSTALL_COMPASS=`"0`" /qn /norestart" -Wait -PassThru
    if ($proc.ExitCode -ne 0 -and $proc.ExitCode -ne 3010) {
        throw "msiexec for MongoDB exited with failure code $($proc.ExitCode)"
    }
    
    # Verify and start service
    Start-Sleep -Seconds 2
    $service = Get-Service -Name MongoDB -ErrorAction SilentlyContinue
    if ($service) {
        if ($service.Status -ne "Running") {
            Write-Host "Starting MongoDB Windows Service..." -ForegroundColor Cyan
            Start-Service -Name MongoDB
        }
        Write-Host "[OK] MongoDB Windows Service is active and running." -ForegroundColor Green
    } else {
        Write-Warning "MongoDB service was installed but service query failed. Please verify in services.msc."
    }
    
    Remove-Item -Path $msiPath -Force -ErrorAction SilentlyContinue
}

# Main Execution Flow
try {
    Elevate-IfRequired

    # Default action if no switch provided is InstallNode
    if (-not $InstallNode -and -not $InstallMongoDB) {
        $InstallNode = $true
    }

    if ($InstallNode) {
        Install-NodeJsLts
    }

    if ($InstallMongoDB) {
        Install-MongoDbCommunity
    }

    Write-Host "`n===============================================================" -ForegroundColor Green
    Write-Host "[OK] Host bootstrap completed successfully." -ForegroundColor Green
    Write-Host "===============================================================" -ForegroundColor Green
    exit 0
} catch {
    Write-Error "Bootstrap failed: $($_.Exception.Message)"
    exit 1
}

