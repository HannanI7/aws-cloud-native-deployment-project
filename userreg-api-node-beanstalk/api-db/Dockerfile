# Use an official Node.js runtime as a parent image
# Choose a version compatible with your code and dependencies (e.g., Node 18 or 20 LTS)
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (or npm-shrinkwrap.json)
# This step leverages Docker's cache. If these files haven't changed,
# Docker won't re-run npm install.
COPY package*.json ./

# Install app dependencies
# Use --only=production if you don't need devDependencies in the image
# However, for some build steps (like TypeScript compilation if you did it here),
# you might need devDependencies initially. Since your build is separate,
# --only=production is often fine. Let's keep it simple for now.
RUN npm install

# Bundle app source inside the Docker image
COPY . .

# Your app binds to port 5000 (or whatever you set in .env or code)
# This EXPOSE instruction is documentation; it doesn't actually publish the port.
# The actual port mapping happens in the `docker run` command or EC2 configuration.
# For now, let's assume your PORT environment variable will be set to 5000 when deployed.
EXPOSE 5000

# Define the command to run your app
# This will look for process.env.PORT, which we'll set when running the container on EC2.
CMD [ "node", "server.js" ]