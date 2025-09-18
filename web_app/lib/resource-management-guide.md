# Resource Management Integration Guide

## Overview

This guide explains how to integrate the comprehensive resource management system into your baseball web application. The system provides intelligent memory management, image optimization, resource monitoring, and automatic cleanup mechanisms.

## Components Overview

### 1. Resource Manager (`resource-manager.ts`)

- **Purpose**: Centralized resource tracking and cleanup
- **Features**: Memory monitoring, automatic cleanup, resource statistics
- **Usage**: Register and track all application resources

### 2. Image Optimizer (`image-optimizer.ts`)

- **Purpose**: Optimized image loading and caching
- **Features**: Lazy loading, format optimization, cache management
- **Usage**: Load images efficiently with automatic optimization

### 3. Optimized Team Logo (`OptimizedTeamLogo.tsx`)

- **Purpose**: Optimized team logo component
- **Features**: Lazy loading, fallback handling, error recovery
- **Usage**: Replace existing team logo components

### 4. Resource Monitor (`ResourceMonitor.tsx`)

- **Purpose**: Real-time resource monitoring
- **Features**: Memory usage tracking, performance metrics, cleanup controls
- **Usage**: Monitor application performance in development

### 5. Resource Cleanup Hooks (`useResourceCleanup.ts`)

- **Purpose**: Automatic resource cleanup for React components
- **Features**: Interval management, event listener cleanup, observer management
- **Usage**: Ensure proper cleanup in React components

## Integration Steps

### Step 1: Replace Team Logo Components

Replace existing team logo imports with optimized versions:

```typescript
// Before
import * as TeamLogos from './team-logos';
const getTeamLogo = (teamCode: string) => {
	const LogoComponent = TeamLogos[teamCode as keyof typeof TeamLogos];
	return LogoComponent ? <LogoComponent size={100} /> : null;
};

// After
import { OptimizedTeamLogo } from '@/components/OptimizedTeamLogo';
const getTeamLogo = (teamCode: string) => {
	return <OptimizedTeamLogo teamCode={teamCode} size={100} lazy={true} />;
};
```

### Step 2: Update Component Cleanup

Replace manual cleanup with managed cleanup hooks:

```typescript
// Before
useEffect(() => {
	const interval = setInterval(() => {
		// Do something
	}, 1000);

	return () => {
		clearInterval(interval);
	};
}, []);

// After
import { useManagedInterval } from '@/hooks/useResourceCleanup';

useManagedInterval(
	() => {
		// Do something
	},
	1000,
	'my-interval-id'
);
```

### Step 3: Add Resource Monitoring

Add resource monitoring to your main layout:

```typescript
// In your main layout component
import { DevResourceMonitor } from '@/components/ResourceMonitor';

export default function Layout({ children }) {
	return (
		<>
			{children}
			<DevResourceMonitor position="bottom-right" />
		</>
	);
}
```

### Step 4: Integrate Image Optimization

Use the image optimizer for custom image loading:

```typescript
import { useImageOptimizer } from '@/lib/image-optimizer';

function MyComponent() {
	const imageOptimizer = useImageOptimizer();

	const loadImage = async (url: string) => {
		try {
			const img = await imageOptimizer.loadImage(url, undefined, {
				lazy: true,
				quality: 80,
				format: 'webp',
			});
			return img;
		} catch (error) {
			console.error('Failed to load image:', error);
		}
	};
}
```

### Step 5: Update Existing Hooks

Update your existing hooks to use resource management:

```typescript
// Before
export function useBaseballApp() {
	const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

	useEffect(() => {
		return () => {
			if (refreshIntervalRef.current) {
				clearInterval(refreshIntervalRef.current);
			}
		};
	}, []);
}

// After
import { useResourceCleanup } from '@/hooks/useResourceCleanup';

export function useBaseballApp() {
	const { registerInterval, unregisterResource } = useResourceCleanup();

	const startRefresh = () => {
		const interval = setInterval(() => {
			// Refresh logic
		}, 30000);

		registerInterval('auto-refresh', interval);
	};
}
```

## Performance Benefits

### Memory Management

- **Automatic Cleanup**: Resources are automatically cleaned up when no longer needed
- **Memory Monitoring**: Real-time tracking of memory usage
- **Cache Eviction**: Intelligent cache eviction based on usage patterns

### Image Optimization

- **Lazy Loading**: Images load only when needed
- **Format Optimization**: Automatic format selection (WebP, JPEG, PNG)
- **Cache Management**: Efficient image caching with size limits

### Resource Monitoring

- **Real-time Stats**: Live monitoring of resource usage
- **Performance Metrics**: Detailed performance statistics
- **Cleanup Controls**: Manual cleanup options for debugging

## Configuration Options

### Resource Manager Configuration

```typescript
// Set memory threshold
resourceManager.setMemoryThreshold(200 * 1024 * 1024); // 200MB

// Set max resource age
resourceManager.setMaxResourceAge(60 * 60 * 1000); // 1 hour
```

### Image Optimizer Configuration

```typescript
// Preload images
await imageOptimizer.preloadImages(['/images/team1.webp', '/images/team2.webp']);

// Get cache statistics
const stats = imageOptimizer.getCacheStats();
console.log(`Cache size: ${stats.size}, Count: ${stats.count}`);
```

### Resource Monitor Configuration

```typescript
<ResourceMonitor show={true} position="top-right" updateInterval={2000} className="custom-monitor" />
```

## Best Practices

### 1. Resource Registration

- Always register resources with unique IDs
- Use descriptive IDs for easier debugging
- Register resources as soon as they're created

### 2. Cleanup Strategy

- Use managed hooks instead of manual cleanup
- Register cleanup functions for complex resources
- Test cleanup behavior in development

### 3. Image Loading

- Use lazy loading for images below the fold
- Provide fallback images for error cases
- Optimize image formats and sizes

### 4. Monitoring

- Use development monitor for debugging
- Monitor memory usage patterns
- Clean up resources regularly

## Troubleshooting

### Common Issues

1. **Memory Leaks**

   - Check if resources are properly registered
   - Verify cleanup functions are working
   - Monitor resource statistics

2. **Image Loading Issues**

   - Check image URLs and formats
   - Verify fallback images exist
   - Monitor image cache statistics

3. **Performance Issues**
   - Check resource counts and sizes
   - Monitor memory usage trends
   - Use cleanup controls when needed

### Debug Tools

1. **Resource Monitor**: Real-time resource tracking
2. **Console Logging**: Detailed resource actions
3. **Memory Stats**: Comprehensive memory statistics

## Migration Checklist

- [ ] Replace team logo components
- [ ] Update component cleanup hooks
- [ ] Add resource monitoring
- [ ] Integrate image optimization
- [ ] Update existing hooks
- [ ] Test resource cleanup
- [ ] Monitor performance improvements
- [ ] Configure resource limits

## Support

For issues or questions about the resource management system:

1. Check the resource monitor for statistics
2. Review console logs for resource actions
3. Use cleanup controls for debugging
4. Monitor memory usage patterns
