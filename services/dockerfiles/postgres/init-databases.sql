-- init-databases.sql

-- Grant necessary permissions
ALTER USER sayib WITH SUPERUSER;

CREATE DATABASE user_db OWNER sayib;
CREATE DATABASE product_db OWNER sayib;
CREATE DATABASE order_db OWNER sayib;
CREATE DATABASE payments_db OWNER sayib;
CREATE DATABASE cart_db OWNER sayib;

-- Grant all privileges on all databases to sayib
GRANT ALL PRIVILEGES ON DATABASE user_db TO sayib;
GRANT ALL PRIVILEGES ON DATABASE product_db TO sayib;
GRANT ALL PRIVILEGES ON DATABASE order_db TO sayib;
GRANT ALL PRIVILEGES ON DATABASE payments_db TO sayib;
GRANT ALL PRIVILEGES ON DATABASE cart_db TO sayib;