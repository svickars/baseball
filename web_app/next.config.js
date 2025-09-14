/** @type {import('next').NextConfig} */
const nextConfig = {
	images: {
		domains: ['localhost'],
	},
	async rewrites() {
		return [
			{
				source: '/api/:path*',
				destination: '/api/:path*',
			},
		];
	},
	env: {
		BASEBALL_LIB_PATH: process.env.BASEBALL_LIB_PATH || '../baseball',
	},
};

module.exports = nextConfig;
