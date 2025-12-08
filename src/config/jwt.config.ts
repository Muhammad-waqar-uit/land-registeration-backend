export const jwtConfig = {
  secret: process.env.JWT_SECRET || 'your-secret-key-here',
  expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as string | number,
};
