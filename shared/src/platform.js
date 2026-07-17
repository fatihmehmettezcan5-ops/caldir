// Çaldır platform capability interface (platform-agnostic).
//
// The Session talks to the controlled device through this abstraction. There
// are multiple implementations:
//   - NodeStubPlatform: in-memory fake for desktop dev/testing (in server/src/platforms).
//   - AndroidShellPlatform: drives real Android system APIs via Capacitor
//     plugins when running inside the APK (in app/src/server).
//   - AndroidShellPlatformStub: an in-memory stand-in used in the web preview
//     when the Capacitor runtime is not present (browser dev).
export {};
