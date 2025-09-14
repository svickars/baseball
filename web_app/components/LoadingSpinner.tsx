'use client';

interface LoadingSpinnerProps {
	message?: string;
	size?: 'sm' | 'md' | 'lg';
}

export default function LoadingSpinner({ message = 'Loading...', size = 'md' }: LoadingSpinnerProps) {
	const sizeClasses = {
		sm: 'w-4 h-4',
		md: 'w-8 h-8',
		lg: 'w-12 h-12',
	};

	return (
		<div className="flex flex-col items-center justify-center py-12">
			<div className={`spinner ${sizeClasses[size]} mb-4`} />
			<p className="text-secondary-600 font-medium">{message}</p>
		</div>
	);
}
