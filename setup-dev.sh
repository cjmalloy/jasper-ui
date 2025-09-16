#!/bin/bash

# Jasper-UI Development Setup Script
# This script helps set up the complete development environment

set -e

echo "🚀 Jasper-UI Development Setup"
echo "==============================="

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command_exists docker; then
    echo "❌ Docker is required but not installed. Please install Docker first."
    exit 1
fi

if ! command_exists node; then
    echo "❌ Node.js is required but not installed. Please install Node.js 22+."
    exit 1
fi

if ! command_exists npm; then
    echo "❌ npm is required but not installed. Please install npm."
    exit 1
fi

NODE_VERSION=$(node --version | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "⚠️  Node.js version $NODE_VERSION detected. Node.js 22+ is recommended for full compatibility."
fi

echo "✅ Prerequisites check complete"

# Install dependencies
echo "📦 Installing dependencies..."
if [ -f "package-lock.json" ]; then
    npm ci
else
    npm install
fi

echo "✅ Dependencies installed"

# Check if user wants to start the full stack
echo ""
echo "🔧 Setup complete! Here are your options:"
echo ""
echo "1. Frontend only (no backend):"
echo "   npm start"
echo "   → http://localhost:4200/"
echo ""
echo "2. Full stack with backend:"
echo "   npm run start:backend    # Start backend services"
echo "   npm start               # In another terminal, start frontend"
echo "   → Frontend: http://localhost:4200/"
echo "   → Backend API: http://localhost:8081/"
echo ""
echo "3. Full dockerized stack:"
echo "   npm run start:full --profile with-ui"
echo "   → http://localhost:8080/"
echo ""
echo "4. Run tests:"
echo "   npm test                      # Unit tests"
echo "   npm run test:docker          # Unit tests in Docker"
echo "   npm run cy:ci                # E2E tests"
echo ""

read -p "Would you like to start the backend services now? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 Starting backend services..."
    npm run start:backend
else
    echo "💡 You can start services later with: npm run start:backend"
fi