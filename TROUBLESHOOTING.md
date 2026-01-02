# Troubleshooting Guide

## Docker Issues

### Docker Daemon Not Running

**Error:**
```
Cannot connect to the Docker daemon at unix:///Users/.../.docker/run/docker.sock. 
Is the docker daemon running?
```

**Solution:**
1. Open Docker Desktop application on your Mac
2. Wait for Docker Desktop to fully start (you'll see a whale icon in the menu bar)
3. Verify Docker is running:
   ```bash
   docker ps
   ```
   You should see an empty list or running containers, not an error.

4. If Docker Desktop is not installed:
   - Download from: https://www.docker.com/products/docker-desktop/
   - Install and start Docker Desktop
   - Make sure it's running before using docker-compose

### Port Already in Use

**Error:**
```
Bind for 0.0.0.0:8080 failed: port is already allocated
```

**Solution:**
1. Find what's using the port:
   ```bash
   lsof -i :8080
   ```
2. Stop the process or change the port in docker-compose.yml

### Database Connection Issues

**Error:**
```
Failed to connect to database
```

**Solution:**
1. Check if PostgreSQL container is running:
   ```bash
   docker ps
   ```
2. Check container logs:
   ```bash
   docker logs timebook-postgres
   ```
3. Verify database credentials in docker-compose.yml match your setup

## Backend Issues

### Go Module Errors

**Error:**
```
go: cannot find module providing package
```

**Solution:**
```bash
cd backend
go mod download
go mod tidy
```

### Migration Errors

**Error:**
```
migrate: command not found
```

**Solution:**
Install go-migrate:
```bash
# macOS
brew install golang-migrate

# Or download binary
curl -L https://github.com/golang-migrate/migrate/releases/download/v4.16.2/migrate.darwin-amd64.tar.gz | tar xvz
sudo mv migrate /usr/local/bin/migrate
```

## Frontend Issues

### Node Modules Errors

**Error:**
```
Cannot find module
```

**Solution:**
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### Build Errors

**Error:**
```
Vite build failed
```

**Solution:**
1. Clear cache:
   ```bash
   cd frontend
   rm -rf node_modules .vite dist
   npm install
   ```
2. Check Node.js version (should be 18+):
   ```bash
   node --version
   ```

## Common Commands

### Reset Everything (Docker)
```bash
docker-compose down -v
docker-compose up --build
```

### View Logs
```bash
# All services
docker-compose logs

# Specific service
docker-compose logs backend
docker-compose logs frontend
docker-compose logs postgres
```

### Stop Services
```bash
docker-compose down
```

### Rebuild Without Cache
```bash
docker-compose build --no-cache
docker-compose up
```

