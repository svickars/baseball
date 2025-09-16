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
		<div className="flex flex-col justify-center items-center py-12">
			<div className={`p-2 mb-4 bg-white rounded-lg ${sizeClasses[size]}`}>
				<img src="/images/loader.gif" alt="Loading..." className="object-contain w-full h-full" />
			</div>
			<p className="font-medium text-secondary-600 dark:text-secondary-400">{message}</p>
		</div>
	);
}
