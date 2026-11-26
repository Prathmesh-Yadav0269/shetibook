import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireGroupMembership } from '../../middleware/auth.middleware.js';
import { NotificationService } from './notification.service.js';

const router = Router({ mergeParams: true });
const notificationService = new NotificationService();

const getParam = (req: Request, key: string): string => {
  const val = req.params[key];
  return Array.isArray(val) ? val[0] : (val || '');
};

router.use(requireAuth);
router.use(requireGroupMembership());

// 1. List notifications for current user in this group
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const groupId = getParam(req, 'groupId');
    const userId = req.user!.id;

    // Trigger on-demand check for due reminders so user receives latest alerts even on sleeping server
    await notificationService.processDueReminders().catch(() => {});

    const data = await notificationService.listNotifications(groupId, userId);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
});

// 2. Mark single notification as read
router.patch('/:notificationId/read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const groupId = getParam(req, 'groupId');
    const notificationId = getParam(req, 'notificationId');
    const userId = req.user!.id;

    const result = await notificationService.markAsRead(groupId, userId, notificationId);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

// 3. Mark all as read
router.post('/mark-all-read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const groupId = getParam(req, 'groupId');
    const userId = req.user!.id;

    const result = await notificationService.markAllAsRead(groupId, userId);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

// 4. Get preferences
router.get('/preferences', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const groupId = getParam(req, 'groupId');
    const userId = req.user!.id;

    const data = await notificationService.getPreferences(groupId, userId);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
});

// 5. Update preferences
router.put('/preferences', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const groupId = getParam(req, 'groupId');
    const userId = req.user!.id;
    const { activityReminders, familyEscalations, financialAlerts, webPushEnabled } = req.body;

    const data = await notificationService.updatePreferences(groupId, userId, {
      activityReminders,
      familyEscalations,
      financialAlerts,
      webPushEnabled,
    });

    res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
});

// 6. Push subscription registration
router.post('/push-subscription', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { endpoint, p256dh, auth } = req.body;

    if (!endpoint || !p256dh || !auth) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_PUSH_SUBSCRIPTION', message: 'Missing push subscription fields.' },
      });
      return;
    }

    const result = await notificationService.savePushSubscription(userId, {
      endpoint,
      p256dh,
      auth,
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

// 7. Acknowledge activity reminder (Farmer response that suppresses family escalation)
router.post('/reminders/:activityId/acknowledge', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const groupId = getParam(req, 'groupId');
    const activityId = getParam(req, 'activityId');
    const userId = req.user!.id;
    const { note } = req.body;

    const result = await notificationService.acknowledgeActivityReminder(
      activityId,
      userId,
      groupId,
      note
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

export { router as notificationRouter };
