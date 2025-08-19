
import { Profile, AbstractResourceType, ResourceVector } from '../../shared/types';

export class PredictiveAnalyticsEngine {
    constructor() {
        console.log("PredictiveAnalyticsEngine initialized (linear projection implementation).");
    }

    public async predictFutureResourceLevels(
        node: Profile,
        time_horizon_minutes: number
    ): Promise<{ [key in AbstractResourceType]?: number }> {
        const predictedLevels: { [key in AbstractResourceType]?: number } = {};

        if (!node.abstractResources) {
            return {};
        }

        for (const resType of Object.values(AbstractResourceType)) {
            const resVector = node.abstractResources[resType];

            if (resVector) {
                // This is the linear fallback logic from the Python script
                const netRate = (resVector.regenerationRate || 0) - (resVector.consumptionRate || 0);
                const predictedLevel = Math.max(0, Math.min(1, (resVector.currentLevel || 0) + netRate * time_horizon_minutes / 60));
                predictedLevels[resType] = predictedLevel;
            }
        }

        return predictedLevels;
    }

    public async detectPotentialBottlenecks(
        nodes: { [key: string]: Profile },
        time_horizon_minutes: number
    ): Promise<any[]> {
        const bottlenecks = [];
        for (const node of Object.values(nodes)) {
            const predictions = await this.predictFutureResourceLevels(node, time_horizon_minutes);
            for (const [resource, level] of Object.entries(predictions)) {
                const resVector = node.abstractResources?.[resource as AbstractResourceType];
                if (resVector && level < (resVector.criticalThreshold || 0.2)) {
                    bottlenecks.push({
                        nodeId: node.id,
                        resource,
                        predictedLevel: level,
                        criticalThreshold: resVector.criticalThreshold || 0.2
                    });
                }
            }
        }
        return bottlenecks;
    }

    public async detectPotentialSurpluses(
        nodes: { [key: string]: Profile },
        time_horizon_minutes: number
    ): Promise<any[]> {
        const surpluses = [];
        const SURPLUS_THRESHOLD_FACTOR = 0.8;

        for (const node of Object.values(nodes)) {
            const predictions = await this.predictFutureResourceLevels(node, time_horizon_minutes);
            for (const [resource, level] of Object.entries(predictions)) {
                const resVector = node.abstractResources?.[resource as AbstractResourceType];
                if (resVector && level > (resVector.maxCapacity || 1.0) * SURPLUS_THRESHOLD_FACTOR) {
                    surpluses.push({
                        nodeId: node.id,
                        resource,
                        predictedLevel: level,
                        maxCapacity: resVector.maxCapacity || 1.0
                    });
                }
            }
        }
        return surpluses;
    }
}
