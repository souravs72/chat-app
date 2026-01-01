#!/bin/bash

# Redis Cluster Initialization Script
# This script initializes a 6-node Redis cluster (3 masters + 3 replicas)

set -e

REDIS_PASSWORD=${REDIS_PASSWORD:-}

echo "Waiting for Redis nodes to be ready..."
sleep 10

# Build the redis-cli command
CLUSTER_CMD="redis-cli --cluster create"
if [ -n "$REDIS_PASSWORD" ]; then
    CLUSTER_CMD="$CLUSTER_CMD -a $REDIS_PASSWORD"
fi

CLUSTER_CMD="$CLUSTER_CMD \
    redis-master-1:7001 \
    redis-master-2:7002 \
    redis-master-3:7003 \
    redis-replica-1:7004 \
    redis-replica-2:7005 \
    redis-replica-3:7006 \
    --cluster-replicas 1"

echo "Initializing Redis cluster..."
eval $CLUSTER_CMD --cluster-yes

echo "Redis cluster initialized successfully!"
echo "Cluster nodes:"
if [ -n "$REDIS_PASSWORD" ]; then
    redis-cli -h redis-master-1 -p 7001 -a "$REDIS_PASSWORD" cluster nodes
else
    redis-cli -h redis-master-1 -p 7001 cluster nodes
fi


