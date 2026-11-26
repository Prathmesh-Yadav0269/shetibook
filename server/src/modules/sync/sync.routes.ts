import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireGroupMembership } from '../../middleware/auth.middleware.js';
import { SyncService } from './sync.service.js';

const router = Router({ mergeParams: true });
const syncService = new SyncService();

const getParam = (req: Request, key: string): string => {
  const val = req.params[key];
  return Array.isArray(val) ? val[0] : (val || '');
};

router.use(requireAuth);
router.use(requireGroupMembership());

// Batch sync endpoint for offline IndexedDB queue
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const groupId = getParam(req, 'groupId');
    const userId = req.user!.id;
    const { deviceId, deviceName, operations } = req.body;

    if (!deviceId || !Array.isArray(operations)) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_SYNC_PAYLOAD', message: 'deviceId and operations array are required.' },
      });
      return;
    }

    const result = await syncService.processBatchSync(
      groupId,
      userId,
      deviceId,
      operations,
      deviceName,
      req.ip,
      req.headers['user-agent']
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

// Device sync status
router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const groupId = getParam(req, 'groupId');
    const userId = req.user!.id;
    const deviceId = String(req.query.deviceId || 'default-device');

    const result = await syncService.getSyncStatus(groupId, userId, deviceId);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

export { router as syncRouter };
