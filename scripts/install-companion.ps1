param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[a-p]{32}$')]
  [string]$ExtensionId
)

$ErrorActionPreference = 'Stop'

function Refresh-QuickClonePath {
  $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $user = [Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = "$machine;$user"
}

function Install-QuickCloneTool {
  param([string]$Command, [string]$Package)
  if (Get-Command $Command -ErrorAction SilentlyContinue) { return }
  $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
  if (-not $winget) {
    throw "Windows Package Manager (winget) is required to install $Command automatically. Install App Installer from Microsoft Store, then run this command again."
  }
  Write-Host "Installing $Command..."
  & $winget.Source install --id $Package --exact --silent --accept-package-agreements --accept-source-agreements
  if ($LASTEXITCODE -ne 0) { throw "Could not install $Command (winget exit code $LASTEXITCODE)." }
  Refresh-QuickClonePath
  if (-not (Get-Command $Command -ErrorAction SilentlyContinue)) {
    throw "$Command was installed but is not available yet. Open a new PowerShell window and run the command again."
  }
}

if ($env:OS -ne 'Windows_NT') { throw 'This installer is for Windows. Use the macOS command shown by the extension.' }

Install-QuickCloneTool -Command 'node.exe' -Package 'OpenJS.NodeJS.LTS'
Install-QuickCloneTool -Command 'git.exe' -Package 'Git.Git'

# Replace an older Quick Clone/Git Magager server that may be bound to another extension ID.
try {
  Get-NetTCPConnection -LocalPort 9456 -State Listen -ErrorAction Stop | ForEach-Object {
    $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $($_.OwningProcess)"
    if ($processInfo.Name -eq 'node.exe' -and $processInfo.CommandLine -match 'server\.js' -and
        $processInfo.CommandLine -match 'Quick Clone|Git Magager') {
      Stop-Process -Id $_.OwningProcess -Force
    }
  }
} catch {
  # No old listener is the normal first-install case.
}

$nodePath = (Get-Command node.exe).Source
$gitPath = (Get-Command git.exe).Source
$installDir = Join-Path $env:LOCALAPPDATA 'Quick Clone'
$manifestPath = Join-Path $installDir 'com.git_magager.host.json'
$hostPath = Join-Path $installDir 'QuickCloneHost.exe'
New-Item -ItemType Directory -Path $installDir -Force | Out-Null

$baseUrl = 'https://raw.githubusercontent.com/id-velop/git-clone-manager/main/native-host'
Invoke-WebRequest "$baseUrl/server.js" -OutFile (Join-Path $installDir 'server.js') -UseBasicParsing

$nodeLiteral = $nodePath.Replace('\', '\\').Replace('"', '\"')
$serverLiteral = (Join-Path $installDir 'server.js').Replace('\', '\\').Replace('"', '\"')
$idLiteral = $ExtensionId.Replace('"', '\"')
$gitLiteral = $gitPath.Replace('\', '\\').Replace('"', '\"')
$source = @"
using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Threading;

public static class QuickCloneHost {
  static void StartServer() {
    var info = new ProcessStartInfo();
    info.FileName = "$nodeLiteral";
    info.Arguments = "\"$serverLiteral\" $idLiteral \"$gitLiteral\"";
    info.UseShellExecute = true;
    info.WindowStyle = ProcessWindowStyle.Hidden;
    Process.Start(info);
    Thread.Sleep(800);
  }

  static byte[] ReadExactly(Stream input, int length) {
    var data = new byte[length];
    var offset = 0;
    while (offset < length) {
      var count = input.Read(data, offset, length - offset);
      if (count == 0) return null;
      offset += count;
    }
    return data;
  }

  public static void Main() {
    var input = Console.OpenStandardInput();
    var output = Console.OpenStandardOutput();
    var started = false;
    while (true) {
      var header = ReadExactly(input, 4);
      if (header == null) return;
      var length = BitConverter.ToInt32(header, 0);
      if (length < 0 || length > 1048576 || ReadExactly(input, length) == null) return;
      if (!started) { StartServer(); started = true; }
      var json = "{\"type\":\"health\",\"status\":\"ok\",\"serverRunning\":true,\"version\":\"1.1.5\"}";
      var body = Encoding.UTF8.GetBytes(json);
      output.Write(BitConverter.GetBytes(body.Length), 0, 4);
      output.Write(body, 0, body.Length);
      output.Flush();
    }
  }
}
"@

if (Test-Path $hostPath) { [IO.File]::Delete($hostPath) }
Add-Type -TypeDefinition $source -Language CSharp -OutputAssembly $hostPath -OutputType WindowsApplication

$manifest = @{
  name = 'com.git_magager.host'
  description = 'Quick Clone Native Host'
  path = $hostPath
  type = 'stdio'
  allowed_origins = @("chrome-extension://$ExtensionId/")
}
$manifestJson = $manifest | ConvertTo-Json -Depth 3
[IO.File]::WriteAllText($manifestPath, $manifestJson, (New-Object Text.UTF8Encoding($false)))

$registryPath = 'HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.git_magager.host'
New-Item -Path $registryPath -Force | Out-Null
Set-Item -Path $registryPath -Value $manifestPath

Write-Host 'Quick Clone setup complete. Open the extension and click Reconnect.'
