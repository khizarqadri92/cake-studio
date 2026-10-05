' Opens Cake Studio in its own window (Microsoft Edge "app" mode: no tabs or
' address bar, its own taskbar icon). Falls back to the default browser.
Dim fso, shell, port, url, f
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("Shell.Application")
port = "8000"
f = CreateObject("WScript.Shell").ExpandEnvironmentStrings("%ProgramData%") & "\CakeStudio\config\port.txt"
If fso.FileExists(f) Then port = Trim(fso.OpenTextFile(f).ReadAll)
url = "http://localhost:" & port & "/"
On Error Resume Next
shell.ShellExecute "msedge", "--app=" & url, "", "open", 1
If Err.Number <> 0 Then
  Err.Clear
  shell.ShellExecute url, "", "", "open", 1
End If
