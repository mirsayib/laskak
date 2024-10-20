# Use the official Postgres 13 image as the base image
FROM postgres:13

# Set environment variables for the default Postgres user and password
ENV POSTGRES_USER=sayib
ENV POSTGRES_PASSWORD=Sinat

# Copy the SQL script to the Docker image
COPY init-databases.sql /docker-entrypoint-initdb.d/

# The default command is already set to start Postgres, so no need to change it