# PowerShell Script to Convert Images to WebP Format
# Usage: .\scripts\convert-to-webp.ps1 -InputPath "path/to/image.png" [-Quality 85] [-OutputPath "path/to/output.webp"]
#        .\scripts\convert-to-webp.ps1 -InputPath "path/to/folder" -Batch

param(
    [Parameter(Mandatory=$true)]
    [string]$InputPath,
    
    [Parameter(Mandatory=$false)]
    [string]$OutputPath = "",
    
    [Parameter(Mandatory=$false)]
    [int]$Quality = 85,
    
    [Parameter(Mandatory=$false)]
    [switch]$Batch
)

# Check if cwebp is available (Google's WebP encoder)
function Test-CWebP {
    try {
        $null = & cwebp -version 2>&1
        return $true
    }
    catch {
        return $false
    }
}

# Install cwebp instructions
function Show-InstallInstructions {
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host "  WebP Encoder (cwebp) Not Found" -ForegroundColor Yellow
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "To convert images to WebP, you need to install cwebp." -ForegroundColor White
    Write-Host ""
    Write-Host "Option 1 - Using Chocolatey (Recommended):" -ForegroundColor Green
    Write-Host "  choco install webp" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Option 2 - Manual Download:" -ForegroundColor Green
    Write-Host "  1. Download from: https://developers.google.com/speed/webp/download" -ForegroundColor Gray
    Write-Host "  2. Extract and add to PATH" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Option 3 - Using npm:" -ForegroundColor Green
    Write-Host "  npm install -g cwebp-bin" -ForegroundColor Gray
    Write-Host ""
    Write-Host "After installation, run this script again." -ForegroundColor White
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host ""
}

# Convert a single image
function Convert-ImageToWebP {
    param(
        [string]$InputFile,
        [string]$OutputFile,
        [int]$Quality
    )
    
    if (-not (Test-Path $InputFile)) {
        Write-Host "Error: Input file not found: $InputFile" -ForegroundColor Red
        return $false
    }
    
    # If no output path specified, create one
    if ([string]::IsNullOrEmpty($OutputFile)) {
        $dir = Split-Path $InputFile -Parent
        $name = [System.IO.Path]::GetFileNameWithoutExtension($InputFile)
        $OutputFile = Join-Path $dir "$name.webp"
    }
    
    # Get file info
    $inputInfo = Get-Item $InputFile
    $inputSizeKB = [math]::Round($inputInfo.Length / 1KB, 2)
    
    Write-Host "Converting: $($inputInfo.Name)" -ForegroundColor Cyan
    Write-Host "  Input size: $inputSizeKB KB" -ForegroundColor Gray
    
    try {
        # Run cwebp conversion
        $result = & cwebp -q $Quality $InputFile -o $OutputFile 2>&1
        
        if (Test-Path $OutputFile) {
            $outputInfo = Get-Item $OutputFile
            $outputSizeKB = [math]::Round($outputInfo.Length / 1KB, 2)
            $savings = [math]::Round((1 - ($outputSizeKB / $inputSizeKB)) * 100, 1)
            
            Write-Host "  ✓ Output: $($outputInfo.Name)" -ForegroundColor Green
            Write-Host "  ✓ Output size: $outputSizeKB KB" -ForegroundColor Green
            Write-Host "  ✓ Savings: $savings%" -ForegroundColor Green
            Write-Host ""
            
            return $true
        }
        else {
            Write-Host "  ✗ Conversion failed" -ForegroundColor Red
            Write-Host ""
            return $false
        }
    }
    catch {
        Write-Host "  ✗ Error: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host ""
        return $false
    }
}

# Main execution
if (-not (Test-CWebP)) {
    Show-InstallInstructions
    exit 1
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  WebP Image Converter" -ForegroundColor White
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

if ($Batch) {
    # Batch convert all images in folder
    if (-not (Test-Path $InputPath -PathType Container)) {
        Write-Host "Error: Path is not a directory: $InputPath" -ForegroundColor Red
        exit 1
    }
    
    $images = Get-ChildItem -Path $InputPath -Include *.png,*.jpg,*.jpeg -Recurse
    $total = $images.Count
    $success = 0
    
    Write-Host "Found $total image(s) to convert" -ForegroundColor Yellow
    Write-Host ""
    
    foreach ($image in $images) {
        if (Convert-ImageToWebP -InputFile $image.FullName -OutputFile "" -Quality $Quality) {
            $success++
        }
    }
    
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host "  Conversion Complete: $success/$total succeeded" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host ""
}
else {
    # Convert single image
    $result = Convert-ImageToWebP -InputFile $InputPath -OutputFile $OutputPath -Quality $Quality
    
    if ($result) {
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
        Write-Host "  Conversion Successful!" -ForegroundColor Green
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
        Write-Host ""
    }
    else {
        exit 1
    }
}

