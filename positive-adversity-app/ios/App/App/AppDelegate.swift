import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {

        print("=== RUNTIME CONFIG CHECK ===")

        // Bundle ID
        print("Bundle identifier:", Bundle.main.bundleIdentifier ?? "nil")

        // GoogleService-Info.plist
        if let path = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") {
            print("GoogleService-Info.plist path:", path)

            if let dict = NSDictionary(contentsOfFile: path) as? [String: Any] {
                print("CLIENT_ID:", dict["CLIENT_ID"] ?? "nil")
                print("REVERSED_CLIENT_ID:", dict["REVERSED_CLIENT_ID"] ?? "nil")
                print("BUNDLE_ID:", dict["BUNDLE_ID"] ?? "nil")
                print("GOOGLE_APP_ID:", dict["GOOGLE_APP_ID"] ?? "nil")
            } else {
                print("❌ Could not read GoogleService-Info.plist contents")
            }
        } else {
            print("❌ GoogleService-Info.plist NOT found in app bundle")
        }

        // Info.plist values
        if let gid = Bundle.main.object(forInfoDictionaryKey: "GIDClientID") as? String {
            print("Info.plist GIDClientID:", gid)
        } else {
            print("❌ Info.plist GIDClientID missing")
        }

        if let urlTypes = Bundle.main.object(forInfoDictionaryKey: "CFBundleURLTypes") as? [[String: Any]] {
            print("CFBundleURLTypes:", urlTypes)
        } else {
            print("❌ CFBundleURLTypes missing")
        }

        print("=== END RUNTIME CONFIG CHECK ===")

        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {}

    func applicationDidEnterBackground(_ application: UIApplication) {}

    func applicationWillEnterForeground(_ application: UIApplication) {}

    func applicationDidBecomeActive(_ application: UIApplication) {}

    func applicationWillTerminate(_ application: UIApplication) {}

    func application(
        _ app: UIApplication,
        open url: URL,
        options: [UIApplication.OpenURLOptionsKey: Any] = [:]
    ) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(
        _ application: UIApplication,
        continue userActivity: NSUserActivity,
        restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
    ) -> Bool {
        return ApplicationDelegateProxy.shared.application(
            application,
            continue: userActivity,
            restorationHandler: restorationHandler
        )
    }
}
