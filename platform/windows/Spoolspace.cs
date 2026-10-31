using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.ServiceProcess;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Win32;

namespace Spoolspace {
  public sealed class ServerConfig {
    public int port = 4173;
    public string host = "0.0.0.0";
    public string dataDir;
    public int httpsPort = 4174;
    public string httpsMode = "off";
    public string tlsCertFile = "";
    public string tlsKeyFile = "";
    public string[] allowedHosts = new string[0];
    public static string ConfigFile;
    public static bool IsInstalled;
    public static string AppDirectory = AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
    public bool UsesHttps { get { return httpsMode != "off"; } }
    public string Address { get { return UsesHttps ? "https://localhost:" + httpsPort : "http://localhost:" + port; } }
    public string ProbeHost { get { return host == "0.0.0.0" ? "127.0.0.1" : host == "::" ? "::1" : host; } }
    public static ServerConfig Load() {
      string installed = (string)Registry.GetValue(@"HKEY_LOCAL_MACHINE\SOFTWARE\Spoolspace", "InstallDir", "");
      bool isInstalled = String.Equals(installed, AppDirectory, StringComparison.OrdinalIgnoreCase);
      IsInstalled = isInstalled;
      string folder = isInstalled ? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "Spoolspace") : Path.Combine(AppDirectory, "data");
      ConfigFile = Environment.GetEnvironmentVariable("SPOOLSPACE_CONFIG_PATH");
      if (String.IsNullOrEmpty(ConfigFile)) ConfigFile = Path.Combine(folder, "config.json");
      ServerConfig config;
      JavaScriptSerializer json = new JavaScriptSerializer();
      if (File.Exists(ConfigFile)) config = json.Deserialize<ServerConfig>(File.ReadAllText(ConfigFile));
      else { config = new ServerConfig(); config.dataDir = folder; Directory.CreateDirectory(Path.GetDirectoryName(ConfigFile)); File.WriteAllText(ConfigFile, json.Serialize(config), new UTF8Encoding(false)); }
      if (config == null || config.port < 1 || config.port > 65535 || config.httpsPort < 1 || config.httpsPort > 65535 || (config.httpsMode != "auto" && config.httpsMode != "off") || String.IsNullOrWhiteSpace(config.host) || String.IsNullOrWhiteSpace(config.dataDir)) throw new InvalidOperationException("Invalid server configuration: " + ConfigFile);
      config.dataDir = Path.GetFullPath(Environment.ExpandEnvironmentVariables(config.dataDir));
      return config;
    }
    public string DataId {
      get {
        using (SHA256 sha = SHA256.Create()) {
          byte[] bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(dataDir.TrimEnd(Path.DirectorySeparatorChar).ToLowerInvariant()));
          return BitConverter.ToString(bytes).Replace("-", "").ToLowerInvariant().Substring(0, 16);
        }
      }
    }
  }

  public sealed class ServerSupervisor : IDisposable {
    readonly ServerConfig config;
    readonly object gate = new object();
    Process child;
    System.Threading.Timer retry;
    volatile bool stopping;
    public ServerSupervisor(ServerConfig value) { config = value; }
    public bool IsReady() {
      try {
        string probe = config.ProbeHost.IndexOf(':') >= 0 ? "[" + config.ProbeHost + "]" : config.ProbeHost;
        HttpWebRequest request = (HttpWebRequest)WebRequest.Create("http://" + probe + ":" + config.port + "/api/health");
        request.Proxy = null; request.Timeout = 1500; request.ReadWriteTimeout = 1500; request.AllowAutoRedirect = false;
        using (WebResponse response = request.GetResponse())
        using (StreamReader reader = new StreamReader(response.GetResponseStream())) {
          Dictionary<string, object> value = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(reader.ReadToEnd());
          bool ready = value.ContainsKey("app") && (string)value["app"] == "Spoolspace" && value.ContainsKey("dataId") && (string)value["dataId"] == config.DataId;
          if (ready && config.UsesHttps) ready = value.ContainsKey("httpsPort") && value["httpsPort"] != null && Convert.ToInt32(value["httpsPort"]) == config.httpsPort;
          if (!ready) Log("Health identity mismatch. Expected " + config.DataId + ", received " + new JavaScriptSerializer().Serialize(value));
          return ready;
        }
      } catch (Exception error) { if (Environment.GetEnvironmentVariable("SPOOLSPACE_VERIFY") == "1") Log("Health probe: " + error.Message); return false; }
    }
    public bool PortInUse() {
      using (TcpClient client = new TcpClient()) {
        try { IAsyncResult task = client.BeginConnect(config.ProbeHost, config.port, null, null); if (!task.AsyncWaitHandle.WaitOne(500)) return false; client.EndConnect(task); return true; } catch { return false; }
      }
    }
    void Log(string message) {
      if (message == null) return;
      lock (gate) {
        try {
          string directory = Path.Combine(config.dataDir, "logs"); Directory.CreateDirectory(directory);
          string file = Path.Combine(directory, "server.log");
          if (File.Exists(file) && new FileInfo(file).Length > 5 * 1024 * 1024) File.Move(file, Path.Combine(directory, "server-" + DateTime.UtcNow.ToString("yyyyMMdd-HHmmss-fff") + ".log"));
          File.AppendAllText(file, DateTime.UtcNow.ToString("o") + " " + message + Environment.NewLine);
        } catch { /* Logging must not kill the server. */ }
      }
    }
    void Spawn() {
      if (stopping) return;
      Directory.CreateDirectory(config.dataDir);
      ProcessStartInfo start = new ProcessStartInfo(Path.Combine(ServerConfig.AppDirectory, @"runtime\node.exe"), "\"" + Path.Combine(ServerConfig.AppDirectory, "server.mjs") + "\"");
      start.WorkingDirectory = ServerConfig.AppDirectory;
      start.UseShellExecute = false; start.CreateNoWindow = true;
      start.RedirectStandardInput = true; start.RedirectStandardOutput = true; start.RedirectStandardError = true;
      start.EnvironmentVariables["PORT"] = config.port.ToString();
      start.EnvironmentVariables["HOST"] = config.host;
      start.EnvironmentVariables["DATA_DIR"] = config.dataDir;
      start.EnvironmentVariables["SPOOLSPACE_SUPERVISED"] = "1";
      start.EnvironmentVariables["SPOOLSPACE_WINDOWS_EXE"] = ServerConfig.IsInstalled ? Path.Combine(ServerConfig.AppDirectory, "Spoolspace.exe") : "";
      start.EnvironmentVariables["SEED_DEMO"] = "false";
      if (Environment.GetEnvironmentVariable("SPOOLSPACE_VERIFY") == "1") start.EnvironmentVariables["CATALOG_AUTO_UPDATE"] = "false";
      start.EnvironmentVariables["HTTPS_PORT"] = config.httpsPort.ToString();
      start.EnvironmentVariables["HTTPS_MODE"] = config.httpsMode;
      start.EnvironmentVariables["TLS_CERT_FILE"] = Environment.ExpandEnvironmentVariables(config.tlsCertFile ?? "");
      start.EnvironmentVariables["TLS_KEY_FILE"] = Environment.ExpandEnvironmentVariables(config.tlsKeyFile ?? "");
      start.EnvironmentVariables["ALLOWED_HOSTS"] = String.Join(",", config.allowedHosts ?? new string[0]);
      Process process = new Process(); process.StartInfo = start; process.EnableRaisingEvents = true;
      process.OutputDataReceived += delegate(object sender, DataReceivedEventArgs args) { Log(args.Data); };
      process.ErrorDataReceived += delegate(object sender, DataReceivedEventArgs args) { Log(args.Data); };
      process.Exited += delegate { if (!stopping) { Log("Server exited; retrying in five seconds."); retry = new System.Threading.Timer(delegate { try { if (!PortInUse()) Spawn(); } catch (Exception error) { Log(error.Message); } }, null, 5000, Timeout.Infinite); } };
      child = process; process.Start(); process.BeginOutputReadLine(); process.BeginErrorReadLine();
    }
    public void Start() {
      if (PortInUse()) throw new InvalidOperationException("Port " + config.port + " is already in use. Stop the previous server or change port in " + ServerConfig.ConfigFile + ". Your inventory has not been changed.");
      Spawn();
    }
    public bool WaitUntilReady() {
      Stopwatch timeout = Stopwatch.StartNew();
      while (timeout.ElapsedMilliseconds < 25000) { if (IsReady()) return true; if (child != null && child.HasExited) return false; Thread.Sleep(350); }
      return false;
    }
    public void Dispose() {
      stopping = true; if (retry != null) retry.Dispose();
      Process process = child;
      if (process == null) return;
      try { if (!process.HasExited) { process.StandardInput.WriteLine("shutdown"); process.StandardInput.Flush(); if (!process.WaitForExit(15000)) { process.Kill(); process.WaitForExit(5000); } } } catch (InvalidOperationException) {} finally { process.Dispose(); }
    }
  }

  public sealed class SpoolspaceService : ServiceBase {
    ServerSupervisor supervisor;
    public SpoolspaceService() { ServiceName = "Spoolspace"; CanStop = true; CanShutdown = true; }
    protected override void OnStart(string[] args) { supervisor = new ServerSupervisor(ServerConfig.Load()); supervisor.Start(); }
    protected override void OnStop() { RequestAdditionalTime(20000); if (supervisor != null) supervisor.Dispose(); }
    protected override void OnShutdown() { if (supervisor != null) supervisor.Dispose(); }
  }

  public sealed class TrayContext : ApplicationContext {
    readonly NotifyIcon icon;
    readonly ServerSupervisor supervisor;
    public TrayContext(ServerConfig config, ServerSupervisor value) {
      supervisor = value;
      icon = new NotifyIcon(); icon.Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); icon.Text = "Spoolspace server";
      ContextMenuStrip menu = new ContextMenuStrip();
      menu.Items.Add("Open Spoolspace", null, delegate { Program.OpenConfigured(config); });
      if (config.UsesHttps) menu.Items.Add("HTTPS certificate trust on this Windows account…", null, delegate { try { Program.OfferCertificateTrust(config, true); } catch (Exception error) { MessageBox.Show(error.Message, "Spoolspace", MessageBoxButtons.OK, MessageBoxIcon.Error); } });
      menu.Items.Add("Open data folder", null, delegate { Process.Start(new ProcessStartInfo(config.dataDir) { UseShellExecute = true }); });
      menu.Items.Add("Server configuration (restart to apply)", null, delegate { Process.Start("notepad.exe", "\"" + ServerConfig.ConfigFile + "\""); });
      if (ServerConfig.IsInstalled) menu.Items.Add("Windows startup settings…", null, delegate { try { StartupSettings.ShowDialog(""); } catch (Exception error) { MessageBox.Show(error.Message, "Spoolspace", MessageBoxButtons.OK, MessageBoxIcon.Error); } });
      menu.Items.Add(new ToolStripSeparator());
      menu.Items.Add("Stop server and exit", null, delegate { ExitThread(); });
      icon.ContextMenuStrip = menu; icon.DoubleClick += delegate { Program.OpenConfigured(config); }; icon.Visible = true;
      Application.ApplicationExit += delegate { supervisor.Dispose(); };
    }
    protected override void ExitThreadCore() { supervisor.Dispose(); icon.Visible = false; icon.Dispose(); base.ExitThreadCore(); }
  }

  public static class Program {
    public static void OpenBrowser(string address) { Process.Start(new ProcessStartInfo(address) { UseShellExecute = true }); }
    public static void OfferCertificateTrust(ServerConfig config, bool showTrusted) {
      if (!config.UsesHttps || !String.IsNullOrEmpty(config.tlsCertFile)) return;
      string file = Path.Combine(config.dataDir, @"https\spoolspace-ca.crt");
      if (!File.Exists(file)) return;
      using (X509Certificate2 cert = new X509Certificate2(file))
      using (X509Store store = new X509Store(StoreName.Root, StoreLocation.CurrentUser)) {
        store.Open(OpenFlags.ReadWrite);
        if (store.Certificates.Find(X509FindType.FindByThumbprint, cert.Thumbprint, false).Count > 0) {
          if (showTrusted) MessageBox.Show("This Windows account already trusts the Spoolspace certificate. Phone certificate trust is configured separately in the phone's Settings.", "Spoolspace HTTPS", MessageBoxButtons.OK, MessageBoxIcon.Information);
          return;
        }
        string fingerprint;
        using (SHA256 sha = SHA256.Create()) fingerprint = BitConverter.ToString(sha.ComputeHash(cert.RawData)).Replace('-', ':');
        if (MessageBox.Show("Trust this local Spoolspace certificate authority on this Windows account?\r\n\r\nThis lets your browser open the local HTTPS app without certificate warnings. A certificate authority can issue certificates trusted by this account. Only accept your own server's certificate. Your phone needs a separate trust step.\r\n\r\nSHA-256:\r\n" + fingerprint, "Spoolspace — local HTTPS certificate", MessageBoxButtons.YesNo, MessageBoxIcon.Question, MessageBoxDefaultButton.Button2) == DialogResult.Yes) store.Add(cert);
      }
    }
    public static void OpenConfigured(ServerConfig config) {
      try { OfferCertificateTrust(config, false); } catch (Exception error) { MessageBox.Show(error.Message + "\r\nYou can use the phone setup page to download and trust the public certificate.", "Spoolspace HTTPS", MessageBoxButtons.OK, MessageBoxIcon.Information); }
      OpenBrowser(config.Address);
    }
    [STAThread]
    public static int Main(string[] args) {
      bool verify = Array.IndexOf(args, "--verify") >= 0;
      bool background = Array.IndexOf(args, "--background") >= 0;
      if (verify) Environment.SetEnvironmentVariable("SPOOLSPACE_VERIFY", "1");
      try {
        if (args.Length == 1 && args[0] == "--startup-status") { StartupSettings.PrintStatus(); return 0; }
        if (args.Length == 1 && args[0] == "spoolspace://https/trust") { OfferCertificateTrust(ServerConfig.Load(), true); return 0; }
        if (args.Length == 1 && args[0].StartsWith("--apply-startup=", StringComparison.Ordinal)) { StartupSettings.ApplyElevated(args[0].Substring("--apply-startup=".Length)); return 0; }
        if (args.Length == 1 && args[0].StartsWith("spoolspace:", StringComparison.OrdinalIgnoreCase)) { StartupSettings.ShowDialog(StartupSettings.ParseActivation(args[0])); return 0; }
        if (Array.IndexOf(args, "--service") >= 0) { ServiceBase.Run(new SpoolspaceService()); return 0; }
        ServerConfig config = ServerConfig.Load();
        using (ServerSupervisor server = new ServerSupervisor(config)) {
          if (server.IsReady()) { if (!background && !verify) OpenConfigured(config); return 0; }
          if (ServerConfig.IsInstalled && Convert.ToInt32(Registry.GetValue(@"HKEY_LOCAL_MACHINE\SOFTWARE\Spoolspace", "StartMode", 0)) == 2) {
            using (ServiceController service = new ServiceController("Spoolspace")) {
              if (service.Status != ServiceControllerStatus.Stopped) {
                if (!server.WaitUntilReady()) throw new InvalidOperationException("The Windows service is running but not ready. Check the server log in " + config.dataDir + ".");
                if (!background && !verify) OpenConfigured(config);
                return 0;
              }
              // A newly selected service mode applies next boot. Until then
              // the desktop shortcut can still start a tray server normally.
            }
          }
          bool created;
          using (Mutex mutex = new Mutex(true, verify ? @"Local\Spoolspace.Verify." + config.DataId : @"Local\Spoolspace.Launcher", out created)) {
            if (!created) {
              if (!server.WaitUntilReady()) throw new InvalidOperationException("Another Spoolspace launcher is open, but this server is not ready. Check the notification-area menu and server configuration.");
              if (!background && !verify) OpenConfigured(config);
              return 0;
            }
            try {
              server.Start();
              if (!server.WaitUntilReady()) throw new InvalidOperationException("The server did not start. See " + Path.Combine(config.dataDir, "logs", "server.log"));
              if (verify) return 0;
              Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
              if (!background) OpenConfigured(config);
              Application.Run(new TrayContext(config, server));
            } finally { mutex.ReleaseMutex(); }
          }
        }
        return 0;
      } catch (Exception error) {
        if (verify || (args.Length == 1 && args[0] == "--startup-status")) Console.Error.WriteLine(error.ToString());
        else if (!background) MessageBox.Show(error.Message, "Spoolspace", MessageBoxButtons.OK, MessageBoxIcon.Error);
        return 1;
      }
    }
  }
}
