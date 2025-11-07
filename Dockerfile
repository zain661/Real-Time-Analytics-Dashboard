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
#EXPOSE 5001 basma port for approach1/2/3
# Run migrations and start the app
CMD ["sh", "-c", "npx sequelize-cli db:migrate && npm run start4"]
