using System;
using Spoolspace;

public static class StartupTests {
  sealed class FakeSystem : IStartupSystem {
    public StartupSnapshot State;
    public string Fail;
    public int Writes;
    public bool Restored;
    public bool FailRestore;
    public string ServiceCommand { get { return "\"C:\\Program Files\\Spoolspace\\Spoolspace.exe\" --service"; } }
    public string LoginCommand { get { return "\"C:\\Program Files\\Spoolspace\\Spoolspace.exe\" --background"; } }
    public FakeSystem(string mode) {
      State = new StartupSnapshot { Installed = true, StoredMode = Array.IndexOf(StartupSettings.Modes, mode) };
      if (mode == "service") { State.ServicePath = ServiceCommand; State.ServiceStart = 2; }
      if (mode == "login") State.RunValue = LoginCommand;
    }
    public StartupSnapshot Read() { return new StartupSnapshot { Installed = State.Installed, ServicePath = State.ServicePath, ServiceStart = State.ServiceStart, RunValue = State.RunValue, StoredMode = State.StoredMode }; }
    void Write(string operation) { Writes++; if (Fail == operation) throw new Exception("simulated " + operation); }
    public void GrantServiceAccess() { Write("access"); }
    public void SetServiceStart(int value) { State.ServiceStart = value; Write("service"); }
    public void CreateService() { State.ServicePath = ServiceCommand; State.ServiceStart = 2; Write("create"); }
    public void SetRun(string value) { State.RunValue = value; Write("run"); }
    public void SetStoredMode(object value) { State.StoredMode = value; Write("mode"); }
    public void Restore(StartupSnapshot before) { if (FailRestore) throw new Exception("simulated recovery failure"); Restored = true; State = before; }
  }
  static int checks;
  static void Check(bool value, string message) { checks++; if (!value) throw new Exception(message); }
  static void Reject(Action action, string expected) {
    try { action(); } catch (Exception error) { Check(error.Message.Contains(expected), error.ToString()); return; }
    throw new Exception("Expected rejection: " + expected);
  }
  public static int Main() {
    try {
      ServerConfig legacy = new System.Web.Script.Serialization.JavaScriptSerializer().Deserialize<ServerConfig>("{\"port\":4173,\"httpsPort\":4174,\"dataDir\":\"unused\"}");
      Check(!legacy.UsesHttps && legacy.Address == "http://localhost:4173", "legacy configuration did not default to HTTP");
      legacy.httpsMode = "off";
      Check(!legacy.UsesHttps && legacy.Address == "http://localhost:4173", "explicit proxy HTTP mode ignored");
      legacy.tlsCertFile = "custom.crt";
      Check(!legacy.UsesHttps, "disabled HTTPS still used a saved certificate");
      legacy.httpsMode = "auto";
      Check(legacy.UsesHttps && legacy.Address == "https://localhost:4174", "explicit HTTPS opt-in ignored");
      foreach (string from in StartupSettings.Modes) foreach (string to in StartupSettings.Modes) {
        FakeSystem fake = new FakeSystem(from);
        StartupSettings.Apply(fake, to);
        Check(StartupSettings.Mode(fake.Read(), fake) == to, from + " -> " + to);
        Check((int)fake.State.StoredMode == Array.IndexOf(StartupSettings.Modes, to), "installer mode out of sync");
        Check(fake.State.RunValue == (to == "login" ? fake.LoginCommand : null), "duplicate login entry");
        if (from == "service" && to != "service") Check(fake.State.ServiceStart == 4, "old automatic service still enabled");
      }
      foreach (string point in new[] { "access", "create", "run", "mode" }) {
        FakeSystem fake = new FakeSystem("login"); fake.Fail = point;
        Reject(delegate { StartupSettings.Apply(fake, "service"); }, "Previous settings were restored");
        Check(fake.Restored && fake.State.ServicePath == null && fake.State.RunValue == fake.LoginCommand && (int)fake.State.StoredMode == 1, "failed transition was not restored: " + point);
      }
      foreach (string point in new[] { "service", "run", "mode" }) {
        FakeSystem fake = new FakeSystem("service"); fake.Fail = point;
        Reject(delegate { StartupSettings.Apply(fake, "manual"); }, "Previous settings were restored");
        Check(fake.Restored && fake.State.ServiceStart == 2 && fake.State.RunValue == null && (int)fake.State.StoredMode == 2, "service transition was not restored");
      }
      FakeSystem wrong = new FakeSystem("manual");
      Reject(delegate { StartupSettings.Apply(wrong, "command injection"); }, "Unknown startup mode");
      Check(wrong.Writes == 0, "invalid mode wrote settings");
      wrong.State.Installed = false;
      Reject(delegate { StartupSettings.Apply(wrong, "service"); }, "installed Windows version");
      Check(wrong.Writes == 0, "portable copy wrote settings");
      wrong.State.Installed = true; wrong.State.ServicePath = "foreign.exe --service";
      Reject(delegate { StartupSettings.Apply(wrong, "manual"); }, "different service");
      Check(wrong.Writes == 0, "foreign service modified");
      wrong.State.ServicePath = null; wrong.State.RunValue = "foreign.exe";
      Reject(delegate { StartupSettings.Apply(wrong, "login"); }, "different startup entry");
      Check(wrong.Writes == 0, "foreign login entry modified");
      FakeSystem conflict = new FakeSystem("service"); conflict.State.RunValue = conflict.LoginCommand;
      Check(StartupSettings.Conflict(conflict.Read(), conflict), "duplicate modes not detected");
      StartupSettings.Apply(conflict, "login");
      Check(!StartupSettings.Conflict(conflict.Read(), conflict), "duplicate modes not resolved");
      FakeSystem recovery = new FakeSystem("manual"); recovery.Fail = "run"; recovery.FailRestore = true;
      Reject(delegate { StartupSettings.Apply(recovery, "login"); }, "Recovery also failed");
      foreach (string mode in StartupSettings.Modes) Check(StartupSettings.ParseActivation("spoolspace://startup/" + mode) == mode, "valid activation rejected");
      Check(StartupSettings.ParseActivation("spoolspace://startup") == "", "default dialog rejected");
      foreach (string uri in new[] { "spoolspace://startup/manual --service", "spoolspace://startup/service?path=evil", "spoolspace://evil", "file:///evil", "spoolspace://startup/%6danual", "spoolspace://startup/service/extra" })
        Reject(delegate { StartupSettings.ParseActivation(uri); }, "Invalid Spoolspace settings link");
      Console.WriteLine(checks + " Windows startup transition, recovery and activation checks passed (no system writes).");
      return 0;
    } catch (Exception error) { Console.Error.WriteLine(error); return 1; }
  }
}
