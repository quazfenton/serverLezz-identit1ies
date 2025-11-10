import { Profile, GraphNode, GraphEdge } from '../../shared/types';

export class NetworkManager {
  private nodes: Map<string, GraphNode>;
  private edges: Map<string, GraphEdge>;

  constructor() {
    this.nodes = new Map();
    this.edges = new Map();
  }

  public addNode(profile: Profile): void {
    const node: GraphNode = {
      id: profile.id,
      profile,
      connections: [],
      weight: 1,
      lastInteraction: new Date(),
    };
    this.nodes.set(profile.id, node);
  }

  public addEdge(source: string, target: string, weight: number): void {
    const edgeId = `${source}-${target}`;
    const existingEdge = this.edges.get(edgeId);

    if (existingEdge) {
      existingEdge.weight = weight;
      existingEdge.lastUsed = new Date();
    } else {
      this.edges.set(edgeId, {
        id: edgeId,
        source,
        target,
        weight,
        lastUsed: new Date(),
      });

      // Update node connections
      const sourceNode = this.nodes.get(source);
      const targetNode = this.nodes.get(target);
      if (sourceNode) sourceNode.connections.push(target);
      if (targetNode) targetNode.connections.push(source);
    }
  }

  public getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  public getEdge(source: string, target: string): GraphEdge | undefined {
    return this.edges.get(`${source}-${target}`);
  }

  public updateWeights(): void {
    const currentTime = Date.now();
    
    // Apply time decay to edge weights
    this.edges.forEach((edge) => {
      const timeDiff = currentTime - edge.lastUsed.getTime();
      const decayFactor = Math.exp(-timeDiff / (1000 * 60 * 60 * 24)); // Daily decay
      edge.weight *= decayFactor;

      if (edge.weight < 0.1) {
        // Remove weak edges
        this.edges.delete(`${edge.source}-${edge.target}`);
        
        // Remove connections from nodes
        const sourceNode = this.nodes.get(edge.source);
        const targetNode = this.nodes.get(edge.target);
        if (sourceNode) {
          sourceNode.connections = sourceNode.connections.filter(
            (id) => id !== edge.target
          );
        }
        if (targetNode) {
          targetNode.connections = targetNode.connections.filter(
            (id) => id !== edge.source
          );
        }
      }
    });

    // Update node weights based on their connections
    this.nodes.forEach((node) => {
      const connectionWeights = node.connections
        .map((id) => this.edges.get(`${node.profile.id}-${id}`)?.weight || 0)
        .reduce((sum, weight) => sum + weight, 0);
      
      node.weight = Math.min(1, connectionWeights / node.connections.length || 1);
    });
  }

  public getNodes(): Map<string, GraphNode> {
    return this.nodes;
  }

  public getRecommendations(profileId: string): string[] {
    const node = this.nodes.get(profileId);
    if (!node) return [];

    return node.connections
      .map((id) => ({
        id,
        weight: this.edges.get(`${profileId}-${id}`)?.weight || 0,
      }))
      .sort((a, b) => b.weight - a.weight)
      .map((connection) => connection.id);
  }
}