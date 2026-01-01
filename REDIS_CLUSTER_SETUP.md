# Redis Cluster Setup Guide

## Overview

This guide explains how to set up and use Redis Cluster in Docker Compose for high availability and horizontal scaling.

## Architecture

Redis Cluster configuration includes:

- **3 Master nodes** (ports 7001-7003) - Handle read/write operations
- **3 Replica nodes** (ports 7004-7006) - Provide high availability and read scaling
- **Automatic failover** - If a master fails, a replica is promoted
- **Data sharding** - Keys are distributed across masters using hash slots

## Usage

### Development (Single Redis Instance - Default)

For local development, use the single Redis instance:

```bash
docker compose up -d redis
```

This starts a single Redis instance on port 6379 (default configuration).

### Production (Redis Cluster)

To use Redis Cluster, start with the cluster profile:

```bash
# Start Redis Cluster nodes
docker compose --profile redis-cluster up -d

# Initialize the cluster (first time only)
docker compose --profile redis-cluster up redis-cluster-init

# Verify cluster status
docker compose --profile redis-cluster exec redis-cluster-master-1 redis-cli -p 7001 cluster nodes
```

## Connecting to Redis Cluster

### Node.js Services (using redis v4 client)

The Redis client automatically handles cluster connections. Use a cluster endpoint:

```javascript
import { createClient } from 'redis';

// Cluster connection - client handles cluster discovery
const client = createClient({
  socket: {
    host: 'redis-cluster-master-1', // Any cluster node
    port: 7001,
  },
  // For cluster mode, Redis client will discover all nodes
});

// Or use cluster-specific configuration
const clusterClient = createClient({
  url: 'redis://redis-cluster-master-1:7001',
  // Client will use CLUSTER SLOTS to discover all nodes
});
```

For production, you may want to use a Redis Cluster proxy or list all nodes:

```javascript
const client = createClient({
  socket: {
    host: 'redis-cluster-master-1',
    port: 7001,
  },
  // Redis client will discover cluster topology automatically
});
```

**Note**: The `redis` npm package (v4+) supports cluster mode automatically when connecting to a cluster-enabled node. It will discover the cluster topology and route commands appropriately.

### Spring Boot Services

For Spring Boot services using Spring Data Redis, configure cluster nodes:

```properties
# application.properties
spring.data.redis.cluster.nodes=redis-cluster-master-1:7001,redis-cluster-master-2:7002,redis-cluster-master-3:7003
spring.data.redis.cluster.max-redirects=3
```

Or in Java configuration:

```java
@Configuration
public class RedisClusterConfig {
    @Bean
    public RedisConnectionFactory redisConnectionFactory() {
        RedisClusterConfiguration clusterConfiguration = new RedisClusterConfiguration(
            Arrays.asList(
                new RedisNode("redis-cluster-master-1", 7001),
                new RedisNode("redis-cluster-master-2", 7002),
                new RedisNode("redis-cluster-master-3", 7003)
            )
        );
        clusterConfiguration.setMaxRedirects(3);
        return new JedisConnectionFactory(clusterConfiguration);
    }
}
```

## Current Service Configuration

Currently, services are configured to use a single Redis instance. To switch to cluster mode:

### Option 1: Environment Variable (Recommended)

Update service environment variables:

```yaml
environment:
  - REDIS_HOST=redis-cluster-master-1
  - REDIS_PORT=7001
  # OR use cluster-specific configuration
  - REDIS_CLUSTER_NODES=redis-cluster-master-1:7001,redis-cluster-master-2:7002,redis-cluster-master-3:7003
```

### Option 2: Service-Specific Updates

For Node.js services, the `redis` client v4+ supports cluster mode automatically when connecting to a cluster node.

For Spring Boot services, update `application.properties` with cluster configuration.

## Cluster Management Commands

```bash
# Check cluster status
docker compose --profile redis-cluster exec redis-cluster-master-1 redis-cli -p 7001 cluster nodes

# Check cluster info
docker compose --profile redis-cluster exec redis-cluster-master-1 redis-cli -p 7001 cluster info

# Get cluster slots
docker compose --profile redis-cluster exec redis-cluster-master-1 redis-cli -p 7001 cluster slots

# Reshard cluster (if needed)
docker compose --profile redis-cluster exec redis-cluster-master-1 redis-cli --cluster reshard redis-cluster-master-1:7001
```

## Production Recommendations

1. **Use Managed Redis**: For production, consider managed Redis services:
   - AWS ElastiCache for Redis (Cluster mode enabled)
   - Redis Cloud
   - Azure Cache for Redis

2. **Security**: Enable authentication:

   ```yaml
   command: >
     redis-server
     --requirepass ${REDIS_PASSWORD}
     --masterauth ${REDIS_PASSWORD}
   ```

3. **Persistence**: AOF (Append Only File) is already enabled for data durability

4. **Monitoring**: Use Redis monitoring tools:
   - Redis Insight
   - Prometheus + Redis Exporter
   - Cloud provider monitoring

5. **Backup**: Implement regular backups of persistent volumes

6. **Network**: Use dedicated network for Redis cluster nodes

## Troubleshooting

### Cluster not initializing

```bash
# Check node logs
docker compose --profile redis-cluster logs redis-cluster-master-1

# Manually initialize cluster
docker compose --profile redis-cluster exec redis-cluster-init sh -c "redis-cli --cluster create redis-cluster-master-1:7001 redis-cluster-master-2:7002 redis-cluster-master-3:7003 redis-cluster-replica-1:7004 redis-cluster-replica-2:7005 redis-cluster-replica-3:7006 --cluster-replicas 1 --cluster-yes"
```

### Connection Issues

- Ensure all nodes are healthy: `docker compose --profile redis-cluster ps`
- Check network connectivity: `docker compose --profile redis-cluster exec redis-cluster-master-1 ping redis-cluster-master-2`
- Verify cluster status: `docker compose --profile redis-cluster exec redis-cluster-master-1 redis-cli -p 7001 cluster nodes`

### Data Persistence

Cluster configuration files and AOF files are stored in Docker volumes:

- `redis_cluster_master_1_data`
- `redis_cluster_master_2_data`
- etc.

To backup: `docker run --rm -v chat_redis_cluster_master_1_data:/data -v $(pwd):/backup alpine tar czf /backup/redis-master-1-backup.tar.gz /data`

## Migration from Single Redis to Cluster

1. **Backup data**: Export data from single Redis instance
2. **Start cluster**: Start Redis cluster nodes
3. **Initialize cluster**: Run cluster initialization
4. **Import data**: Use `redis-cli --cluster import` or migrate data gradually
5. **Update services**: Update service configurations to use cluster endpoints
6. **Test**: Verify all services work with cluster
7. **Switch traffic**: Update load balancer/config to point to cluster

## References

- [Redis Cluster Specification](https://redis.io/docs/management/scaling/)
- [Redis Cluster Tutorial](https://redis.io/docs/management/scaling/)
- [Docker Compose Profiles](https://docs.docker.com/compose/profiles/)
