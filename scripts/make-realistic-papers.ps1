# Generates a printed question paper and a two-page handwritten answer sheet
# with hand-drawn biology diagrams. Content is fixed so the mapping result can
# be checked against known expectations.

Add-Type -AssemblyName System.Drawing

$W = 1240
$H = 1754
$script:rand = New-Object System.Random 20260826

$InkColour = [System.Drawing.Color]::FromArgb(28, 52, 122)
$PencilColour = [System.Drawing.Color]::FromArgb(40, 60, 130)

function Jitter([double]$amount) {
  return ($script:rand.NextDouble() - 0.5) * 2 * $amount
}

function New-Pen([System.Drawing.Color]$colour, [single]$width) {
  $pen = New-Object System.Drawing.Pen $colour, $width
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  return $pen
}

# A straight line drawn as a slightly wobbly curve so it reads as pen on paper.
function Draw-HandLine($g, $pen, [double]$x1, [double]$y1, [double]$x2, [double]$y2) {
  $steps = 6
  $points = @()
  for ($i = 0; $i -le $steps; $i++) {
    $t = $i / $steps
    $x = $x1 + ($x2 - $x1) * $t + (Jitter 1.4)
    $y = $y1 + ($y2 - $y1) * $t + (Jitter 1.4)
    $points += (New-Object System.Drawing.PointF([single]$x, [single]$y))
  }
  $g.DrawCurve($pen, [System.Drawing.PointF[]]$points, 0.4)
}

function Draw-HandRect($g, $pen, [double]$x, [double]$y, [double]$w, [double]$h) {
  Draw-HandLine $g $pen $x $y ($x + $w) $y
  Draw-HandLine $g $pen ($x + $w) $y ($x + $w) ($y + $h)
  Draw-HandLine $g $pen ($x + $w) ($y + $h) $x ($y + $h)
  Draw-HandLine $g $pen $x ($y + $h) $x $y
}

function Draw-HandEllipse($g, $pen, [double]$cx, [double]$cy, [double]$rx, [double]$ry) {
  $points = @()
  for ($a = 0; $a -le 360; $a += 15) {
    $rad = $a * [Math]::PI / 180
    $x = $cx + [Math]::Cos($rad) * ($rx + (Jitter 2))
    $y = $cy + [Math]::Sin($rad) * ($ry + (Jitter 2))
    $points += (New-Object System.Drawing.PointF([single]$x, [single]$y))
  }
  $g.DrawCurve($pen, [System.Drawing.PointF[]]$points, 0.5)
}

function Draw-Arrow($g, $pen, [double]$x1, [double]$y1, [double]$x2, [double]$y2) {
  Draw-HandLine $g $pen $x1 $y1 $x2 $y2
  $angle = [Math]::Atan2($y2 - $y1, $x2 - $x1)
  $len = 14
  foreach ($spread in @(2.6, -2.6)) {
    $ax = $x2 - $len * [Math]::Cos($angle + $spread)
    $ay = $y2 - $len * [Math]::Sin($angle + $spread)
    Draw-HandLine $g $pen $x2 $y2 $ax $ay
  }
}

# Draws one line of handwriting with a small random tilt.
function Draw-Hand($g, [string]$text, [double]$x, [double]$y, [int]$size = 25,
                   [System.Drawing.Color]$colour = $InkColour, [string]$face = "Ink Free") {
  if ([string]::IsNullOrWhiteSpace($text)) { return }
  $font = New-Object System.Drawing.Font($face, $size)
  $brush = New-Object System.Drawing.SolidBrush $colour
  $state = $g.Save()
  $g.TranslateTransform([single]($x + (Jitter 2)), [single]($y + (Jitter 1.5)))
  $g.RotateTransform([single](Jitter 0.5))
  $g.DrawString($text, $font, $brush, 0, 0)
  $g.Restore($state)
  $font.Dispose()
  $brush.Dispose()
}

function Draw-HandBlock($g, [string[]]$lines, [double]$x, [double]$y, [int]$size = 25, [int]$leading = 46) {
  $cursor = $y
  foreach ($line in $lines) {
    Draw-Hand $g $line $x $cursor $size
    $cursor += $leading
  }
  return $cursor
}

function Draw-RuledPaper($g) {
  $g.Clear([System.Drawing.Color]::FromArgb(252, 251, 246))
  $rule = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(205, 219, 236)), 1.4
  for ($y = 132; $y -lt $H - 60; $y += 46) {
    $g.DrawLine($rule, 60, $y, $W - 60, $y)
  }
  $rule.Dispose()
  $margin = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(233, 176, 178)), 2
  $g.DrawLine($margin, 112, 40, 112, $H - 40)
  $margin.Dispose()
}

# --- Diagrams -------------------------------------------------------------

function Draw-Photosynthesis($g, [double]$ox, [double]$oy) {
  $pen = New-Pen $PencilColour 2.2

  # Sun with rays.
  Draw-HandEllipse $g $pen ($ox + 60) ($oy + 40) 26 26
  for ($a = 0; $a -lt 360; $a += 45) {
    $rad = $a * [Math]::PI / 180
    Draw-HandLine $g $pen ($ox + 60 + [Math]::Cos($rad) * 34) ($oy + 40 + [Math]::Sin($rad) * 34) `
                          ($ox + 60 + [Math]::Cos($rad) * 50) ($oy + 40 + [Math]::Sin($rad) * 50)
  }
  Draw-Hand $g "Sunlight" ($ox + 118) ($oy + 18) 20

  # Plant: stem, two leaves at different heights, roots.
  $stemX = $ox + 330
  Draw-HandLine $g $pen $stemX ($oy + 56) $stemX ($oy + 210)

  # side, baseY, tipY
  foreach ($leaf in @(@(-1, 96, 92), @(1, 146, 142))) {
    $side = $leaf[0]
    $baseY = $oy + $leaf[1]
    $tipY = $oy + $leaf[2]
    $points = @(
      (New-Object System.Drawing.PointF([single]$stemX, [single]$baseY)),
      (New-Object System.Drawing.PointF([single]($stemX + 42 * $side), [single]($tipY - 26))),
      (New-Object System.Drawing.PointF([single]($stemX + 82 * $side), [single]$tipY)),
      (New-Object System.Drawing.PointF([single]($stemX + 42 * $side), [single]($tipY + 24))),
      (New-Object System.Drawing.PointF([single]$stemX, [single]$baseY))
    )
    $g.DrawCurve($pen, [System.Drawing.PointF[]]$points, 0.5)
  }
  foreach ($dx in @(-46, -16, 16, 46)) {
    Draw-HandLine $g $pen $stemX ($oy + 210) ($stemX + $dx) ($oy + 262)
  }

  # Inputs on the left, outputs on the right.
  Draw-Arrow $g $pen ($ox + 112) ($oy + 66) ($stemX - 70) ($oy + 84)
  Draw-Hand $g "CO2" ($ox + 150) ($oy + 168) 20
  Draw-Arrow $g $pen ($ox + 214) ($oy + 176) ($stemX - 74) ($oy + 104)
  Draw-Hand $g "O2" ($ox + 500) ($oy + 122) 20
  Draw-Arrow $g $pen ($stemX + 86) ($oy + 142) ($ox + 468) ($oy + 138)
  Draw-Hand $g "Water" ($ox + 440) ($oy + 226) 20
  Draw-Arrow $g $pen ($ox + 434) ($oy + 240) ($stemX + 44) ($oy + 252)

  $pen.Dispose()
}

function Draw-Heart($g, [double]$ox, [double]$oy) {
  $pen = New-Pen $PencilColour 2.2

  # Outline.
  $outline = @(
    @(120, 10), @(178, 34), @(196, 104), @(170, 190), @(112, 246),
    @(54, 190), @(28, 104), @(46, 34), @(120, 10)
  ) | ForEach-Object {
    New-Object System.Drawing.PointF([single]($ox + $_[0]), [single]($oy + $_[1]))
  }
  $g.DrawCurve($pen, [System.Drawing.PointF[]]$outline, 0.45)

  # Septum and the valve line, making four chambers.
  Draw-HandLine $g $pen ($ox + 112) ($oy + 22) ($ox + 112) ($oy + 236)
  Draw-HandLine $g $pen ($ox + 36) ($oy + 108) ($ox + 190) ($oy + 108)

  # Great vessels.
  Draw-HandLine $g $pen ($ox + 92) ($oy + 16) ($ox + 78) ($oy - 34)
  Draw-HandLine $g $pen ($ox + 136) ($oy + 16) ($ox + 152) ($oy - 34)
  Draw-Hand $g "Aorta" ($ox + 150) ($oy - 74) 19

  Draw-Hand $g "RA" ($ox + 58) ($oy + 52) 19
  Draw-Hand $g "LA" ($ox + 132) ($oy + 52) 19
  Draw-Hand $g "RV" ($ox + 58) ($oy + 150) 19
  Draw-Hand $g "LV" ($ox + 132) ($oy + 150) 19

  $pen.Dispose()
}

function Draw-PlantCell($g, [double]$ox, [double]$oy) {
  $pen = New-Pen $PencilColour 2.2

  Draw-HandRect $g $pen $ox $oy 300 190
  Draw-HandRect $g $pen ($ox + 10) ($oy + 10) 280 170
  Draw-Hand $g "Cell wall" ($ox + 310) ($oy + 2) 19

  Draw-HandEllipse $g $pen ($ox + 78) ($oy + 78) 34 28
  Draw-Hand $g "Nucleus" ($ox + 6) ($oy + 200) 19
  Draw-Arrow $g $pen ($ox + 66) ($oy + 200) ($ox + 78) ($oy + 110)

  foreach ($spot in @(@(180, 52), @(232, 96), @(150, 132), @(236, 40))) {
    Draw-HandEllipse $g $pen ($ox + $spot[0]) ($oy + $spot[1]) 22 12
  }
  Draw-Arrow $g $pen ($ox + 330) ($oy + 96) ($ox + 254) ($oy + 96)
  Draw-Hand $g "Chloroplast" ($ox + 336) ($oy + 78) 19

  $pen.Dispose()
}

function Draw-EquationBox($g, [double]$x, [double]$y) {
  $pen = New-Pen $PencilColour 2
  Draw-HandRect $g $pen $x $y 640 96
  Draw-Hand $g "6CO2 + 6H2O" ($x + 30) ($y + 26) 24
  Draw-Hand $g "light" ($x + 268) ($y + 6) 18
  Draw-Arrow $g $pen ($x + 254) ($y + 52) ($x + 356) ($y + 52)
  Draw-Hand $g "C6H12O6 + 6O2" ($x + 378) ($y + 26) 24
  $pen.Dispose()
}

# --- Pages ----------------------------------------------------------------

function Save-Bitmap($bmp, [string]$path) {
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Host "wrote $path"
}

function New-QuestionPaper([string]$path) {
  $bmp = New-Object System.Drawing.Bitmap $W, $H
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $g.Clear([System.Drawing.Color]::White)

  $black = [System.Drawing.Brushes]::Black
  $title = New-Object System.Drawing.Font("Cambria", 30, [System.Drawing.FontStyle]::Bold)
  $meta = New-Object System.Drawing.Font("Cambria", 17)
  $body = New-Object System.Drawing.Font("Cambria", 19)

  $g.DrawString("Class 10 - Biology Unit Test", $title, $black, 92, 78)
  $g.DrawString("Time: 1 hour", $meta, $black, 92, 138)
  $g.DrawString("Maximum marks: 19", $meta, $black, 92, 172)
  $divider = New-Object System.Drawing.Pen ([System.Drawing.Color]::Black), 1.5
  $g.DrawLine($divider, 92, 212, $W - 92, 212)
  $g.DrawString("Answer all questions. Draw diagrams where asked.", $meta, $black, 92, 226)

  $questions = @(
    @("1.", @("Define photosynthesis and write its balanced chemical", "equation. (3 marks)")),
    @("2.", @("Draw a labelled diagram of the human heart showing its", "four chambers and the aorta. (5 marks)")),
    @("3.", @("State two functions of the human heart. (2 marks)")),
    @("4.", @("What is transpiration? Name two factors that increase", "its rate. (3 marks)")),
    @("5 (a).", @("Define tidal volume. (1 mark)")),
    @("5 (b).", @("Define residual volume. (1 mark)")),
    @("6.", @("Draw a labelled diagram of a plant cell and mark the", "chloroplast. (4 marks)"))
  )

  $y = 300
  foreach ($item in $questions) {
    $g.DrawString($item[0], $body, $black, 92, $y)
    $textY = $y
    foreach ($line in $item[1]) {
      $g.DrawString($line, $body, $black, 200, $textY)
      $textY += 38
    }
    $y = $textY + 30
  }

  $title.Dispose(); $meta.Dispose(); $body.Dispose(); $divider.Dispose()
  $g.Dispose()
  Save-Bitmap $bmp $path
  $bmp.Dispose()
}

function New-AnswerPage1([string]$path) {
  $bmp = New-Object System.Drawing.Bitmap $W, $H
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  Draw-RuledPaper $g

  Draw-Hand $g "Name: Aarav Sharma" 140 66 22
  Draw-Hand $g "Roll No. 24" 900 66 22

  # Answered out of order: question 4 is written before question 1.
  Draw-Hand $g "Q4." 140 148 25
  $null = Draw-HandBlock $g @(
    "Transpiration is the loss of water in the form of",
    "water vapour from the leaves of a plant through",
    "the stomata. High temperature and moving wind",
    "both increase the rate of transpiration."
  ) 230 148 25

  Draw-Hand $g "Q1." 140 356 25
  $null = Draw-HandBlock $g @(
    "Photosynthesis is the process by which green",
    "plants prepare their own food using sunlight,",
    "carbon dioxide and water in the chloroplast."
  ) 230 356 25

  Draw-EquationBox $g 236 500
  Draw-Photosynthesis $g 210 626

  # Question 2 begins here and runs over onto the second page.
  Draw-Hand $g "Q2." 140 950 25
  $null = Draw-HandBlock $g @(
    "The human heart is a muscular organ which pumps",
    "blood to the whole body. It has four chambers -",
    "the right atrium, right ventricle, left atrium and",
    "left ventricle. The diagram is drawn below."
  ) 230 950 25

  Draw-Heart $g 320 1200
  Draw-Hand $g "(continued on next page)" 620 1420 20

  $g.Dispose()
  Save-Bitmap $bmp $path
  $bmp.Dispose()
}

function New-AnswerPage2([string]$path) {
  $bmp = New-Object System.Drawing.Bitmap $W, $H
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  Draw-RuledPaper $g

  # The rest of question 2, with no fresh number written.
  $null = Draw-HandBlock $g @(
    "The right side of the heart carries deoxygenated",
    "blood to the lungs and the left side pumps the",
    "oxygenated blood into the aorta, which carries it",
    "to the rest of the body. Valves stop the blood",
    "from flowing backwards."
  ) 230 120 25

  Draw-Hand $g "Q6." 140 380 25
  $null = Draw-HandBlock $g @(
    "A plant cell has a cell wall outside the cell",
    "membrane. The chloroplast contains chlorophyll."
  ) 230 380 25
  Draw-PlantCell $g 300 490

  Draw-Hand $g "Q5 (a)." 140 760 25
  $null = Draw-HandBlock $g @(
    "Tidal volume is the volume of air breathed in or",
    "out during one normal quiet breath."
  ) 300 760 25

  # Not asked anywhere on the paper, so this should end up unmatched.
  $null = Draw-HandBlock $g @(
    "The mitochondria is the powerhouse of the cell",
    "and it releases energy during respiration."
  ) 230 920 25

  $g.Dispose()
  Save-Bitmap $bmp $path
  $bmp.Dispose()
}

$dir = Join-Path $PSScriptRoot "..\test-samples"
New-Item -ItemType Directory -Force -Path $dir | Out-Null

New-QuestionPaper (Join-Path $dir "real-question-paper.png")
New-AnswerPage1 (Join-Path $dir "real-answer-p1.png")
New-AnswerPage2 (Join-Path $dir "real-answer-p2.png")
