import 'package:flutter/services.dart';
import 'package:local_auth/local_auth.dart';
import 'package:local_auth_android/local_auth_android.dart';
import 'package:local_auth_darwin/local_auth_darwin.dart';

class BiometricService {
  final LocalAuthentication _auth = LocalAuthentication();

  /// Check if the device is capable of biometric authentication AND has at
  /// least one security method enrolled (biometric, PIN, pattern, or password).
  ///
  /// Returns false if the device hardware is supported but the user has chosen
  /// not to set up any screen lock — in that case the clocking flow will
  /// bypass authentication entirely (graceful bypass).
  Future<bool> isSecurityEnrolled() async {
    try {
      // canCheckBiometrics: true only when biometrics are actively enrolled.
      // isDeviceSupported: true whenever the hardware can support screen-lock
      //   (even if nothing is enrolled yet).
      //
      // We distinguish "hardware present" from "security enrolled" by running
      // a lightweight probe: attempt a silent availability check via
      // getAvailableBiometrics(). If it throws NotEnrolled / PasscodeNotSet
      // we know no lock is configured.
      final bool canCheckBiometrics = await _auth.canCheckBiometrics;
      final bool deviceSupported = await _auth.isDeviceSupported();

      if (!deviceSupported) return false; // No hardware at all.

      if (canCheckBiometrics) return true; // Biometrics are enrolled.

      // Device is supported but no biometrics enrolled — check whether a
      // PIN/pattern/password (device credential) is set by attempting a
      // background availability probe.  On Android this throws NotEnrolled
      // when no credential exists; on iOS it throws PasscodeNotSet.
      await _auth.getAvailableBiometrics(); // May throw if nothing enrolled.

      // If we reach here the OS did not throw — some credential is set.
      return true;
    } on PlatformException catch (e) {
      // These codes are thrown when the device has no lock screen configured.
      const noLockCodes = {'NotEnrolled', 'PasscodeNotSet', 'no_fragment_activity'};
      if (noLockCodes.contains(e.code)) {
        return false; // Nothing enrolled → bypass gracefully.
      }
      return false; // Any other unexpected error → bypass as well.
    }
  }

  /// Trigger biometric authentication with PIN/Pattern fallback.
  ///
  /// Returns true if:
  ///   • The user passes biometric / PIN / pattern / password verification, OR
  ///   • The device has no screen lock configured at all (graceful bypass).
  ///
  /// Returns false only when the user explicitly cancels the prompt or
  /// authentication fails while a lock IS configured.
  Future<bool> authenticate(String reason) async {
    try {
      final bool didAuthenticate = await _auth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(
          stickyAuth: true,
          biometricOnly: false, // Allows PIN/Pattern/Password fallback
        ),
        authMessages: const <AuthMessages>[
          AndroidAuthMessages(
            signInTitle: 'Biometric Verification',
            cancelButton: 'No thanks',
          ),
          IOSAuthMessages(
            cancelButton: 'No thanks',
          ),
        ],
      );
      return didAuthenticate;
    } on PlatformException catch (e) {
      // Graceful bypass: no screen lock is set up on this device.
      // The user has chosen not to use any lock, so we allow the action
      // to proceed without blocking the clocking flow.
      const noLockCodes = {'NotEnrolled', 'PasscodeNotSet', 'no_fragment_activity'};
      if (noLockCodes.contains(e.code)) return true;

      // For all other exceptions (hardware error, NotAvailable, etc.)
      // fall through and block the action.
      return false;
    }
  }
}
