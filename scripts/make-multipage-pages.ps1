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

New-Page -Path (Join-Path $dir "question-multipage.png") -Lines @(
  "Class 10 Biology - Unit Test",
  "",
  "1. Name the organelle where photosynthesis occurs. (1 mark)",
  "",
  "2. Describe the structure and function of the",
  "   human heart. (5 marks)",
  "",
  "3. What is transpiration? (2 marks)"
)

# Answer sheet page 1: Q1 answered, then Q2's long answer begins at the bottom.
New-Page -Path (Join-Path $dir "answer-p1.png") -FontName "Comic Sans MS" -FontSize 24 -Lines @(
  "Q1. Chloroplast",
  "",
  "",
  "",
  "",
  "",
  "",
  "Q2. The human heart pumps blood around",
  "the body. It has four chambers, the right",
  "atrium and right ventricle take blood to"
)

# Page 2: the SAME Q2 answer continues from page 1.
New-Page -Path (Join-Path $dir "answer-p2.png") -FontName "Comic Sans MS" -FontSize 24 -Lines @(
  "the lungs, and the left atrium and left",
  "ventricle push blood to the rest of the body.",
  "It also keeps blood flowing in one direction",
  "using valves.",
  "",
  "",
  "Q3. Transpiration is loss of water vapour",
  "from the leaves of a plant."
)
