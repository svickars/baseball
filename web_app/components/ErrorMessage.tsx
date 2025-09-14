'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorMessageProps {
	message: string;
	onRetry?: () => void;
}

export default function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
	return (
		<div className="flex flex-col items-center justify-center py-12">
			<div className="w-16 h-16 bg-error-100 rounded-full flex items-center justify-center mb-4">
				<AlertTriangle className="w-8 h-8 text-error-600" />
			</div>
			<h3 className="text-lg font-semibold text-secondary-900 mb-2">Something went wrong</h3>
			<p className="text-secondary-600 text-center mb-6 max-w-md">{message}</p>
			{onRetry && (
				<button onClick={onRetry} className="btn btn-primary">
					<RefreshCw className="w-4 h-4" />
					Try Again
				</button>
			)}
		</div>
	);
}
