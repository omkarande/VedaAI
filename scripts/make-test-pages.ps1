Add-Type -AssemblyName System.Drawing

function New-Page {
  param([string]$Path, [string[]]$Lines, [string]$FontName = "Segoe UI", [int]$FontSize = 22)

  $bmp = New-Object System.Drawing.Bitmap 1000, 1400
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::White)
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $font = New-Object System.Drawing.Font($FontName, $FontSize)
  $brush = [System.Drawing.Brushes]::Black

  $y = 60
  foreach ($line in $Lines) {
    $g.DrawString($line, $font, $brush, 60, $y)
    $y += 52
  }

  $g.Dispose()
  $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "wrote $Path"
}

$dir = Join-Path $PSScriptRoot "..\test-samples"
New-Item -ItemType Directory -Force -Path $dir | Out-Null

New-Page -Path (Join-Path $dir "question-paper.png") -Lines @(
  "Class 10 Biology - Unit Test",
  "",
  "1. Define photosynthesis. (2 marks)",
  "",
  "2. Name the organelle where photosynthesis occurs. (1 mark)",
  "",
  "3. State two functions of the human heart. (2 marks)",
  "",
  "4. What is transpiration? (2 marks)",
  "",
  "5 (a). Define tidal volume. (1 mark)",
  "",
  "5 (b). Define residual volume. (1 mark)"
)

New-Page -Path (Join-Path $dir "answer-sheet.png") -FontName "Comic Sans MS" -FontSize 24 -Lines @(
  "Q2. Chloroplast",
  "",
  "Q1. Photosynthesis is how green plants",
  "make food using sunlight, CO2 and water.",
  "",
  "Q4. Transpiration is loss of water",
  "from the leaves of a plant.",
  "",
  "Q5 (a). Tidal volume is the air breathed",
  "in and out during normal breathing.",
  "",
  "The mitochondria makes energy for cells.",
  "(this was not asked in the paper)"
)
