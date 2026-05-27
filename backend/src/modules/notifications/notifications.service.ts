import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private initialized = false;

  onModuleInit() {
    this.initFirebase();
  }

  private initFirebase() {
    try {
      // If GOOGLE_APPLICATION_CREDENTIALS is set in the environment,
      // firebase-admin will automatically discover it.
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
        });
      }
      this.initialized = true;
      this.logger.log('Firebase Admin SDK initialized successfully.');
    } catch (error) {
      this.logger.error('Failed to initialize Firebase Admin SDK', error);
      // We do not throw here to avoid crashing the whole backend if credentials are not yet set
    }
  }

  /**
   * Sends a push notification to a specific FCM token.
   */
  async sendPushToToken(token: string, title: string, body: string, data?: Record<string, string>): Promise<boolean> {
    if (!this.initialized || !token) return false;

    try {
      await admin.messaging().send({
        token,
        notification: {
          title,
          body,
        },
        data: data || {},
      });
      return true;
    } catch (error) {
      this.logger.error(`Failed to send push notification to token ${token}`, error);
      return false;
    }
  }
  /**
   * Sends a silent data message to trigger real-time app sync (no visible popup).
   */
  async sendSilentSyncToToken(token: string, action: string): Promise<boolean> {
    if (!this.initialized || !token) return false;

    try {
      await admin.messaging().send({
        token,
        data: { action },
      });
      return true;
    } catch (error) {
      this.logger.error(`Failed to send silent sync to token ${token}`, error);
      return false;
    }
  }
}
