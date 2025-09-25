'use client';

// Simple performance diagnostic tool
class PerformanceDiagnostic {
	private static instance: PerformanceDiagnostic;
	private timers = new Map<string, number>();
	private metrics: Array<{ name: string; duration: number; timestamp: number }> = [];

	static getInstance(): PerformanceDiagnostic {
		if (!PerformanceDiagnostic.instance) {
			PerformanceDiagnostic.instance = new PerformanceDiagnostic();
		}
		return PerformanceDiagnostic.instance;
	}

	// Start timing
	start(name: string): void {
		this.timers.set(name, performance.now());
	}

	// End timing and record
	end(name: string): number {
		const startTime = this.timers.get(name);
		if (!startTime) {
			return 0;
		}

		const duration = performance.now() - startTime;
		this.timers.delete(name);

		this.metrics.push({
			name,
			duration,
			timestamp: Date.now(),
		});

		// Log slow operations
		if (duration > 100) {
			console.warn(`Slow operation detected: ${name} took ${duration.toFixed(2)}ms`);
		}

		return duration;
	}

	// Get all metrics
	getMetrics(): Array<{ name: string; duration: number; timestamp: number }> {
		return [...this.metrics];
	}

	// Get metrics by name
	getMetricsByName(name: string): Array<{ name: string; duration: number; timestamp: number }> {
		return this.metrics.filter((m) => m.name === name);
	}

	// Get average duration for a metric
	getAverageDuration(name: string): number {
		const metrics = this.getMetricsByName(name);
		if (metrics.length === 0) return 0;

		const total = metrics.reduce((sum, m) => sum + m.duration, 0);
		return total / metrics.length;
	}

	// Clear all metrics
	clear(): void {
		this.metrics = [];
		this.timers.clear();
	}

	// Log summary
	logSummary(): void {
		const summary = this.metrics.reduce((acc, metric) => {
			if (!acc[metric.name]) {
				acc[metric.name] = { count: 0, total: 0, max: 0, min: Infinity };
			}
			acc[metric.name].count++;
			acc[metric.name].total += metric.duration;
			acc[metric.name].max = Math.max(acc[metric.name].max, metric.duration);
			acc[metric.name].min = Math.min(acc[metric.name].min, metric.duration);
			return acc;
		}, {} as Record<string, { count: number; total: number; max: number; min: number }>);
	}
}

// Singleton instance
export const performanceDiagnostic = PerformanceDiagnostic.getInstance();

// Utility functions
export const perf = {
	start: (name: string) => performanceDiagnostic.start(name),
	end: (name: string) => performanceDiagnostic.end(name),
	measure: async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
		performanceDiagnostic.start(name);
		try {
			const result = await fn();
			return result;
		} finally {
			performanceDiagnostic.end(name);
		}
	},
	measureSync: <T>(name: string, fn: () => T): T => {
		performanceDiagnostic.start(name);
		try {
			const result = fn();
			return result;
		} finally {
			performanceDiagnostic.end(name);
		}
	},
};
