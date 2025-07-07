FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json pnpm-lock.yaml ./

# Install pnpm
RUN npm install -g pnpm@9.12.2

# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy pre-built application from CI
COPY .next ./.next
COPY public ./public

EXPOSE 3000
ENV NODE_ENV=production

# Start the application
CMD ["pnpm", "start"]
