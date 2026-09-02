<#
.SYNOPSIS
  Validate the semantic model's TMDL without opening Power BI Desktop.

.DESCRIPTION
  Loads Power BI Desktop's own TMDL parser (Microsoft.AnalysisServices.Tabular.TmdlSerializer,
  shipped in Microsoft.PowerBI.Tabular.dll) and deserializes definition/ from disk.

  This is the fast feedback loop: it reports the exact parser error in about a
  second, where opening the .pbip takes ~90s and shows only an "Issues were
  found" dialog whose contents are not exposed to UI Automation.

  It caught a real bug: `///` doc comments were being emitted above each
  `relationship`, but TMDL maps those to a Description property and
  Relationship has none, so the whole file was rejected with
  "Property 'description' is unknown and is not expected in the situation it appears."

  Note this validates SYNTAX and structure only. Power BI additionally applies
  semantic checks and data-source consent at load time.

.EXAMPLE
  .\tools\Validate-Tmdl.ps1
#>
[CmdletBinding()]
param(
  [string]$DefinitionPath = (Join-Path $PSScriptRoot '..\Snowflake_Arabian_Shield_Gold_model.SemanticModel\definition')
)

$ErrorActionPreference = 'Stop'

# WindowsApps is ACL-restricted, so it cannot be enumerated with Get-ChildItem
# even though direct paths under it are readable. Ask the package manager instead.
$bin = $null
$pkg = Get-AppxPackage -Name 'Microsoft.MicrosoftPowerBIDesktop' -ErrorAction SilentlyContinue |
       Sort-Object Version -Descending | Select-Object -First 1
if ($pkg) { $bin = Join-Path $pkg.InstallLocation 'bin' }
if (-not $bin -or -not (Test-Path $bin)) { $bin = 'C:\Program Files\Microsoft Power BI Desktop\bin' }
if (-not (Test-Path $bin)) { Write-Error "Power BI Desktop bin folder not found."; exit 2 }

foreach ($dll in 'Microsoft.PowerBI.Tabular.Json.dll','Microsoft.PowerBI.Tabular.Utilities.dll','Microsoft.PowerBI.Tabular.dll') {
  $p = Join-Path $bin $dll
  if (Test-Path $p) { [Reflection.Assembly]::LoadFrom($p) | Out-Null }
}

$DefinitionPath = (Resolve-Path $DefinitionPath).Path
Write-Host "Validating $DefinitionPath"

try {
  $db = [Microsoft.AnalysisServices.Tabular.TmdlSerializer]::DeserializeDatabaseFromFolder($DefinitionPath)
  $dq = 0
  foreach ($t in $db.Model.Tables) { foreach ($pt in $t.Partitions) { if ("$($pt.Mode)" -eq 'DirectQuery') { $dq++ } } }
  Write-Host "TMDL OK" -ForegroundColor Green
  Write-Host ("  tables                : {0}" -f $db.Model.Tables.Count)
  Write-Host ("  relationships         : {0}" -f $db.Model.Relationships.Count)
  Write-Host ("  expressions           : {0}" -f $db.Model.Expressions.Count)
  Write-Host ("  directQuery partitions: {0}" -f $dq)
  exit 0
}
catch {
  Write-Host "TMDL ERROR" -ForegroundColor Red
  $ex = $_.Exception; $d = 0
  while ($ex -and $d -lt 8) {
    Write-Host ("  " * ($d+1)) -NoNewline
    Write-Host "[$($ex.GetType().Name)] $($ex.Message)"
    foreach ($pn in 'Errors','DocumentErrors','ReferenceErrors') {
      $p = $ex.PSObject.Properties[$pn]
      if ($p -and $p.Value) { foreach ($e in $p.Value) { Write-Host ("  " * ($d+2)) "-> $e" } }
    }
    $ex = $ex.InnerException; $d++
  }
  exit 1
}
