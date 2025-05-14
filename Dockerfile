FROM node:22-alpine

# Copy standalone output
COPY .next/standalone ./
COPY .next/static ./.next/static
COPY public ./public

EXPOSE 3000
ENV NODE_ENV production
CMD ["node", "server.js"]
