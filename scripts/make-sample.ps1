# Generates an original technical calibration image and a small portable demo map.
# No Blender, external art or AI-generated image dependency is required.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$sampleDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'samples'
New-Item -ItemType Directory -Path $sampleDir -Force | Out-Null
$bitmap = [System.Drawing.Bitmap]::new(1024, 512)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$background = [System.Drawing.Drawing2D.LinearGradientBrush]::new([System.Drawing.Point]::new(0, 0), [System.Drawing.Point]::new(1024, 512), [System.Drawing.Color]::FromArgb(15, 38, 56), [System.Drawing.Color]::FromArgb(27, 85, 94))
$graphics.FillRectangle($background, 0, 0, 1024, 512)
$pen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(65, 178, 180), 2)
for ($x = 0; $x -le 1024; $x += 64) { $graphics.DrawLine($pen, $x, 0, $x, 512) }
for ($y = 0; $y -le 512; $y += 64) { $graphics.DrawLine($pen, 0, $y, 1024, $y) }
$font = [System.Drawing.Font]::new('Segoe UI', 44, [System.Drawing.FontStyle]::Bold)
$small = [System.Drawing.Font]::new('Segoe UI', 17)
$white = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(226, 254, 246))
$graphics.DrawString('TURN TO EXPLORE', $font, $white, 150, 168)
$graphics.DrawString('LEFT', $small, $white, 32, 35)
$graphics.DrawString('CENTRE', $small, $white, 464, 35)
$graphics.DrawString('RIGHT', $small, $white, 910, 35)
$graphics.DrawString('An ordinary 2D image on a curved 3D panel', $small, $white, 260, 284)
$png = Join-Path $sampleDir 'panorama-grid.png'
$bitmap.Save($png, [System.Drawing.Imaging.ImageFormat]::Png)
$white.Dispose(); $font.Dispose(); $small.Dispose(); $pen.Dispose(); $background.Dispose(); $graphics.Dispose(); $bitmap.Dispose()

function New-Entity([string]$kind, [float[]]$position, [int]$color) {
    return [ordered]@{
        id = [guid]::NewGuid().ToString(); type = $kind; brush = 'Pen'; position = $position
        normal = @(0,0,1); yaw = 0; scale = 1; width = 0.018; alpha = 1
        arc = 150; panelWidth = 2.8; aspect = 2; color = $color
        wet = $false; surface = $false; image = ''; points = @()
    }
}
$image = New-Entity 'image' @(0,1.5,0) -1
$image.image = [Convert]::ToBase64String([IO.File]::ReadAllBytes($png))
$start = New-Entity 'start' @(-0.65,0.6,1.2) -10360634
$checkpoint = New-Entity 'checkpoint' @(0,0.6,1.2) -6056449
$goal = New-Entity 'goal' @(0.65,0.6,1.2) -23449
$stroke = New-Entity 'stroke' @(-0.8,0.95,0.8) -10360634
$stroke.wet = $true
$stroke.brush = 'Water'
$stroke.width = 0.035
$points = [Collections.Generic.List[object]]::new()
for($i = 0; $i -le 90; $i++) {
    $u = $i / 90.0
    $points.Add(@([float]($u * 1.6), [float]([Math]::Sin($u * [Math]::PI * 4) * 0.08), [float]([Math]::Sin($u * [Math]::PI * 2) * 0.1), 1))
}
$stroke.points = $points.ToArray()
$document = [ordered]@{version=1;units='metres';coordinates='right-handed-y-up';alignment='manual-origin-required';entities=@($image,$start,$checkpoint,$goal,$stroke)}
$json = $document | ConvertTo-Json -Depth 12 -Compress
[IO.File]::WriteAllText((Join-Path $sampleDir 'starter-map.json'), $json, [Text.UTF8Encoding]::new($false))
