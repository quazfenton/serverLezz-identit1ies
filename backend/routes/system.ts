/**
 * System Routes
 * Handles system health, metrics, and coordination endpoints
 */

import { Router, Request, Response } from 'express';
import { authenticateToken, optionalAuth, AuthenticatedRequest, expensiveOpLimiter } from '../middleware';
import { logger, logAudit } from '../../shared/utils';
import { Profile, ServiceListing, CoordinationMechanism, SystemMetrics, SystemState } from '../../shared/types';

const router = Router();

/**
 * GET /api/system/health
 * Health check endpoint
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const profilesRepo = (req.app.locals as any).profilesRepo;
    const listingsRepo = (req.app.locals as any).listingsRepo;

    const [profiles, listings] = await Promise.all([
      profilesRepo.getAll(),
      listingsRepo.getAll(),
    ]);

    const activeProfiles = profiles.filter((p: Profile) => p.isActive).length;
    const activeListings = listings.filter((l: ServiceListing) => l.isActive).length;

    res.json({
      status: 'healthy',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      activeProfiles,
      activeListings,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Health check error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    res.status(500).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/system/metrics
 * Get system metrics
 */
router.get('/metrics', optionalAuth, (req: Request, res: Response) => {
  try {
    const systemMetrics = (req.app.locals as any).systemMetrics as SystemMetrics;
    const systemState = (req.app.locals as any).systemState as SystemState;
    const activeCoordinations = (req.app.locals as any).activeCoordinations as Map<string, CoordinationMechanism>;
    const wsManager = (req.app.locals as any).wsManager;

    res.json({
      metrics: systemMetrics,
      state: systemState,
      activeCoordinations: activeCoordinations?.size || 0,
      connectedClients: wsManager?.getConnectionCount() || 0,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Get metrics error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

/**
 * POST /api/coordination
 * Create coordination mechanism
 */
router.post('/coordination', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { type, participants, objectives } = req.body;

    if (!authReq.auth?.profileId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const pList = participants || [authReq.auth.profileId];

    const coordination: CoordinationMechanism = {
      id: `coordination_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: type || 'algorithmic',
      participants: pList,
      initiatorId: authReq.auth.profileId,
      status: 'active',
      details: { objectives: objectives || [{ type: 'utility_maximization', weight: 1 }] },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      currentState: {
        phase: 'discovery',
        progress: 0,
        participants: pList.map((id: string) => ({
          profileId: id,
          engagement: 0.5,
          contribution: 0,
          satisfaction: 0.5,
          commitment: 0.7,
          lastActive: new Date(),
        })),
        resources: [],
        conflicts: [],
        resolutions: [],
      },
      performance: {
        efficiency: 0.5,
        effectiveness: 0.5,
        satisfaction: 0.5,
        scalability: 0.7,
        adaptability: 0.6,
        robustness: 0.6,
      },
    };

    const activeCoordinations = (req.app.locals as any).activeCoordinations as Map<string, CoordinationMechanism>;
    activeCoordinations.set(coordination.id, coordination);

    logAudit('coordination_created', coordination.id, 'coordinations', {
      initiatorId: coordination.initiatorId,
      participants: coordination.participants,
      type: coordination.type,
    });

    logger.info('Coordination created', {
      coordinationId: coordination.id,
      requestId: (req as any).requestId,
    });

    // Broadcast to WebSocket clients
    const wsManager = (req.app.locals as any).wsManager;
    wsManager?.broadcast({
      type: 'coordination_started',
      coordinationId: coordination.id,
      coordination,
    });

    res.status(201).json(coordination);
  } catch (error) {
    logger.error('Create coordination error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: (req as any).requestId,
    });
    res.status(500).json({ error: 'Failed to create coordination' });
  }
});

/**
 * GET /api/coordination/:id
 * Get coordination by ID
 */
router.get('/coordination/:id', async (req: Request, res: Response) => {
  try {
    const activeCoordinations = (req.app.locals as any).activeCoordinations as Map<string, CoordinationMechanism>;
    const coordination = activeCoordinations.get(req.params.id);

    if (!coordination) {
      return res.status(404).json({ error: 'Coordination not found' });
    }

    res.json(coordination);
  } catch (error) {
    logger.error('Get coordination error', {
      coordinationId: req.params.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    res.status(500).json({ error: 'Failed to get coordination' });
  }
});

/**
 * POST /api/matches
 * Find optimal matches
 */
router.post('/matches', authenticateToken, expensiveOpLimiter, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { targetProfileId, constraints } = req.body;

    if (!authReq.auth?.profileId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const profilesRepo = (req.app.locals as any).profilesRepo;
    const harmonizationEngine = (req.app.locals as any).harmonizationEngine;

    const source = await profilesRepo.getById(authReq.auth.profileId);
    if (!source) {
      return res.status(404).json({ error: 'Source profile not found' });
    }

    let candidates: Profile[];
    if (targetProfileId) {
      const t = await profilesRepo.getById(targetProfileId);
      candidates = t ? [t] : [];
    } else {
      const allProfiles = await profilesRepo.getAll();
      candidates = allProfiles.filter(
        (p: Profile) => p.id !== source.id && p.isActive
      );
    }

    const allUsers = (await profilesRepo.getAll()).reduce(
      (acc: Record<string, Profile>, p: Profile) => {
        acc[p.id] = p;
        return acc;
      },
      {}
    );

    let matches = harmonizationEngine?.findOptimalMatches(
      source,
      candidates,
      allUsers,
      new Date()
    ) || [];

    if (constraints?.minScore) {
      matches = matches.filter((m: any) => m.score >= constraints.minScore);
    }

    logger.info('Matches generated', {
      sourceProfileId: source.id,
      matchCount: matches.length,
      requestId: (req as any).requestId,
    });

    res.json({
      matches: matches.slice(0, 20),
      sourceProfile: source.id,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Generate matches error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: (req as any).requestId,
    });
    res.status(500).json({ error: 'Failed to generate matches' });
  }
});

/**
 * POST /api/optimize
 * Optimize system performance
 */
router.post('/optimize', authenticateToken, expensiveOpLimiter, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { currentProfile: pid, objectives } = req.body;

    if (!authReq.auth?.profileId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const profilesRepo = (req.app.locals as any).profilesRepo;
    const cloudModelEngine = (req.app.locals as any).cloudModelEngine;
    const systemMetrics = (req.app.locals as any).systemMetrics as SystemMetrics;

    const profile = await profilesRepo.getById(pid || authReq.auth.profileId);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const objs = objectives || [
      {
        type: 'utility_maximization',
        weight: 0.4,
        targetValue: 1,
        currentValue: 0.6,
        priority: 1,
      },
      {
        type: 'waste_minimization',
        weight: 0.3,
        targetValue: 0,
        currentValue: 0.1,
        priority: 2,
      },
      {
        type: 'equity_maximization',
        weight: 0.3,
        targetValue: 1,
        currentValue: 0.7,
        priority: 2,
      },
    ];

    const recs = await cloudModelEngine?.optimizeSystemPerformance(systemMetrics, objs) || [];

    logger.info('Optimization completed', {
      profileId: profile.id,
      recommendations: recs.length,
      requestId: (req as any).requestId,
    });

    res.json({
      recommendations: recs,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Optimization error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: (req as any).requestId,
    });
    res.status(500).json({ error: 'Failed to optimize' });
  }
});

/**
 * GET /api/connections
 * Get connections for current profile
 */
router.get('/connections', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const networkManager = (req.app.locals as any).networkManager;

    if (!authReq.auth?.profileId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const node = networkManager?.getNode(authReq.auth.profileId);
    if (!node) {
      return res.json({ connections: [], total: 0 });
    }

    const connections = node.connections.map((id: string) => {
      const edge = networkManager.getEdge(authReq.auth.profileId!, id);
      return { profileId: id, strength: edge?.weight || 0 };
    }).sort((a: any, b: any) => b.strength - a.strength);

    res.json({
      connections,
      total: connections.length,
    });
  } catch (error) {
    logger.error('Get connections error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: (req as any).requestId,
    });
    res.status(500).json({ error: 'Failed to get connections' });
  }
});

/**
 * POST /api/connections
 * Create connection
 */
router.post('/connections', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { fromId, toId, strength } = req.body;

    if (!authReq.auth?.profileId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const connectionsRepo = (req.app.locals as any).connectionsRepo;
    const networkManager = (req.app.locals as any).networkManager;
    const profilesRepo = (req.app.locals as any).profilesRepo;

    const srcId = fromId || authReq.auth.profileId;
    const [src, tgt] = await Promise.all([
      profilesRepo.getById(srcId),
      profilesRepo.getById(toId),
    ]);

    if (!src || !tgt) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const connection = {
      id: `connection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      profileA: src.id,
      profileB: tgt.id,
      strength: strength || 0.5,
      type: 'social',
      history: [],
      lastInteraction: new Date(),
    };

    await connectionsRepo.create(connection);
    networkManager?.addEdge(src.id, tgt.id, connection.strength);

    logAudit('connection_created', connection.id, 'connections', {
      profileA: src.id,
      profileB: tgt.id,
    });

    logger.info('Connection created', {
      connectionId: connection.id,
      requestId: (req as any).requestId,
    });

    res.status(201).json(connection);
  } catch (error) {
    logger.error('Create connection error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: (req as any).requestId,
    });
    res.status(500).json({ error: 'Failed to create connection' });
  }
});

export default router;
