# Use the same Node.js version as local
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package files first
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the project
COPY . .

# Expose your app port
EXPOSE 4002

# Run migrations and start the app
CMD ["sh", "-c", "npx sequelize-cli db:migrate && npm run start3"]
