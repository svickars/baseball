'use client';

interface LoadingSpinnerProps {
	message?: string;
	size?: 'sm' | 'md' | 'lg';
}

export default function LoadingSpinner({ message = 'Loading...', size = 'md' }: LoadingSpinnerProps) {
	const sizeClasses = {
		sm: 'w-8 h-8',
		md: 'w-12 h-12',
		lg: 'w-16 h-16',
	};

	return (
		<div className="flex flex-col items-center justify-center py-12">
			<div className={`bg-white rounded-lg p-2 mb-4 ${sizeClasses[size]}`}>
				<img src="/images/loader.gif" alt="Loading..." className="w-full h-full object-contain" />
			</div>
			<p className="text-secondary-600 dark:text-secondary-400 font-medium">{message}</p>
		</div>
	);
}
