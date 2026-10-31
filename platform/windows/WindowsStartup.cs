using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Win32;

namespace Spoolspace {
  public sealed class StartupSnapshot {
    public bool Installed;
    public string ServicePath;
    public int ServiceStart;
    public string RunValue;
    public object StoredMode;
  }

  // Keep the transaction independent of Windows so transitions and failures can
  // be exercised without touching this computer's services or startup registry.
  public interface IStartupSystem {
    StartupSnapshot Read();
    string ServiceCommand { get; }
    string LoginCommand { get; }
    void GrantServiceAccess();
    void SetServiceStart(int value);
    void CreateService();
    void SetRun(string value);
    void SetStoredMode(object value);
    void Restore(StartupSnapshot before);
  }

  public static class StartupSettings {
    public static readonly string[] Modes = { "manual", "login", "service" };
    public static string Mode(StartupSnapshot state, IStartupSystem system) {
      if (String.Equals(state.ServicePath, system.ServiceCommand, StringComparison.OrdinalIgnoreCase) && state.ServiceStart == 2) return "service";
      return String.Equals(state.RunValue, system.LoginCommand, StringComparison.OrdinalIgnoreCase) ? "login" : "manual";
    }
    public static bool Conflict(StartupSnapshot state, IStartupSystem system) {
      return (state.ServicePath != null && !String.Equals(state.ServicePath, system.ServiceCommand, StringComparison.OrdinalIgnoreCase)) ||
        (state.RunValue != null && !String.Equals(state.RunValue, system.LoginCommand, StringComparison.OrdinalIgnoreCase)) ||
        (state.ServiceStart == 2 && state.RunValue != null);
    }
    public static void Apply(IStartupSystem system, string mode) {
      if (Array.IndexOf(Modes, mode) < 0) throw new ArgumentException("Unknown startup mode.");
      StartupSnapshot before = system.Read();
      if (!before.Installed) throw new InvalidOperationException("Startup settings require the installed Windows version.");
      if (before.ServicePath != null && !String.Equals(before.ServicePath, system.ServiceCommand, StringComparison.OrdinalIgnoreCase))
        throw new InvalidOperationException("A different service named Spoolspace exists. It has not been changed.");
      if (before.RunValue != null && !String.Equals(before.RunValue, system.LoginCommand, StringComparison.OrdinalIgnoreCase))
        throw new InvalidOperationException("A different startup entry named Spoolspace exists. It has not been changed.");
      try {
        if (mode == "service") {
          system.GrantServiceAccess();
          if (before.ServicePath == null) system.CreateService(); else system.SetServiceStart(2);
        } else if (before.ServicePath != null) system.SetServiceStart(4);
        system.SetRun(mode == "login" ? system.LoginCommand : null);
        system.SetStoredMode(Array.IndexOf(Modes, mode));
      } catch (Exception error) {
        try { system.Restore(before); }
        catch (Exception rollback) { throw new InvalidOperationException("Could not save startup settings: " + error.Message + " Recovery also failed: " + rollback.Message + ". Check Windows Services before restarting.", error); }
        throw new InvalidOperationException("Could not save startup settings. Previous settings were restored. " + error.Message, error);
      }
    }
    public static string ParseActivation(string value) {
      // A protocol activation only opens a review dialog. Never accept command
      // fragments, file paths, hostnames or additional parameters from a URI.
      if (value == "spoolspace://startup" || value == "spoolspace://startup/") return "";
      foreach (string mode in Modes) if (value == "spoolspace://startup/" + mode) return mode;
      throw new ArgumentException("Invalid Spoolspace settings link.");
    }
    public static void PrintStatus() {
      WindowsStartupSystem system = new WindowsStartupSystem();
      StartupSnapshot state = system.Read();
      Console.WriteLine(new JavaScriptSerializer().Serialize(new {
        installed = state.Installed,
        mode = state.Installed ? Mode(state, system) : null,
        conflict = state.Installed && Conflict(state, system)
      }));
    }
    public static void ShowDialog(string proposed) {
      WindowsStartupSystem system = new WindowsStartupSystem();
      StartupSnapshot state = system.Read();
      if (!state.Installed) throw new InvalidOperationException("Install Spoolspace to change Windows startup settings.");
      Application.EnableVisualStyles();
      using (Form form = new Form()) {
        form.Text = "Spoolspace — Windows startup";
        form.ClientSize = new Size(560, 340); form.FormBorderStyle = FormBorderStyle.FixedDialog;
        form.MaximizeBox = false; form.MinimizeBox = false; form.StartPosition = FormStartPosition.CenterScreen;
        form.AutoScaleMode = AutoScaleMode.Dpi;
        Label heading = new Label { Text = "Choose how Spoolspace starts on this computer", Left = 22, Top = 22, Width = 510, Height = 30 };
        form.Controls.Add(heading);
        string[] titles = { "Only when I open the desktop shortcut", "In the background at Windows sign-in", "As a Windows service at computer startup (no sign-in needed)" };
        RadioButton[] options = new RadioButton[3];
        string selected = String.IsNullOrEmpty(proposed) ? Mode(state, system) : proposed;
        for (int i = 0; i < options.Length; i++) {
          options[i] = new RadioButton { Text = titles[i], Left = 22, Top = 64 + 40 * i, Width = 516, Height = 32, Checked = Modes[i] == selected };
          form.Controls.Add(options[i]);
        }
        form.Controls.Add(new Label { Text = "Applies at the next Windows startup. Your current server stays running.\r\nWindows will ask for administrator permission when you save.", Left = 22, Top = 195, Width = 516, Height = 58 });
        Button cancel = new Button { Text = "Cancel", Left = 320, Top = 285, Width = 100, Height = 32, DialogResult = DialogResult.Cancel };
        Button save = new Button { Text = "Save startup mode", Left = 430, Top = 285, Width = 110, Height = 32 };
        form.Controls.Add(cancel); form.Controls.Add(save); form.CancelButton = cancel; form.AcceptButton = save;
        save.Click += delegate {
          string choice = "manual";
          for (int i = 0; i < options.Length; i++) if (options[i].Checked) choice = Modes[i];
          try {
            save.Enabled = false;
            ProcessStartInfo start = new ProcessStartInfo(Application.ExecutablePath, "--apply-startup=" + choice) { UseShellExecute = true, Verb = "runas", WorkingDirectory = ServerConfig.AppDirectory };
            using (Process helper = Process.Start(start)) {
              helper.WaitForExit();
              if (helper.ExitCode != 0) { save.Enabled = true; return; }
            }
            MessageBox.Show(form, "Startup mode saved. It takes effect at the next Windows startup.\r\nYour current server is still running.", "Spoolspace", MessageBoxButtons.OK, MessageBoxIcon.Information);
            form.Close();
          } catch (Win32Exception error) {
            save.Enabled = true;
            if (error.NativeErrorCode != 1223) MessageBox.Show(form, error.Message, "Spoolspace", MessageBoxButtons.OK, MessageBoxIcon.Error);
          } catch (Exception error) { save.Enabled = true; MessageBox.Show(form, error.Message, "Spoolspace", MessageBoxButtons.OK, MessageBoxIcon.Error); }
        };
        form.ShowDialog();
      }
    }
    public static void ApplyElevated(string mode) {
      if (!new WindowsPrincipal(WindowsIdentity.GetCurrent()).IsInRole(WindowsBuiltInRole.Administrator)) throw new InvalidOperationException("Administrator permission is required to save Windows startup settings.");
      bool created;
      using (System.Threading.Mutex gate = new System.Threading.Mutex(true, @"Global\Spoolspace.StartupSettings", out created)) {
        if (!created) throw new InvalidOperationException("Another startup change is in progress. Try again after it finishes.");
        try { Apply(new WindowsStartupSystem(), mode); } finally { gate.ReleaseMutex(); }
      }
    }
  }

  public sealed class WindowsStartupSystem : IStartupSystem {
    const string AppKey = @"SOFTWARE\Spoolspace";
    const string RunKey = @"SOFTWARE\Microsoft\Windows\CurrentVersion\Run";
    const string ServiceKey = @"SYSTEM\CurrentControlSet\Services\Spoolspace";
    readonly string executable = Path.Combine(ServerConfig.AppDirectory, "Spoolspace.exe");
    DirectorySecurity previousAccess;
    string accessFolder;
    public string ServiceCommand { get { return "\"" + executable + "\" --service"; } }
    public string LoginCommand { get { return "\"" + executable + "\" --background"; } }
    public StartupSnapshot Read() {
      using (RegistryKey app = Registry.LocalMachine.OpenSubKey(AppKey))
      using (RegistryKey run = Registry.LocalMachine.OpenSubKey(RunKey))
      using (RegistryKey service = Registry.LocalMachine.OpenSubKey(ServiceKey)) {
        return new StartupSnapshot {
          Installed = app != null && String.Equals(app.GetValue("InstallDir") as string, ServerConfig.AppDirectory, StringComparison.OrdinalIgnoreCase),
          ServicePath = service == null ? null : service.GetValue("ImagePath") as string,
          ServiceStart = service == null ? 0 : Convert.ToInt32(service.GetValue("Start", 0)),
          RunValue = run == null ? null : run.GetValue("Spoolspace") as string,
          StoredMode = app == null ? null : app.GetValue("StartMode")
        };
      }
    }
    public void GrantServiceAccess() {
      // Never follow writable config paths or junctions while elevated.
      // Custom data folders need their own LocalService ACL set by their owner.
      accessFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "Spoolspace");
      for (DirectoryInfo part = new DirectoryInfo(accessFolder); part != null; part = part.Parent)
        if ((part.Attributes & FileAttributes.ReparsePoint) != 0) throw new InvalidOperationException("The installed data directory must not be a junction or symbolic link.");
      previousAccess = Directory.GetAccessControl(accessFolder, AccessControlSections.Access);
      DirectorySecurity updated = Directory.GetAccessControl(accessFolder, AccessControlSections.Access);
      updated.AddAccessRule(new FileSystemAccessRule(new SecurityIdentifier(WellKnownSidType.LocalServiceSid, null), FileSystemRights.Modify, InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit, PropagationFlags.None, AccessControlType.Allow));
      Directory.SetAccessControl(accessFolder, updated);
    }
    public void SetRun(string value) {
      using (RegistryKey key = Registry.LocalMachine.CreateSubKey(RunKey)) {
        if (value == null) key.DeleteValue("Spoolspace", false); else key.SetValue("Spoolspace", value, RegistryValueKind.String);
      }
    }
    public void SetStoredMode(object value) {
      using (RegistryKey key = Registry.LocalMachine.OpenSubKey(AppKey, true)) {
        if (key == null) throw new InvalidOperationException("The Spoolspace installation was removed.");
        if (value == null) key.DeleteValue("StartMode", false); else key.SetValue("StartMode", value, RegistryValueKind.DWord);
      }
    }
    static Exception NativeError() { return new Win32Exception(Marshal.GetLastWin32Error()); }
    public void SetServiceStart(int value) {
      IntPtr manager = OpenSCManager(null, null, 1);
      if (manager == IntPtr.Zero) throw NativeError();
      try {
        IntPtr service = OpenService(manager, "Spoolspace", 2);
        if (service == IntPtr.Zero) throw NativeError();
        try {
          if (!ChangeServiceConfig(service, 0xffffffff, (uint)value, 0xffffffff, null, null, IntPtr.Zero, null, null, null, null)) throw NativeError();
        } finally { CloseServiceHandle(service); }
      } finally { CloseServiceHandle(manager); }
    }
    public void CreateService() {
      IntPtr manager = OpenSCManager(null, null, 3);
      if (manager == IntPtr.Zero) throw NativeError();
      try {
        IntPtr service = NativeCreateService(manager, "Spoolspace", "Spoolspace filament server", 2, 0x10, 2, 1, ServiceCommand, null, IntPtr.Zero, null, @"NT AUTHORITY\LocalService", null);
        if (service == IntPtr.Zero) throw NativeError();
        CloseServiceHandle(service);
      } finally { CloseServiceHandle(manager); }
    }
    void DeleteOwnService() {
      StartupSnapshot state = Read();
      if (state.ServicePath == null) return;
      if (!String.Equals(state.ServicePath, ServiceCommand, StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("Refusing to remove a different Spoolspace service.");
      IntPtr manager = OpenSCManager(null, null, 1);
      if (manager == IntPtr.Zero) throw NativeError();
      try {
        IntPtr service = OpenService(manager, "Spoolspace", 0x10000);
        if (service == IntPtr.Zero) throw NativeError();
        try { if (!DeleteService(service)) throw NativeError(); } finally { CloseServiceHandle(service); }
      } finally { CloseServiceHandle(manager); }
    }
    public void Restore(StartupSnapshot before) {
      // Attempt every recovery step even if one fails. No process is stopped.
      Exception failure = null;
      Action[] steps = {
        delegate { if (before.ServicePath == null) DeleteOwnService(); else SetServiceStart(before.ServiceStart); },
        delegate { SetRun(before.RunValue); },
        delegate { SetStoredMode(before.StoredMode); },
        delegate { if (previousAccess != null) Directory.SetAccessControl(accessFolder, previousAccess); }
      };
      foreach (Action step in steps) try { step(); } catch (Exception error) { failure = error; }
      if (failure != null) throw failure;
    }
    [DllImport("advapi32.dll", EntryPoint = "OpenSCManagerW", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern IntPtr OpenSCManager(string machine, string database, uint access);
    [DllImport("advapi32.dll", EntryPoint = "OpenServiceW", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern IntPtr OpenService(IntPtr manager, string name, uint access);
    [DllImport("advapi32.dll", EntryPoint = "CreateServiceW", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern IntPtr NativeCreateService(IntPtr manager, string name, string displayName, uint access, uint type, uint start, uint error, string path, string group, IntPtr tag, string dependencies, string account, string password);
    [DllImport("advapi32.dll", EntryPoint = "ChangeServiceConfigW", CharSet = CharSet.Unicode, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    static extern bool ChangeServiceConfig(IntPtr service, uint type, uint start, uint error, string path, string group, IntPtr tag, string dependencies, string account, string password, string displayName);
    [DllImport("advapi32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    static extern bool DeleteService(IntPtr service);
    [DllImport("advapi32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    static extern bool CloseServiceHandle(IntPtr handle);
  }
}
