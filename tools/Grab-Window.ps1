<#
.SYNOPSIS
  Capture a window to PNG by title substring. Works over RDP.

.DESCRIPTION
  Power BI reports project-load failures in an "Issues were found" dialog whose
  contents are not exposed to UI Automation — the only way to read it is to look
  at it. Over RDP that is awkward:

    * Electron's desktopCapturer returns no screen sources.
    * Graphics.CopyFromScreen fails with "The handle is invalid" from a session
      that is not attached to the interactive desktop.

  PrintWindow asks the window to render itself into a device context instead of
  reading the screen, so it needs neither. PW_RENDERFULLCONTENT (flag 2) is
  required for WPF / DirectComposition surfaces such as Power BI's dialogs.

  This is read-only and non-intrusive: nothing is focused, moved or clicked, and
  the interactive user's screen is unaffected.

.EXAMPLE
  .\tools\Grab-Window.ps1 -TitleLike "Issues were found"
  .\tools\Grab-Window.ps1 -TitleLike "Power BI Desktop" -Out .\pbi.png
#>
param(
  [Parameter(Mandatory=$true)][string]$TitleLike,
  [string]$Out = "$env:TEMP\window.png"
)
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;using System.Text;using System.Runtime.InteropServices;using System.Collections.Generic;
public class PWGrab {
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint flags);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] static extern int GetWindowText(IntPtr h, StringBuilder s, int m);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  public struct RECT { public int Left, Top, Right, Bottom; }
  delegate bool EnumProc(IntPtr h, IntPtr l);
  public static List<object[]> Find(string sub){ var r = new List<object[]>();
    EnumWindows((h,l)=>{ if(!IsWindowVisible(h)) return true;
      var sb=new StringBuilder(512); GetWindowText(h,sb,512);
      if(sb.Length>0 && sb.ToString().ToLower().Contains(sub.ToLower())) r.Add(new object[]{h, sb.ToString()});
      return true; }, IntPtr.Zero);
    return r; }
}
"@ -ErrorAction SilentlyContinue

$hits = [PWGrab]::Find($TitleLike)
if ($hits.Count -eq 0) { Write-Warning "no visible window matching '$TitleLike'"; exit 1 }

$i = 0
foreach ($hit in $hits) {
  $h = [IntPtr]$hit[0]; $title = [string]$hit[1]
  $r = New-Object PWGrab+RECT
  [void][PWGrab]::GetWindowRect($h, [ref]$r)
  $w = $r.Right - $r.Left; $ht = $r.Bottom - $r.Top
  if ($w -le 0 -or $ht -le 0) { Write-Warning "skipping '$title' (zero size)"; continue }

  $bmp = New-Object System.Drawing.Bitmap $w, $ht
  $g   = [System.Drawing.Graphics]::FromImage($bmp)
  $hdc = $g.GetHdc()
  $ok  = [PWGrab]::PrintWindow($h, $hdc, 2)
  $g.ReleaseHdc($hdc); $g.Dispose()

  $path = if ($hits.Count -eq 1) { $Out } else { $Out -replace '\.png$', "_$i.png" }
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  "[$ok] '$title'  ${w}x${ht}  -> $path"
  $i++
}
